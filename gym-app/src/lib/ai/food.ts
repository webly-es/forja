import type { FoodItem } from '../../types'
import { generateJson, mediaPart, toPositiveInt, type GeminiPart } from './geminiClient'

export interface FoodAnalysis {
  dishName: string
  items: FoodItem[]
}

export interface FoodInput {
  text?: string
  image?: Blob
  audio?: Blob
}

const FOOD_SCHEMA = {
  type: 'object',
  properties: {
    dishName: { type: 'string', description: 'Nombre corto del plato en español' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          proteinG: { type: 'number' },
          carbsG: { type: 'number' },
          fatG: { type: 'number' },
        },
        required: ['name', 'grams', 'kcal', 'proteinG', 'carbsG', 'fatG'],
      },
    },
  },
  required: ['dishName', 'items'],
}

function buildPrompt({ text, image, audio }: FoodInput): string {
  const note = text?.trim() ?? ''
  if (image) {
    return [
      'Eres un nutricionista. Analiza la foto de este plato de comida.',
      'Identifica cada alimento visible y estima su peso en gramos, sus kcal, proteína, carbohidratos y grasa.',
      'Ten en cuenta el aceite, mantequilla o salsas que se vean, aunque sea en pequeña cantidad.',
      'Usa raciones realistas según el tamaño del plato y los cubiertos. Responde en español.',
      'Si la foto no contiene comida, devuelve items vacío.',
      note ? `Nota del usuario sobre el plato (úsala, es más fiable que la foto): ${note}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }
  return [
    'Eres un nutricionista. El usuario describe lo que ha comido' + (audio ? ' en este audio.' : ':'),
    audio ? 'Escucha el audio con atención (puede tener ruido de fondo).' : `"${note}"`,
    'Separa cada alimento y estima su peso en gramos, sus kcal, proteína, carbohidratos y grasa.',
    'Interpreta cantidades y unidades (huevos, rebanadas, cucharadas, vasos, gramos).',
    'Si nombra un producto de marca o de cadena de comida rápida (por ejemplo Whopper o Big Mac), usa sus valores nutricionales oficiales.',
    'Si no indica cantidad, asume una ración normal. Responde en español.',
    `Si ${audio ? 'el audio' : 'el texto'} no habla de comida o bebida, devuelve items vacío.`,
  ].join('\n')
}

export async function analyzeFood(
  input: FoodInput,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<FoodAnalysis> {
  const parts: GeminiPart[] = [{ text: buildPrompt(input) }]
  if (input.image) parts.push(await mediaPart(input.image, 'image/jpeg'))
  else if (input.audio) parts.push(await mediaPart(input.audio, 'audio/wav'))

  const parsed = await generateJson<{ dishName?: string; items?: Array<Record<string, unknown>> }>(
    parts,
    FOOD_SCHEMA,
    apiKey,
    model,
    signal,
  )

  const items: FoodItem[] = (parsed.items ?? []).map((item) => ({
    name: String(item.name ?? '').trim() || 'Alimento',
    grams: toPositiveInt(item.grams),
    kcal: toPositiveInt(item.kcal),
    proteinG: toPositiveInt(item.proteinG),
    carbsG: toPositiveInt(item.carbsG),
    fatG: toPositiveInt(item.fatG),
  }))
  if (items.length === 0) {
    const where = input.image ? 'la foto' : input.audio ? 'el audio' : 'el texto'
    throw new Error(`No se reconoció comida en ${where}.`)
  }

  return { dishName: String(parsed.dishName ?? '').trim() || items[0].name, items }
}
