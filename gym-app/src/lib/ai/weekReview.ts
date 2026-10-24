import type { AiRoutine, RoutineDraft, RoutineSuggestion } from '../../types'
import type { TrainingContext } from '../../db/routineContext'
import { routineFingerprint } from '../routineDiff'
import { SKIP_REASON_LABELS } from '../sessionIncidents'
import type { SkipPattern } from '../skipPatterns'
import { generateJson } from './geminiClient'
import { describeCatalog, describeHistory, describePerson, describeRoutine, designRules, STYLE } from './routineCoach'
import { ACTION_SCHEMA, parseAction } from './routineAnalysis'

// The whole week at once: every routine of the profile, how often each one is done and what gets
// left out, so the coach can balance them against each other. Each change touches one routine.

export interface WeekReviewData {
  ctx: TrainingContext
  weeklyGoal: number
  routines: RoutineDraft[] // normal routines only (no ladder circuits)
  skips: SkipPattern[]
}

export interface WeekSuggestion extends RoutineSuggestion {
  routineId: number
}

export interface WeekReview {
  verdict: string
  strengths: string[]
  suggestions: WeekSuggestion[]
}

const MAX_SUGGESTIONS = 6

const SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', description: 'Valoración de la semana completa, 2 o 3 frases' },
    strengths: { type: 'array', items: { type: 'string' }, description: 'De 1 a 3 cosas que están bien, cortas' },
    suggestions: {
      type: 'array',
      description: `De 0 a ${MAX_SUGGESTIONS} mejoras, de la más importante a la menos; vacío si la semana ya está bien`,
      items: {
        type: 'object',
        properties: {
          routineId: { type: 'number', description: 'Id de la rutina que cambia' },
          title: { type: 'string', description: 'La mejora en pocas palabras' },
          detail: { type: 'string', description: 'Por qué, pensando en la semana entera, una o dos frases' },
          action: ACTION_SCHEMA,
        },
        required: ['routineId', 'title', 'detail', 'action'],
      },
    },
  },
  required: ['verdict', 'strengths', 'suggestions'],
}

function describeRoutines({ ctx, routines }: WeekReviewData): string[] {
  const byId = new Map(ctx.catalog.map((e) => [e.id!, e]))
  const used = new Map<number, number>()
  for (const s of ctx.sessions) used.set(s.routineId, (used.get(s.routineId) ?? 0) + 1)
  return routines.flatMap((r) => {
    const asAi: AiRoutine = { name: `[rutina ${r.id}] ${r.name}`, focus: `hecha ${used.get(r.id!) ?? 0} veces`, items: r.items }
    const review = r.aiReview
    const previous = review
      ? [
          `  Tu opinión anterior${review.fingerprint === routineFingerprint(r.items) ? '' : ' (luego la ha modificado)'}: ${review.verdict}`,
          ...(review.applied.length ? [`  Cambios que ya aplicó por tu consejo: ${review.applied.join('; ')}`] : []),
        ]
      : []
    return [...describeRoutine(asAi, byId), ...previous, '']
  })
}

function describeSkips({ ctx, skips }: WeekReviewData): string[] {
  if (skips.length === 0) return []
  const byId = new Map(ctx.catalog.map((e) => [e.id!, e]))
  return [
    'Ejercicios que suele dejar sin hacer (veces / sesiones, motivo):',
    ...skips.map(
      (p) => `- ${byId.get(p.exerciseId)?.name ?? '?'} (rutina ${p.routineId}): ${p.skips} de ${p.sessions}, ${SKIP_REASON_LABELS[p.reason].toLowerCase()}.`,
    ),
    '',
  ]
}

export function buildWeekPrompt(data: WeekReviewData): string {
  return [
    'Eres un entrenador personal de musculación. Revisa todas sus rutinas juntas, como una semana de entrenamiento, y dile qué cambiar.',
    ...describePerson(data.ctx),
    `Quiere entrenar ${data.weeklyGoal} días por semana.`,
    '',
    'Sus rutinas (en orden; ten en cuenta cuántas veces hace cada una de verdad):',
    ...describeRoutines(data),
    ...describeSkips(data),
    'Valora la semana completa: series semanales por músculo (10-20 en los grandes) contando cuántas veces hace cada rutina, ' +
      'músculos olvidados o repetidos en días seguidos, equilibrio entre empuje y tirón, rutinas demasiado largas para lo que realmente completa, ' +
      'ejercicios que se salta y ejercicios estancados según su historial.',
    ...designRules(data.ctx),
    'Cada sugerencia cambia una sola rutina (routineId) con una sola acción concreta:',
    '- add: añade newExerciseId en position, con sets, repMin, repMax y restSeconds.',
    '- remove: quita exerciseId.',
    '- replace: cambia exerciseId por newExerciseId (con su prescripción si conviene otra).',
    '- reorder: mueve exerciseId a position.',
    '- prescription: cambia sets, repMin, repMax y restSeconds de exerciseId.',
    'Propón solo cambios que mejoren claramente la semana para su objetivo, nunca gustos personales ni ejercicios equivalentes. ' +
      'Sé coherente con tus opiniones anteriores: no deshagas cambios que ya aplicó por tu consejo. Si la semana está bien, dilo y no sugieras nada.',
    STYLE,
    '',
    ...describeHistory(data.ctx),
    '',
    ...describeCatalog(data.ctx.catalog),
  ].join('\n')
}

export async function reviewWeek(data: WeekReviewData, apiKey: string, model: string, signal?: AbortSignal): Promise<WeekReview> {
  if (data.routines.length === 0) throw new Error('Aún no tienes rutinas que revisar.')
  const raw = await generateJson<{ verdict?: string; strengths?: unknown[]; suggestions?: Array<Record<string, unknown>> }>(
    [{ text: buildWeekPrompt(data) }],
    SCHEMA,
    apiKey,
    model,
    signal,
  )
  const verdict = String(raw.verdict ?? '').trim()
  if (!verdict) throw new Error('La IA no devolvió un análisis válido. Inténtalo otra vez.')
  const known = new Set(data.ctx.catalog.map((e) => e.id!))
  const routines = new Map(data.routines.map((r) => [r.id!, r]))
  return {
    verdict,
    strengths: (raw.strengths ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 3),
    suggestions: (raw.suggestions ?? []).flatMap((s) => {
      const routine = routines.get(Number(s.routineId))
      const title = String(s.title ?? '').trim()
      if (!routine || !title) return []
      const inRoutine = new Set(routine.items.map((i) => i.exerciseId))
      return [{ routineId: routine.id!, title, detail: String(s.detail ?? '').trim(), action: parseAction(s.action, inRoutine, known) }]
    }).slice(0, MAX_SUGGESTIONS),
  }
}
