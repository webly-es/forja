import type { AiRoutine, AiRoutineItem, RoutineDraft } from '../../types'
import type { Prescription, RoutineAction } from '../routineDiff'
import type { TrainingContext } from '../../db/routineContext'
import { generateJson } from './geminiClient'
import {
  clampInt,
  describeCatalog,
  describeChange,
  describeHistory,
  describePerson,
  describeRoutine,
  designRules,
  ITEM_SCHEMA,
  parseItems,
  requestParts,
  STYLE,
  type ChangeRequest,
} from './routineCoach'

// Analysis of a routine the person built, and changes to it on request.

const ACTION_TYPES = ['add', 'remove', 'replace', 'reorder', 'prescription'] as const

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', description: 'Valoración general de la rutina, 2 o 3 frases' },
    strengths: { type: 'array', items: { type: 'string' }, description: 'De 1 a 3 cosas que están bien, cortas' },
    suggestions: {
      type: 'array',
      description: 'De 0 a 5 mejoras, de la más importante a la menos',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'La mejora en pocas palabras' },
          detail: { type: 'string', description: 'Por qué, una o dos frases' },
          action: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ACTION_TYPES },
              exerciseId: { type: 'number', description: 'Ejercicio de la rutina afectado (remove, replace, reorder, prescription)' },
              newExerciseId: { type: 'number', description: 'Ejercicio del catálogo que entra (add, replace)' },
              position: { type: 'number', description: 'Posición 1-based donde queda (add, reorder)' },
              sets: { type: 'number' },
              repMin: { type: 'number' },
              repMax: { type: 'number' },
              restSeconds: { type: 'number' },
            },
            required: ['type'],
          },
        },
        required: ['title', 'detail', 'action'],
      },
    },
  },
  required: ['verdict', 'strengths', 'suggestions'],
}

export interface RoutineSuggestion {
  title: string
  detail: string
  action: RoutineAction | null // null when the model's action didn't make sense
}

export interface RoutineAnalysis {
  verdict: string
  strengths: string[]
  suggestions: RoutineSuggestion[]
}

function parsePrescription(raw: Record<string, unknown>): Prescription | undefined {
  if (raw.sets == null && raw.repMin == null && raw.restSeconds == null) return undefined
  const repMin = clampInt(raw.repMin, 1, 30, 8)
  return {
    sets: clampInt(raw.sets, 1, 8, 3),
    repMin,
    repMax: Math.max(repMin, clampInt(raw.repMax, 1, 30, repMin)),
    restSeconds: Math.round(clampInt(raw.restSeconds, 30, 300, 90) / 15) * 15,
  }
}

function parseAction(raw: unknown, inRoutine: Set<number>, known: Set<number>): RoutineAction | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  const exerciseId = Number(a.exerciseId)
  const newExerciseId = Number(a.newExerciseId)
  const position = Number(a.position) >= 1 ? Math.round(Number(a.position)) : undefined
  const prescription = parsePrescription(a)
  switch (a.type) {
    case 'add':
      return known.has(newExerciseId) ? { type: 'add', newExerciseId, position, prescription } : null
    case 'remove':
      return inRoutine.has(exerciseId) ? { type: 'remove', exerciseId } : null
    case 'replace':
      return inRoutine.has(exerciseId) && known.has(newExerciseId) ? { type: 'replace', exerciseId, newExerciseId, prescription } : null
    case 'reorder':
      return inRoutine.has(exerciseId) && position ? { type: 'reorder', exerciseId, position } : null
    case 'prescription':
      return inRoutine.has(exerciseId) && prescription ? { type: 'prescription', exerciseId, prescription } : null
    default:
      return null
  }
}

function routineBlock(ctx: TrainingContext, draft: RoutineDraft, others: RoutineDraft[]): string[] {
  const byId = new Map(ctx.catalog.map((e) => [e.id!, e]))
  const asAi = (d: RoutineDraft): AiRoutine => ({ name: d.name || 'Sin nombre', focus: '', items: d.items })
  const rest = others.filter((o) => draft.id == null || o.id !== draft.id)
  return [
    'La rutina a revisar (en orden):',
    ...describeRoutine(asAi(draft), byId),
    ...(rest.length
      ? ['', 'Sus otras rutinas, para valorar el reparto semanal (no las cambies):', ...rest.flatMap((o) => describeRoutine(asAi(o), byId))]
      : []),
  ]
}

export async function analyzeRoutine(
  ctx: TrainingContext,
  draft: RoutineDraft,
  others: RoutineDraft[],
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<RoutineAnalysis> {
  const prompt = [
    'Eres un entrenador personal de musculación. Revisa una rutina que la persona ha creado ella misma y dile qué mejorar.',
    ...describePerson(ctx),
    '',
    ...routineBlock(ctx, draft, others),
    '',
    'Valora: equilibrio entre músculos y entre empuje y tirón, ejercicios redundantes, orden (básicos antes que aislamiento), ' +
      'volumen por sesión y semanal teniendo en cuenta sus otras rutinas, series y repeticiones para su objetivo, y ejercicios estancados según su historial.',
    ...designRules(ctx),
    'Cada sugerencia lleva una sola acción concreta que se pueda aplicar:',
    '- add: añade newExerciseId en position, con sets, repMin, repMax y restSeconds.',
    '- remove: quita exerciseId.',
    '- replace: cambia exerciseId por newExerciseId (con su prescripción si conviene otra).',
    '- reorder: mueve exerciseId a position.',
    '- prescription: cambia sets, repMin, repMax y restSeconds de exerciseId.',
    'Si la rutina ya está bien, dilo y devuelve pocas o ninguna sugerencia; no inventes cambios por cambiar.',
    STYLE,
    '',
    ...describeHistory(ctx),
    '',
    ...describeCatalog(ctx.catalog),
  ].join('\n')

  const raw = await generateJson<{ verdict?: string; strengths?: unknown[]; suggestions?: Array<Record<string, unknown>> }>(
    [{ text: prompt }],
    ANALYSIS_SCHEMA,
    apiKey,
    model,
    signal,
  )
  const verdict = String(raw.verdict ?? '').trim()
  if (!verdict) throw new Error('La IA no devolvió un análisis válido. Inténtalo otra vez.')
  const inRoutine = new Set(draft.items.map((i) => i.exerciseId))
  const known = new Set(ctx.catalog.map((e) => e.id!))
  return {
    verdict,
    strengths: (raw.strengths ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 3),
    suggestions: (raw.suggestions ?? []).slice(0, 5).map((s) => ({
      title: String(s.title ?? '').trim(),
      detail: String(s.detail ?? '').trim(),
      action: parseAction(s.action, inRoutine, known),
    })),
  }
}

const REVISION_SCHEMA = {
  type: 'object',
  properties: {
    explanation: { type: 'string', description: 'Qué has cambiado y por qué, 1 o 2 frases' },
    exercises: { type: 'array', items: ITEM_SCHEMA },
  },
  required: ['explanation', 'exercises'],
}

export interface RoutineRevision {
  explanation: string
  items: AiRoutineItem[]
}

export async function reviseRoutine(
  ctx: TrainingContext,
  draft: RoutineDraft,
  others: RoutineDraft[],
  change: ChangeRequest,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<RoutineRevision> {
  const prompt = [
    'Eres un entrenador personal de musculación. La persona quiere cambiar una de sus rutinas.',
    ...describePerson(ctx),
    '',
    ...routineBlock(ctx, draft, others),
    '',
    describeChange(change),
    'Devuelve la rutina completa ya cambiada, en orden, con sets, repMin, repMax y restSeconds de cada ejercicio. ' +
      'Mantén igual todo lo que no pida cambiar (incluida la prescripción que ya tenga). ' +
      'Si lo que pide es mala idea para su objetivo o su salud, hazlo de la forma más segura posible y explícalo.',
    ...designRules(ctx),
    STYLE,
    '',
    ...describeHistory(ctx),
    '',
    ...describeCatalog(ctx.catalog),
  ].join('\n')
  const raw = await generateJson<{ explanation?: string; exercises?: unknown }>(
    await requestParts(prompt, change),
    REVISION_SCHEMA,
    apiKey,
    model,
    signal,
  )
  const items = parseItems(raw.exercises, new Set(ctx.catalog.map((e) => e.id!)))
  if (items.length === 0) throw new Error('La IA no devolvió una rutina válida. Inténtalo otra vez.')
  return { explanation: String(raw.explanation ?? '').trim(), items }
}
