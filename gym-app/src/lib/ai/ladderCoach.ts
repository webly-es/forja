import type { Goal, WorkoutReview } from '../../types'
import type { LadderHistory, LadderSummary } from '../../db/ladder'
import { GOAL_LABELS, getAge } from '../metrics'
import { describeRecentContext } from '../workoutHistory'
import { LADDER_REST_OPTIONS, formatClock } from '../ladder'
import { describeCycleContext } from './workoutCoach'
import { generateJson } from './geminiClient'

// A metabolic circuit progresses by density (same work in less time) and load, not by reps.
const GOAL_RULES: Record<Goal, string> = {
  lose:
    'Está en déficit para perder grasa: este circuito le sirve para gastar más y conservar músculo. Prioriza mantener el peso de las mancuernas y la técnica; mejorar el tiempo ya es progreso.',
  recomp:
    'Busca recomposición: progresa con calma, primero en tiempo y luego en peso. Mantener el rendimiento ya es buen resultado.',
  maintain: 'Busca mantener: progresión conservadora, valora la constancia.',
  gain:
    'Está en superávit para ganar músculo: el circuito es un complemento. Puede subir el peso en cuanto complete la escalera con buena técnica.',
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Valoración general del circuito, 1 o 2 frases' },
    highlights: { type: 'array', items: { type: 'string' }, description: 'De 1 a 3 puntos clave, cortos' },
    nextDumbbellKg: { type: 'number', description: 'Peso por mancuerna para la próxima vez' },
    nextRestSeconds: { type: 'number', description: 'Descanso entre rondas para la próxima vez: 45, 60 o 90' },
    comment: { type: 'string', description: 'Una frase con el porqué de la propuesta' },
  },
  required: ['summary', 'highlights', 'nextDumbbellKg', 'nextRestSeconds', 'comment'],
}

const kg = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

function describeLadder(label: string, s: LadderSummary): string {
  const complete = s.roundsDone >= s.startReps
  return [
    `${label}: ${kg(s.dumbbellKg)} kg por mancuerna, escalera desde ${s.startReps}, descanso ${s.restSeconds} s.`,
    `  ${complete ? 'Completa' : `Incompleta (${s.roundsDone} de ${s.startReps} rondas)`}, ${s.doneReps} de ${s.plannedReps} repeticiones, tiempo total ${formatClock(s.seconds)}.`,
    ...(s.shortfalls.length ? [`  Repeticiones que no salieron: ${s.shortfalls.join('; ')}.`] : []),
  ].join('\n')
}

export function buildLadderPrompt({ profile, session, exercises, today, previous, recent, cycle }: LadderHistory): string {
  const cycleLines = cycle ? describeCycleContext(cycle) : []
  return [
    'Eres un entrenador personal. Analiza un circuito metabólico con mancuernas para quemar grasa.',
    `Formato: ${exercises.map((e) => e.name).join(' → ')}, todo seguido sin descanso con las mismas dos mancuernas; ` +
      'descanso entre rondas y una repetición menos cada ronda hasta llegar a 1. El peso lo limita el ejercicio más débil del circuito.',
    `Persona: ${profile.sex === 'M' ? 'hombre' : 'mujer'}, ${getAge(profile.birthDate)} años, ${profile.weightKg} kg. ` +
      `Objetivo: ${GOAL_LABELS[profile.goal]}. Circuito: ${session.routineName}.`,
    GOAL_RULES[profile.goal],
    'Reglas de progresión:',
    '- Si completó todas las repeticiones y el tiempo bajó o se mantuvo respecto a la vez anterior con el mismo peso, propone subir 1 o 2 kg por mancuerna (o bajar el descanso a 45 s si ya descansa 60 s y prefiere no subir peso todavía; elige una de las dos, no ambas).',
    '- Si le faltaron repeticiones o dejó rondas sin hacer, mantén el peso y el descanso.',
    '- Si falló muchas repeticiones o rindió claramente peor, baja 1 o 2 kg por mancuerna y dilo con tacto.',
    '- Si es la primera vez, valora el peso elegido y propone repetirlo buscando bajar el tiempo.',
    '- Recuerda la técnica solo si hay señales de fatiga: espalda neutra en el remo y el peso muerto.',
    'El contexto de comida y peso sirve solo para matizar: menciónalo si explica un rendimiento peor o si comer muy por debajo de lo que gasta compromete su objetivo. Si no hay datos, no supongas nada.',
    'Escribe en español de España con tildes y ortografía correctas, tuteando siempre (nunca de usted). Tono serio, directo y breve, sin emojis ni exclamaciones.',
    '',
    'Contexto de los últimos 7 días:',
    describeRecentContext(recent),
    ...(cycleLines.length ? ['', 'Ciclo y estado del día:', ...cycleLines] : []),
    '',
    'Circuitos (del más reciente al más antiguo):',
    describeLadder('Hoy', today),
    ...previous.map((p, i) => describeLadder(`Anterior ${i + 1} (${new Date(p.date).toLocaleDateString('es')})`, p)),
  ].join('\n')
}

const roundToHalf = (n: number) => Math.round(n * 2) / 2

export async function reviewLadder(
  history: LadderHistory,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<WorkoutReview> {
  if (history.today.doneReps === 0) throw new Error('No hay rondas registradas en este circuito.')

  const parsed = await generateJson<{
    summary?: string
    highlights?: unknown[]
    nextDumbbellKg?: unknown
    nextRestSeconds?: unknown
    comment?: unknown
  }>([{ text: buildLadderPrompt(history) }], REVIEW_SCHEMA, apiKey, model, signal)

  const weight = roundToHalf(Number(parsed.nextDumbbellKg) || 0)
  const rest = Number(parsed.nextRestSeconds) || history.today.restSeconds
  return {
    sessionId: history.session.id,
    profileId: history.profile.id!,
    summary: String(parsed.summary ?? '').trim(),
    highlights: (parsed.highlights ?? []).map((h) => String(h).trim()).filter(Boolean).slice(0, 3),
    exercises: [],
    createdAt: new Date().toISOString(),
    ladder: {
      nextDumbbellKg: weight > 0 ? weight : history.today.dumbbellKg,
      // Snap to the options the setup screen offers.
      nextRestSeconds: LADDER_REST_OPTIONS.reduce((best, c) => (Math.abs(c - rest) < Math.abs(best - rest) ? c : best)),
      comment: String(parsed.comment ?? '').trim(),
    },
  }
}
