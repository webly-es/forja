import type { ExerciseAdvice, ExerciseTrend, WorkoutReview } from '../../types'
import type { SessionHistory } from '../../db/workoutReviews'
import { GOAL_LABELS, getAge } from '../metrics'
import { describeExerciseHistory } from '../workoutHistory'
import { generateJson } from './geminiClient'

const REP_RANGE = { min: 8, max: 12 }
const TRENDS: ExerciseTrend[] = ['up', 'flat', 'down', 'new']

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Valoración general de la sesión, 1 o 2 frases' },
    highlights: { type: 'array', items: { type: 'string' }, description: 'De 1 a 3 puntos clave, cortos' },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          exerciseId: { type: 'number' },
          trend: { type: 'string', enum: TRENDS },
          comment: { type: 'string', description: 'Una frase con el porqué de la recomendación' },
          nextWeightKg: { type: 'number' },
          nextReps: { type: 'number' },
        },
        required: ['exerciseId', 'trend', 'comment', 'nextWeightKg', 'nextReps'],
      },
    },
  },
  required: ['summary', 'highlights', 'exercises'],
}

function buildPrompt({ profile, session, exercises }: SessionHistory): string {
  return [
    'Eres un entrenador personal de musculación. Analiza la sesión de hoy comparándola con las anteriores de cada ejercicio.',
    `Persona: ${profile.sex === 'M' ? 'hombre' : 'mujer'}, ${getAge(profile.birthDate)} años, ${profile.weightKg} kg. ` +
      `Objetivo: ${GOAL_LABELS[profile.goal]}. Rutina de hoy: ${session.routineName}.`,
    `Trabaja con doble progresión en un rango de ${REP_RANGE.min}-${REP_RANGE.max} repeticiones:`,
    `- Si hoy todas las series llegaron a ${REP_RANGE.max} repeticiones o más, sube el peso el incremento mínimo habitual (2,5 kg en máquina o barra, 1-2 kg por mancuerna) y vuelve a ${REP_RANGE.min}-${REP_RANGE.min + 2} repeticiones.`,
    '- Si no, mantén el peso y propone una o dos repeticiones más que la mejor serie de hoy, sin pasar del tope del rango.',
    '- Si lleva 2 o más sesiones sin superar su mejor marca o hoy rindió claramente peor, mantén o baja un poco el peso y dilo con tacto (descanso, sueño, comida).',
    '- Si es la primera vez, usa trend "new" y propone repetir el peso de hoy buscando completar el rango.',
    'trend: "up" si hoy mejoró, "flat" si igual, "down" si empeoró, "new" si no hay historial.',
    'nextWeightKg y nextReps son el objetivo de la primera serie efectiva de la próxima sesión.',
    'Usa los exerciseId exactos de la lista.',
    'Escribe en español de España con tildes y ortografía correctas, tuteando siempre (nunca de usted). Tono serio, directo y breve, sin emojis ni exclamaciones.',
    '',
    'Datos (peso×repeticiones por serie, de la más reciente a la más antigua):',
    ...exercises.map(describeExerciseHistory),
  ].join('\n')
}

const roundToHalf = (n: number) => Math.round(n * 2) / 2

export async function reviewWorkout(
  history: SessionHistory,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<WorkoutReview> {
  if (history.exercises.length === 0) throw new Error('No hay series registradas en esta sesión.')

  const parsed = await generateJson<{
    summary?: string
    highlights?: unknown[]
    exercises?: Array<Record<string, unknown>>
  }>([{ text: buildPrompt(history) }], REVIEW_SCHEMA, apiKey, model, signal)

  const byId = new Map(history.exercises.map((h) => [h.exercise.id!, h]))
  const exercises: ExerciseAdvice[] = []
  for (const item of parsed.exercises ?? []) {
    const known = byId.get(Number(item.exerciseId))
    if (!known) continue
    const trend = TRENDS.includes(item.trend as ExerciseTrend) ? (item.trend as ExerciseTrend) : 'flat'
    exercises.push({
      exerciseId: known.exercise.id!,
      exerciseName: known.exercise.name,
      trend,
      comment: String(item.comment ?? '').trim(),
      nextWeightKg: Math.max(0, roundToHalf(Number(item.nextWeightKg) || 0)),
      nextReps: Math.max(0, Math.round(Number(item.nextReps) || 0)),
    })
  }
  if (exercises.length === 0) throw new Error('La IA no devolvió un análisis válido. Inténtalo otra vez.')

  // Keep the routine's order rather than whatever order the model used.
  const order = history.exercises.map((h) => h.exercise.id!)
  exercises.sort((a, b) => order.indexOf(a.exerciseId) - order.indexOf(b.exerciseId))

  return {
    sessionId: history.session.id!,
    profileId: history.profile.id!,
    summary: String(parsed.summary ?? '').trim(),
    highlights: (parsed.highlights ?? []).map((h) => String(h).trim()).filter(Boolean).slice(0, 3),
    exercises,
    createdAt: new Date().toISOString(),
  }
}
