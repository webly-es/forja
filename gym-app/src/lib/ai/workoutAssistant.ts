import type { Exercise, Profile, RoutineItem, SetLog } from '../../types'
import { GOAL_LABELS, getAge } from '../metrics'
import { equipmentOf } from '../equipment'
import { formatPrescription } from '../prescription'
import { STYLE, type ChangeRequest } from './routineCoach'
import { generateJson, mediaPart, type GeminiPart } from './geminiClient'

export interface CoachQuestion {
  profile: Profile
  exercise: Exercise
  plan?: RoutineItem
  todaySets: SetLog[]
  routineExerciseIds: number[] // what's already in today's workout
  catalog: Exercise[]
}

export interface CoachAlternative {
  exerciseId: number
  reason: string
}

export interface CoachAnswer {
  answer: string
  alternatives: CoachAlternative[]
}

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', description: 'Respuesta directa, como mucho 3 frases' },
    alternatives: {
      type: 'array',
      description: 'De 0 a 3 ejercicios del catálogo para sustituir al actual, solo si hace falta sustituirlo',
      items: {
        type: 'object',
        properties: {
          exerciseId: { type: 'number' },
          reason: { type: 'string', description: 'Por qué este, una frase corta' },
        },
        required: ['exerciseId', 'reason'],
      },
    },
  },
  required: ['answer', 'alternatives'],
}

const kg = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

function buildPrompt(q: CoachQuestion, question: ChangeRequest): string {
  const { profile, exercise, plan, todaySets } = q
  const inWorkout = new Set(q.routineExerciseIds)
  const prescription = plan ? formatPrescription(plan) : null
  return [
    'Eres un entrenador personal en la sala, al lado de la persona, a mitad de su entrenamiento. Responde rápido y al grano.',
    `Persona: ${profile.sex === 'M' ? 'hombre' : 'mujer'}, ${getAge(profile.birthDate)} años, ${profile.weightKg} kg. Objetivo: ${GOAL_LABELS[profile.goal]}.`,
    `Ejercicio actual: [id ${exercise.id}] ${exercise.name} (${exercise.muscleGroup}, ${equipmentOf(exercise.name) ?? 'material sin indicar'}).`,
    prescription ? `Objetivo de la rutina: ${prescription}.` : 'Sin series ni repeticiones fijadas en la rutina.',
    todaySets.length
      ? `Series de hoy: ${todaySets.map((s) => `${kg(s.weightKg)}×${s.reps}`).join(', ')}.`
      : 'Aún no ha hecho series de este ejercicio hoy.',
    '',
    question.audio ? 'Su pregunta está en el audio adjunto (puede haber ruido de gimnasio).' : `Su pregunta: "${question.text?.trim() ?? ''}"`,
    '',
    'Si necesita sustituir el ejercicio (máquina ocupada, no hay material, molestia o dolor, no le gusta), propone de 1 a 3 alternativas del catálogo ' +
      'que trabajen el mismo músculo con un patrón parecido, que no estén ya en su entrenamiento de hoy y, si hay molestia, que no carguen la zona. ' +
      'Si es una pregunta de técnica, peso o repeticiones, responde y deja alternatives vacío.',
    'Si describe dolor agudo, punzante o que no se va, dile que pare ese ejercicio y que lo consulte con un profesional si persiste.',
    'En answer puedes dar el peso orientativo para empezar la alternativa si se deduce de lo que mueve hoy.',
    STYLE,
    '',
    'Catálogo (id | nombre | grupo | material); los marcados con * ya están en su entrenamiento de hoy:',
    ...q.catalog.map((e) => `${e.id} | ${e.name} | ${e.muscleGroup} | ${equipmentOf(e.name) ?? 'sin indicar'}${inWorkout.has(e.id!) ? ' *' : ''}`),
  ].join('\n')
}

export async function askCoach(
  q: CoachQuestion,
  question: ChangeRequest,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<CoachAnswer> {
  const parts: GeminiPart[] = [{ text: buildPrompt(q, question) }]
  if (question.audio) parts.push(await mediaPart(question.audio, 'audio/wav'))
  const raw = await generateJson<{ answer?: string; alternatives?: Array<Record<string, unknown>> }>(
    parts,
    ANSWER_SCHEMA,
    apiKey,
    model,
    signal,
  )
  const answer = String(raw.answer ?? '').trim()
  if (!answer) throw new Error('La IA no devolvió una respuesta. Inténtalo otra vez.')
  const allowed = new Set(q.catalog.map((e) => e.id!).filter((id) => id !== q.exercise.id && !q.routineExerciseIds.includes(id)))
  const alternatives: CoachAlternative[] = []
  for (const alt of raw.alternatives ?? []) {
    const exerciseId = Number(alt.exerciseId)
    if (!allowed.has(exerciseId) || alternatives.some((a) => a.exerciseId === exerciseId)) continue
    alternatives.push({ exerciseId, reason: String(alt.reason ?? '').trim() })
  }
  return { answer, alternatives: alternatives.slice(0, 3) }
}
