import type { AiProgram, AiRoutine, AiRoutineItem, Exercise } from '../../types'
import type { TrainingContext } from '../../db/routineContext'
import type { MuscleGroup } from '../muscleGroups'
import { GOAL_LABELS, getAge } from '../metrics'
import { equipmentOf } from '../equipment'
import { NO_PERIOD_LABELS } from '../cycle'
import { bestOneRepMax, sessionsWithoutImprovement } from '../workoutHistory'
import { REP_RANGES } from './workoutCoach'
import { generateJson, mediaPart, type GeminiPart } from './geminiClient'
import { formatSetForAi, loadOf } from '../bodyweight'

export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced'
export type TrainingPlace = 'gym' | 'dumbbells' | 'home'

export const LEVEL_LABELS: Record<TrainingLevel, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

export const PLACE_LABELS: Record<TrainingPlace, string> = {
  gym: 'Gimnasio completo',
  dumbbells: 'Mancuernas y banco',
  home: 'Casa sin material',
}

export interface ProgramRequest {
  daysPerWeek: number
  minutes: number
  level: TrainingLevel
  place: TrainingPlace
  priorities: MuscleGroup[]
  notes: string // injuries, limits, preferences
}

// A free request to the coach ("quita el curl y mete más glúteo"), typed or spoken.
export interface ChangeRequest {
  text?: string
  audio?: Blob
}

const WEEKLY_SETS: Record<TrainingLevel, string> = {
  beginner: '8-12',
  intermediate: '10-16',
  advanced: '14-20',
}

const STALLED_SESSIONS = 3
const MAX_PROGRESS_LINES = 30

const kg = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })

// ---- Context blocks shared by every routine prompt ----

export function describePerson({ profile, cycle }: TrainingContext): string[] {
  const lines = [
    `Persona: ${profile.sex === 'M' ? 'hombre' : 'mujer'}, ${getAge(profile.birthDate)} años, ${profile.heightCm} cm, ${profile.weightKg} kg.`,
    `Objetivo: ${GOAL_LABELS[profile.goal]}.`,
  ]
  const status = cycle?.status
  if (status?.method === 'none' && status.reason === 'pregnancy') {
    lines.push('Está embarazada: nada de cargas máximas, ni ejercicios tumbada boca arriba largos, ni impacto; recomienda seguir a su profesional sanitario.')
  } else if (status?.method === 'none') {
    lines.push(`No tiene regla (${NO_PERIOD_LABELS[status.reason].toLowerCase()}).`)
  } else if (status) {
    lines.push('Registra su ciclo menstrual: el programa debe poder mantenerse todo el mes; no lo organices por fases del ciclo.')
  }
  return lines
}

export function describeHistory(ctx: TrainingContext): string[] {
  const perWeek = ctx.sessions.length / ctx.weeks
  const lines = [
    `Historial de las últimas ${ctx.weeks} semanas: ${ctx.sessions.length} entrenamientos de fuerza (${perWeek.toLocaleString('es', { maximumFractionDigits: 1 })} por semana).`,
  ]
  if (ctx.progress.length === 0) {
    lines.push('Sin series registradas todavía: trátalo según el nivel que indica.')
    return lines
  }
  lines.push(
    'Por ejercicio (id, sesiones, última vez, mejor serie de la última sesión, 1RM estimado, sesiones seguidas sin mejorar). ' +
      '"PC(x)+y" = peso corporal movido x kg más y kg de lastre:',
  )
  for (const { exercise, history, lastDate } of ctx.progress.slice(0, MAX_PROGRESS_LINES)) {
    const best = history.today.reduce((a, b) => (loadOf(b) * b.reps > loadOf(a) * a.reps ? b : a))
    lines.push(
      `- [id ${exercise.id}] ${exercise.name}: ${history.previous.length + 1} ses., ${shortDate(lastDate)}, ` +
        `${formatSetForAi(best)}, 1RM ${kg(bestOneRepMax(history.today))} kg, sin mejorar ${sessionsWithoutImprovement(history)}`,
    )
  }
  return lines
}

function placeAllows(place: TrainingPlace, exercise: Exercise): boolean {
  const equipment = equipmentOf(exercise)
  if (place === 'gym') return true
  if (place === 'dumbbells') return equipment === 'Mancuernas' || equipment === 'Peso corporal' || equipment === null
  return equipment === 'Peso corporal' || equipment === null
}

export function describeCatalog(catalog: Exercise[]): string[] {
  return [
    'Catálogo disponible (id | nombre | grupo | material). Usa SOLO estos ejercicios y sus id exactos:',
    ...catalog.map((e) => `${e.id} | ${e.name} | ${e.muscleGroup} | ${equipmentOf(e) ?? 'sin indicar'}`),
  ]
}

export function designRules(ctx: TrainingContext): string[] {
  const range = REP_RANGES[ctx.profile.goal]
  return [
    'Criterios de diseño:',
    '- Básicos multiarticulares primero, aislamiento después. Evita repetir el mismo patrón dos veces seguidas.',
    `- Rango general de repeticiones para su objetivo: ${range.min}-${range.max}. Básicos en la parte baja (p. ej. 6-8 u 8-10), aislamiento en la alta (10-12 o 12-15).`,
    '- Descanso: 120-180 s en básicos pesados, 60-90 s en aislamiento.',
    '- Usa con preferencia los ejercicios que ya hace y en los que progresa. Si uno lleva ' +
      `${STALLED_SESSIONS} o más sesiones sin mejorar, cámbialo por una variante del mismo músculo y explica por qué.`,
    '- Respeta siempre las lesiones o limitaciones que indique: no pongas ejercicios que las carguen.',
  ]
}

export const STYLE =
  'Escribe en español de España con tildes y ortografía correctas, tuteando siempre. Tono serio, directo y breve, sin emojis ni exclamaciones.'

// ---- Response parsing ----

export const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    exerciseId: { type: 'number' },
    sets: { type: 'number' },
    repMin: { type: 'number' },
    repMax: { type: 'number' },
    restSeconds: { type: 'number' },
    reason: { type: 'string', description: 'Por qué está este ejercicio, una frase corta' },
  },
  required: ['exerciseId', 'sets', 'repMin', 'repMax', 'restSeconds', 'reason'],
}

const ROUTINE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Nombre corto del día, p. ej. "Torso A" o "Pierna y glúteo"' },
    focus: { type: 'string', description: 'Qué trabaja este día, una frase' },
    exercises: { type: 'array', items: ITEM_SCHEMA },
  },
  required: ['name', 'focus', 'exercises'],
}

const PROGRAM_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Nombre del programa, p. ej. "Torso-Pierna 4 días"' },
    summary: { type: 'string', description: 'Por qué este programa encaja con la persona, 2 o 3 frases' },
    days: { type: 'array', items: ROUTINE_SCHEMA },
  },
  required: ['name', 'summary', 'days'],
}

export const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function parseItems(raw: unknown, known: Set<number>): AiRoutineItem[] {
  const items: AiRoutineItem[] = []
  for (const entry of Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : []) {
    const exerciseId = Number(entry.exerciseId)
    if (!known.has(exerciseId) || items.some((i) => i.exerciseId === exerciseId)) continue
    const repMin = clampInt(entry.repMin, 1, 30, 8)
    items.push({
      exerciseId,
      sets: clampInt(entry.sets, 1, 8, 3),
      repMin,
      repMax: Math.max(repMin, clampInt(entry.repMax, 1, 30, repMin)),
      restSeconds: Math.round(clampInt(entry.restSeconds, 30, 300, 90) / 15) * 15,
      reason: String(entry.reason ?? '').trim() || undefined,
    })
  }
  return items
}

function parseRoutine(raw: Record<string, unknown>, known: Set<number>): AiRoutine | null {
  const items = parseItems(raw.exercises, known)
  if (items.length === 0) return null
  return { name: String(raw.name ?? '').trim() || 'Rutina', focus: String(raw.focus ?? '').trim(), items }
}

function parseProgram(raw: Record<string, unknown>, known: Set<number>): AiProgram {
  const days = (Array.isArray(raw.days) ? (raw.days as Array<Record<string, unknown>>) : [])
    .map((d) => parseRoutine(d, known))
    .filter((d): d is AiRoutine => d !== null)
  if (days.length === 0) throw new Error('La IA no devolvió un programa válido. Inténtalo otra vez.')
  return { name: String(raw.name ?? '').trim() || 'Programa', summary: String(raw.summary ?? '').trim(), days }
}

export function describeRoutine(routine: AiRoutine, byId: Map<number, Exercise>): string[] {
  return [
    `${routine.name}${routine.focus ? ` (${routine.focus})` : ''}:`,
    ...routine.items.map((i) => {
      const name = byId.get(i.exerciseId)?.name ?? '?'
      const work = i.sets != null ? `${i.sets}×${i.repMin ?? '?'}-${i.repMax ?? i.repMin ?? '?'}, ${i.restSeconds ?? '?'} s` : 'sin objetivo'
      return `- [id ${i.exerciseId}] ${name}: ${work}`
    }),
  ]
}

export async function requestParts(prompt: string, change?: ChangeRequest): Promise<GeminiPart[]> {
  const parts: GeminiPart[] = [{ text: prompt }]
  if (change?.audio) parts.push(await mediaPart(change.audio, 'audio/wav'))
  return parts
}

export function describeChange(change: ChangeRequest): string {
  return change.audio
    ? 'La petición de cambios está en el audio adjunto (puede tener ruido de fondo).'
    : `Petición de cambios: "${change.text?.trim() ?? ''}"`
}

// ---- Weekly program ----

function programCatalog(ctx: TrainingContext, place: TrainingPlace) {
  return ctx.catalog.filter((e) => placeAllows(place, e))
}

function programPrompt(ctx: TrainingContext, req: ProgramRequest, catalog: Exercise[]): string {
  return [
    'Eres un entrenador personal de musculación. Diseña un programa semanal de fuerza a medida.',
    ...describePerson(ctx),
    '',
    'Lo que pide:',
    `- ${req.daysPerWeek} días por semana, unos ${req.minutes} minutos por sesión.`,
    `- Nivel: ${LEVEL_LABELS[req.level].toLowerCase()}. Material: ${PLACE_LABELS[req.place].toLowerCase()}.`,
    req.priorities.length ? `- Músculos que quiere priorizar: ${req.priorities.join(', ')}.` : '- Sin prioridades concretas: equilibrado.',
    req.notes.trim() ? `- Lesiones, limitaciones o preferencias: "${req.notes.trim()}"` : '- Sin lesiones indicadas.',
    '',
    'Estructura:',
    `- Devuelve exactamente ${req.daysPerWeek} días. Elige la división adecuada (cuerpo completo, torso-pierna, empuje-tirón-pierna…) para esos días y su nivel, de modo que cada músculo se entrene unas 2 veces por semana.`,
    `- Volumen semanal por músculo grande de ${WEEKLY_SETS[req.level]} series efectivas; los prioritarios en la parte alta, los pequeños algo menos.`,
    `- Que cada sesión quepa en ${req.minutes} minutos contando descansos (aprox. un ejercicio cada 10-12 minutos).`,
    ...designRules(ctx),
    'Explica en summary por qué el programa encaja con su objetivo y su historial.',
    STYLE,
    '',
    ...describeHistory(ctx),
    '',
    ...describeCatalog(catalog),
  ].join('\n')
}

export async function generateProgram(
  ctx: TrainingContext,
  req: ProgramRequest,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<AiProgram> {
  const catalog = programCatalog(ctx, req.place)
  const raw = await generateJson<Record<string, unknown>>(
    [{ text: programPrompt(ctx, req, catalog) }],
    PROGRAM_SCHEMA,
    apiKey,
    model,
    signal,
  )
  return parseProgram(raw, new Set(catalog.map((e) => e.id!)))
}

export async function reviseProgram(
  ctx: TrainingContext,
  req: ProgramRequest,
  program: AiProgram,
  change: ChangeRequest,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<AiProgram> {
  const catalog = programCatalog(ctx, req.place)
  const byId = new Map(ctx.catalog.map((e) => [e.id!, e]))
  const prompt = [
    programPrompt(ctx, req, catalog),
    '',
    'Ya le propusiste este programa:',
    `${program.name}. ${program.summary}`,
    ...program.days.flatMap((d) => describeRoutine(d, byId)),
    '',
    describeChange(change),
    'Aplica lo que pide y devuelve el programa completo actualizado. Mantén lo que no pida cambiar. ' +
      'Si lo que pide es mala idea para su objetivo o su salud, hazlo de la forma más segura posible y explícalo en summary.',
  ].join('\n')
  const raw = await generateJson<Record<string, unknown>>(await requestParts(prompt, change), PROGRAM_SCHEMA, apiKey, model, signal)
  return parseProgram(raw, new Set(catalog.map((e) => e.id!)))
}
