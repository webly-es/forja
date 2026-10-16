import { generateJson, mediaPart, toPositiveInt, type GeminiPart } from './geminiClient'

export interface ActivityItem {
  name: string
  minutes: number
  met: number
}

export interface ActivityInput {
  text?: string
  audio?: Blob
}

const ACTIVITY_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre corto de la actividad en español, con su intensidad si se indica' },
          minutes: { type: 'number', description: 'Duración total en minutos' },
          met: { type: 'number', description: 'MET del Compendium of Physical Activities' },
        },
        required: ['name', 'minutes', 'met'],
      },
    },
  },
  required: ['items'],
}

function buildPrompt({ text, audio }: ActivityInput): string {
  return [
    'Eres un fisiólogo del ejercicio. El usuario describe la actividad física que ha hecho' +
      (audio ? ' en este audio.' : ':'),
    audio ? 'Escucha el audio con atención (puede tener ruido de fondo).' : `"${text?.trim() ?? ''}"`,
    'Separa cada actividad (deporte, trabajo físico, tareas de casa, paseos…) y devuelve su duración total en minutos.',
    'Interpreta duraciones como "una hora", "hora y media", "8 horas", "media hora" o "de 9 a 2".',
    'Asigna a cada una el MET del Compendium of Physical Activities (2024) que mejor encaje con la intensidad descrita:',
    'por ejemplo correr a ritmo suave ≈ 8, correr rápido ≈ 10-11, limpieza o trabajo de pie moderado ≈ 3,5, trabajo físico intenso ≈ 6.',
    'En jornadas largas (más de 3 horas) usa un MET medio realista que tenga en cuenta pausas y momentos de menos esfuerzo.',
    'Si no indica intensidad, usa la moderada. Si no indica duración, asume una sesión típica de esa actividad.',
    'No incluyas dormir ni estar sentado sin actividad. Responde en español.',
    `Si ${audio ? 'el audio' : 'el texto'} no habla de actividad física, devuelve items vacío.`,
  ].join('\n')
}

export async function analyzeActivity(
  input: ActivityInput,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<ActivityItem[]> {
  const parts: GeminiPart[] = [{ text: buildPrompt(input) }]
  if (input.audio) parts.push(await mediaPart(input.audio, 'audio/wav'))

  const parsed = await generateJson<{ items?: Array<Record<string, unknown>> }>(
    parts,
    ACTIVITY_SCHEMA,
    apiKey,
    model,
    signal,
  )

  const items = (parsed.items ?? [])
    .map((item) => ({
      name: String(item.name ?? '').trim() || 'Actividad',
      minutes: Math.min(24 * 60, toPositiveInt(item.minutes)),
      met: Math.min(20, Math.max(1, Math.round(Number(item.met) * 10) / 10 || 1)),
    }))
    .filter((item) => item.minutes > 0)
  if (items.length === 0) {
    throw new Error(`No se reconoció ninguna actividad en ${input.audio ? 'el audio' : 'el texto'}.`)
  }
  return items
}
