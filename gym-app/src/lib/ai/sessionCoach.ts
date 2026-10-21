import type { Profile, SessionNote, SetLog, SkipReason } from '../../types'
import { GOAL_LABELS, getAge } from '../metrics'
import { formatPrescription } from '../prescription'
import { formatSetForAi } from '../bodyweight'
import { SKIP_REASONS, SKIP_REASON_LABELS, type WorkoutEntry } from '../sessionIncidents'
import { STYLE, type ChangeRequest } from './routineCoach'
import { generateJson, mediaPart, type GeminiPart } from './geminiClient'

export interface SessionCoachContext {
  profile: Profile
  routineName: string
  minutesIn: number
  entries: WorkoutEntry[] // today's exercises as shown, coach changes applied
  sets: SetLog[] // everything logged in this session
  notes: SessionNote[]
}

export type SessionAction =
  | { type: 'drop'; exerciseId: number; reason: SkipReason }
  | { type: 'sets'; exerciseId: number; sets: number }
  | { type: 'priority'; exerciseId: number }

export interface SessionCoachAnswer {
  heard: string // what the person said (transcribed when it came as audio)
  answer: string
  actions: SessionAction[]
  finish: SkipReason | null // finishing now is the sensible call; reason for what's left
}

const ACTION_TYPES = ['drop', 'sets', 'priority'] as const

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    heard: { type: 'string', description: 'Lo que ha dicho la persona, transcrito literalmente si viene en audio' },
    answer: { type: 'string', description: 'Respuesta directa, como mucho 3 frases' },
    actions: {
      type: 'array',
      description: 'Cambios de hoy sobre los ejercicios pendientes; vacío si no hace falta cambiar nada',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...ACTION_TYPES] },
          exerciseId: { type: 'number' },
          reason: { type: 'string', enum: SKIP_REASONS, description: 'Solo en drop' },
          sets: { type: 'number', description: 'Solo en sets: series totales que hará hoy' },
        },
        required: ['type', 'exerciseId'],
      },
    },
    finish: { type: 'string', enum: [...SKIP_REASONS, 'none'], description: 'Motivo si lo sensato es terminar ya; "none" si no' },
  },
  required: ['heard', 'answer', 'actions', 'finish'],
}

function describeEntry({ exercise, plan }: WorkoutEntry, sets: SetLog[]): string {
  const done = sets.filter((s) => s.exerciseId === exercise.id).sort((a, b) => a.setNumber - b.setNumber)
  const prescription = formatPrescription(plan)
  const status =
    done.length === 0
      ? 'pendiente'
      : plan.sets != null && done.length >= plan.sets
        ? `hecho (${done.map(formatSetForAi).join(', ')})`
        : `a medias (${done.map(formatSetForAi).join(', ')})`
  return `${exercise.id} | ${exercise.name} | ${exercise.muscleGroup} | ${prescription ?? 'sin pauta'} | ${status}`
}

function buildPrompt(ctx: SessionCoachContext, question: ChangeRequest): string {
  const { profile } = ctx
  return [
    'Eres su entrenador personal y estás a su lado en el gimnasio, a mitad del entrenamiento. Te cuenta algo que ha pasado o que le preocupa.',
    `Persona: ${profile.sex === 'M' ? 'hombre' : 'mujer'}, ${getAge(profile.birthDate)} años, ${profile.weightKg} kg. Objetivo: ${GOAL_LABELS[profile.goal]}.`,
    `Rutina de hoy: ${ctx.routineName}. Lleva ${ctx.minutesIn} minutos entrenando.`,
    '',
    'Ejercicios de hoy (id | nombre | grupo | pauta | estado). "PC(x)+y" = peso corporal más lastre:',
    ...ctx.entries.map((e) => describeEntry(e, ctx.sets)),
    ...(ctx.notes.length
      ? ['', 'Conversación previa de esta sesión:', ...ctx.notes.map((n) => `${n.role === 'user' ? 'Persona' : 'Coach'}: ${n.text}`)]
      : []),
    '',
    question.audio ? 'Su mensaje está en el audio adjunto (puede haber ruido de gimnasio).' : `Su mensaje: "${question.text?.trim() ?? ''}"`,
    '',
    'Cómo actuar:',
    '- Si tiene que irse ya, usa finish con el motivo (unexpected si es un imprevisto) y, si le queda un momento, dile cuál es el único ejercicio que merece la pena terminar.',
    '- Si le queda poco tiempo, prioriza con priority los básicos pendientes más importantes, reduce series con sets donde ayude y quita con drop (reason time) lo que no cabe. Calcula unos 2-3 minutos por serie con descanso.',
    '- Si está cansado o sin energía, propone una versión reducida (menos series, quitar algún aislamiento con reason tired) en lugar de abandonar, salvo que se encuentre mal.',
    '- Si le duele algo: si es agudo, punzante o no se va, que pare ese ejercicio (drop con reason pain) y lo consulte si persiste; si es una molestia leve, baja carga o quita ese ejercicio.',
    '- Si el gimnasio está lleno, reordena con priority hacia lo que tenga libre o di que pregunte en el coach de cada ejercicio por una alternativa.',
    '- Si solo es una pregunta o un comentario, responde y deja actions vacío y finish "none".',
    '- Solo actúa sobre ejercicios pendientes o a medias y usa sus id exactos. En sets indica las series totales de hoy, nunca menos de las ya hechas.',
    '- En answer explica en una o dos frases qué propones y por qué; los cambios no se aplican hasta que los acepte.',
    STYLE,
  ].join('\n')
}

export async function askSessionCoach(
  ctx: SessionCoachContext,
  question: ChangeRequest,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<SessionCoachAnswer> {
  const parts: GeminiPart[] = [{ text: buildPrompt(ctx, question) }]
  if (question.audio) parts.push(await mediaPart(question.audio, 'audio/wav'))
  const raw = await generateJson<{ heard?: string; answer?: string; actions?: Array<Record<string, unknown>>; finish?: string }>(
    parts,
    ANSWER_SCHEMA,
    apiKey,
    model,
    signal,
  )
  const answer = String(raw.answer ?? '').trim()
  if (!answer) throw new Error('La IA no devolvió una respuesta. Inténtalo otra vez.')
  const heard = question.text?.trim() || String(raw.heard ?? '').trim() || 'Mensaje de voz'
  return {
    heard,
    answer,
    actions: validateActions(raw.actions ?? [], ctx),
    finish: SKIP_REASONS.includes(raw.finish as SkipReason) ? (raw.finish as SkipReason) : null,
  }
}

// Keeps only changes to exercises that still have work left, one per exercise and type.
export function validateActions(rawActions: Array<Record<string, unknown>>, ctx: Pick<SessionCoachContext, 'entries' | 'sets'>): SessionAction[] {
  const doneCount = (id: number) => ctx.sets.filter((s) => s.exerciseId === id).length
  const open = new Map(
    ctx.entries
      .filter(({ exercise, plan }) => plan.sets == null || doneCount(exercise.id!) < plan.sets)
      .map((e) => [e.exercise.id!, e]),
  )
  const actions: SessionAction[] = []
  const seen = new Set<string>()
  for (const raw of rawActions) {
    const exerciseId = Number(raw.exerciseId)
    const entry = open.get(exerciseId)
    const type = raw.type as SessionAction['type']
    if (!entry || !ACTION_TYPES.includes(type) || seen.has(`${type}:${exerciseId}`)) continue
    if (type === 'drop') {
      if (seen.has(`sets:${exerciseId}`) || seen.has(`priority:${exerciseId}`)) continue
      const reason = SKIP_REASONS.includes(raw.reason as SkipReason) ? (raw.reason as SkipReason) : 'time'
      actions.push({ type, exerciseId, reason })
    } else if (type === 'sets') {
      const sets = Math.round(Number(raw.sets))
      const current = entry.plan.sets ?? Infinity
      if (!Number.isFinite(sets) || sets < Math.max(1, doneCount(exerciseId)) || sets >= current) continue
      actions.push({ type, exerciseId, sets })
    } else {
      actions.push({ type, exerciseId })
    }
    seen.add(`${type}:${exerciseId}`)
  }
  // A dropped exercise can't also be reduced or prioritised.
  const dropped = new Set(actions.filter((a) => a.type === 'drop').map((a) => a.exerciseId))
  return actions.filter((a) => a.type === 'drop' || !dropped.has(a.exerciseId))
}

export function describeAction(action: SessionAction, names: Map<number, string>): string {
  const name = names.get(action.exerciseId) ?? 'Ejercicio'
  if (action.type === 'drop') return `Quitar hoy: ${name} (${SKIP_REASON_LABELS[action.reason].toLowerCase()})`
  if (action.type === 'sets') return `${name}: ${action.sets} ${action.sets === 1 ? 'serie' : 'series'} hoy`
  return `Hacer antes: ${name}`
}
