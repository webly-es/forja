import type { TrainingReport } from '../../types'
import type { TrainingReportData } from '../../db/trainingReport'
import { MUSCLE_GROUPS } from '../muscleGroups'
import { formatPrescription } from '../prescription'
import { describeHistory, describePerson, STYLE } from './routineCoach'
import { generateJson } from './geminiClient'

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Diagnóstico general, 2 o 3 frases' },
    good: { type: 'array', items: { type: 'string' }, description: 'De 1 a 3 cosas que van bien' },
    problems: {
      type: 'array',
      description: 'De 1 a 4 motivos por los que no progresa o progresa menos, del más importante al menos',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'El problema en pocas palabras' },
          detail: { type: 'string', description: 'Por qué lo dices, con los datos, 1 o 2 frases' },
        },
        required: ['title', 'detail'],
      },
    },
    actions: {
      type: 'array',
      description: 'Exactamente 3 acciones concretas para las próximas semanas',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          routineId: { type: 'number', description: 'Id de la rutina a la que se refiere, si se refiere a una' },
        },
        required: ['text'],
      },
    },
  },
  required: ['summary', 'good', 'problems', 'actions'],
}

const shortDate = (key: string) => new Date(`${key}T12:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' })
const kg = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

function describeWeeks({ weeks, weeklyGoal }: TrainingReportData): string[] {
  const lines = [`Objetivo de días de entreno por semana: ${weeklyGoal}. Semana a semana (la última está en curso):`]
  for (const w of weeks) {
    const muscles = MUSCLE_GROUPS.filter((g) => w.setsByMuscle[g]).map((g) => `${g} ${w.setsByMuscle[g]}`)
    lines.push(
      `- Semana del ${shortDate(w.weekStart)}: ${w.strength} de fuerza, ${w.cardio} de cardio` +
        (muscles.length ? `. Series: ${muscles.join(', ')}` : ''),
    )
  }
  return lines
}

function describeBody({ balance, weights }: TrainingReportData): string[] {
  const lines: string[] = []
  if (balance.length === 0) {
    lines.push('Sin comidas registradas en las últimas 4 semanas.')
  } else {
    const avgIn = Math.round(balance.reduce((s, d) => s + d.consumed, 0) / balance.length)
    const avgOut = Math.round(balance.reduce((s, d) => s + d.spent, 0) / balance.length)
    const diff = avgIn - avgOut
    lines.push(
      `Comida registrada ${balance.length} de los últimos 28 días: media ${avgIn} kcal ingeridas y ${avgOut} gastadas (${diff >= 0 ? '+' : ''}${diff} kcal/día).`,
    )
  }
  if (weights.length >= 2) {
    const first = weights[0]
    const last = weights[weights.length - 1]
    lines.push(`Peso: ${kg(first.value)} kg (${shortDate(first.date.slice(0, 10))}) → ${kg(last.value)} kg (${shortDate(last.date.slice(0, 10))}).`)
  } else {
    lines.push(weights.length === 1 ? `Un solo registro de peso: ${kg(weights[0].value)} kg.` : 'Sin registros de peso recientes.')
  }
  return lines
}

function describeRoutines(data: TrainingReportData): string[] {
  const byId = new Map(data.ctx.catalog.map((e) => [e.id!, e]))
  const used = new Map<number, number>()
  for (const s of data.ctx.sessions) used.set(s.routineId, (used.get(s.routineId) ?? 0) + 1)
  return [
    'Sus rutinas (id, nombre, veces hecha en el periodo, ejercicios):',
    ...data.routines.map(
      (r) =>
        `- [rutina ${r.id}] ${r.name}, ${used.get(r.id!) ?? 0} veces: ` +
        r.items.map((i) => `${byId.get(i.exerciseId)?.name ?? '?'}${formatPrescription(i) ? ` (${formatPrescription(i)})` : ''}`).join('; '),
    ),
  ]
}

export function buildReportPrompt(data: TrainingReportData): string {
  return [
    `Eres un entrenador personal de musculación. Analiza las últimas ${data.weeks.length} semanas de entrenamiento de esta persona ` +
      'y explícale con franqueza qué está haciendo bien, qué está mal y por qué no progresa (o progresa menos de lo que podría).',
    ...describePerson(data.ctx),
    '',
    'Revisa con los datos: constancia frente a su objetivo semanal, volumen semanal por músculo (lo razonable son 10-20 series por músculo grande), ' +
      'músculos olvidados o descompensados, ejercicios estancados (3 o más sesiones sin mejorar), si la comida acompaña a su objetivo ' +
      'y si el peso va en la dirección buena. No te inventes datos: si falta información (por ejemplo, comida sin registrar), dilo como problema solo si impide valorar algo importante.',
    'Las acciones deben ser concretas y realizables ("sube a 4 series el hip thrust", "entrena 3 días fijos: lunes, miércoles y viernes"). Si una se refiere a una rutina, indica su routineId.',
    STYLE,
    '',
    ...describeWeeks(data),
    '',
    ...describeBody(data),
    '',
    ...describeRoutines(data),
    '',
    ...describeHistory(data.ctx),
  ].join('\n')
}

export async function analyzeTraining(
  data: TrainingReportData,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<TrainingReport> {
  if (data.ctx.sessions.length === 0) throw new Error('Aún no hay entrenamientos de fuerza en las últimas semanas para analizar.')
  const raw = await generateJson<{
    summary?: string
    good?: unknown[]
    problems?: Array<Record<string, unknown>>
    actions?: Array<Record<string, unknown>>
  }>([{ text: buildReportPrompt(data) }], REPORT_SCHEMA, apiKey, model, signal)

  const summary = String(raw.summary ?? '').trim()
  if (!summary) throw new Error('La IA no devolvió un análisis válido. Inténtalo otra vez.')
  const routineIds = new Set(data.routines.map((r) => r.id!))
  return {
    profileId: data.ctx.profile.id!,
    createdAt: new Date().toISOString(),
    weeks: data.weeks.length,
    summary,
    good: (raw.good ?? []).map((g) => String(g).trim()).filter(Boolean).slice(0, 3),
    problems: (raw.problems ?? [])
      .map((p) => ({ title: String(p.title ?? '').trim(), detail: String(p.detail ?? '').trim() }))
      .filter((p) => p.title)
      .slice(0, 4),
    actions: (raw.actions ?? [])
      .map((a) => ({
        text: String(a.text ?? '').trim(),
        routineId: routineIds.has(Number(a.routineId)) ? Number(a.routineId) : undefined,
      }))
      .filter((a) => a.text)
      .slice(0, 3),
  }
}
