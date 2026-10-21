import type { FoodConfidence, FoodItem, FoodMemory, FoodQuestion, FoodQuestionOption } from '../../types'
import { applyMemory } from '../foodItems'
import { generateJson, mediaPart, toPositiveInt, type GeminiPart } from './geminiClient'

export interface FoodAnalysis {
  dishName: string
  items: FoodItem[]
  questions: FoodQuestion[]
}

export interface FoodInput {
  text?: string
  image?: Blob
  audio?: Blob
}

const MAX_QUESTIONS = 3
const CONFIDENCE: FoodConfidence[] = ['high', 'medium', 'low']

const ITEM_PROPERTIES = {
  name: { type: 'string' },
  grams: { type: 'number' },
  kcal: { type: 'number' },
  proteinG: { type: 'number' },
  carbsG: { type: 'number' },
  fatG: { type: 'number' },
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
          ...ITEM_PROPERTIES,
          confidence: { type: 'string', enum: CONFIDENCE, description: 'Seguridad sobre la cantidad y los valores de este alimento' },
          note: { type: 'string', description: 'Aclaración breve si hace falta (p. ej. "incluye ~10 g de aceite"), o vacío' },
        },
        required: ['name', 'grams', 'kcal', 'proteinG', 'carbsG', 'fatG', 'confidence'],
      },
    },
    questions: {
      type: 'array',
      description: `De 0 a ${MAX_QUESTIONS} preguntas de un toque, solo si la respuesta cambia el total de forma apreciable`,
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Pregunta corta, p. ej. "¿A la plancha o frito?"' },
          options: {
            type: 'array',
            description: 'De 2 a 4 respuestas; la primera es la que ya asumiste en items y no cambia nada',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: 'Respuesta corta, p. ej. "Frito"' },
                scale: {
                  type: 'array',
                  description: 'Alimentos de items cuya cantidad cambia con esta respuesta',
                  items: {
                    type: 'object',
                    properties: {
                      item: { type: 'number', description: 'Posición del alimento en items, empezando en 0' },
                      factor: { type: 'number', description: 'Multiplicador de su cantidad, p. ej. 0.5 o 1.5' },
                    },
                    required: ['item', 'factor'],
                  },
                },
                add: {
                  type: 'array',
                  description: 'Alimentos que se añaden con esta respuesta (p. ej. el aceite de freír)',
                  items: { type: 'object', properties: ITEM_PROPERTIES, required: ['name', 'grams', 'kcal', 'proteinG', 'carbsG', 'fatG'] },
                },
              },
              required: ['label'],
            },
          },
        },
        required: ['text', 'options'],
      },
    },
  },
  required: ['dishName', 'items', 'questions'],
}

const fmt = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

function describeMemory(memory: FoodMemory[]): string[] {
  if (memory.length === 0) return []
  return [
    'Alimentos habituales de esta persona, con su ración habitual y sus valores por 100 g (los que corrigió ella son exactos):',
    ...memory.map(
      (m) =>
        `- ${m.name}: ración ${m.grams} g; por 100 g ${fmt(m.per100.kcal)} kcal, P ${fmt(m.per100.proteinG)}, C ${fmt(m.per100.carbsG)}, G ${fmt(m.per100.fatG)}${m.corrected ? ' (corregido por ella)' : ''}`,
    ),
    'Si reconoces uno de estos alimentos, usa exactamente ese nombre y sus valores por 100 g; usa su ración habitual si no se ve o no dice otra cantidad.',
  ]
}

const COMMON_RULES = [
  'Para cada alimento indica confidence: high si lo identificas y la cantidad es clara, medium si dudas algo, low si dudas bastante (ingrediente o cantidad).',
  'Pon note solo si aclara algo útil (aceite o salsa incluidos, cocinado supuesto); si no, déjalo vacío.',
  'questions: haz de 0 a 3 preguntas de un toque SOLO sobre dudas que cambien el total en más de unas 80 kcal (frito o a la plancha, aceite, salsa, ración, si se lo comió entero, tipo de leche o pan). ' +
    'La primera opción de cada pregunta es exactamente lo que ya has supuesto en items (sin scale ni add). ' +
    'Las demás opciones llevan su efecto ya calculado: scale para cambiar la cantidad de alimentos de items por su posición (empezando en 0), y add para alimentos que se suman, con sus valores completos. ' +
    'Si no hay dudas importantes, devuelve questions vacío. No preguntes lo que ya dice la nota o la descripción.',
  'Responde en español.',
]

function buildPrompt({ text, image, audio }: FoodInput, memory: FoodMemory[]): string {
  const note = text?.trim() ?? ''
  const intro = image
    ? [
        'Eres un nutricionista experto en estimar comidas por foto. Analiza este plato paso a paso, alimento por alimento.',
        'Para la cantidad usa referencias de escala: un plato llano mide unos 26 cm, un tenedor unos 19 cm, una mano adulta, el vaso o la lata.',
        'Fíjate en el cocinado (frito, rebozado, a la plancha, guisado, crudo) y suma la grasa que eso implica aunque no se vea: aceite de freír o de aliñar, mantequilla, salsas, piel.',
        'Incluye bebidas, pan y salsas que aparezcan. Usa raciones realistas de España.',
        'Si la foto no contiene comida, devuelve items vacío.',
        note ? `Nota de la persona sobre el plato (úsala, es más fiable que la foto): ${note}` : '',
      ]
    : [
        'Eres un nutricionista. La persona describe lo que ha comido' + (audio ? ' en este audio.' : ':'),
        audio ? 'Escucha el audio con atención (puede tener ruido de fondo).' : `"${note}"`,
        'Separa cada alimento y estima su peso en gramos, sus kcal, proteína, carbohidratos y grasa.',
        'Interpreta cantidades y unidades (huevos, rebanadas, cucharadas, vasos, gramos).',
        'Si nombra un producto de marca o de cadena de comida rápida (por ejemplo Whopper o Big Mac), usa sus valores nutricionales oficiales.',
        'Si no indica cantidad, asume una ración normal y considera preguntar por ella.',
        `Si ${audio ? 'el audio' : 'el texto'} no habla de comida o bebida, devuelve items vacío.`,
      ]
  return [...intro, ...COMMON_RULES, ...describeMemory(memory)].filter(Boolean).join('\n')
}

function parseItem(raw: Record<string, unknown>): FoodItem {
  const confidence = CONFIDENCE.includes(raw.confidence as FoodConfidence) ? (raw.confidence as FoodConfidence) : undefined
  const note = String(raw.note ?? '').trim()
  return {
    name: String(raw.name ?? '').trim() || 'Alimento',
    grams: toPositiveInt(raw.grams),
    kcal: toPositiveInt(raw.kcal),
    proteinG: toPositiveInt(raw.proteinG),
    carbsG: toPositiveInt(raw.carbsG),
    fatG: toPositiveInt(raw.fatG),
    ...(confidence ? { confidence } : {}),
    ...(note ? { note } : {}),
  }
}

// Keeps questions whose options make sense against the items: valid positions,
// sane factors, at most two added foods per option and 2 to 4 options.
export function parseQuestions(raw: unknown, itemCount: number): FoodQuestion[] {
  if (!Array.isArray(raw)) return []
  const questions: FoodQuestion[] = []
  for (const q of raw as Array<Record<string, unknown>>) {
    const text = String(q?.text ?? '').trim()
    if (!text || !Array.isArray(q.options)) continue
    const options: FoodQuestionOption[] = []
    for (const o of q.options as Array<Record<string, unknown>>) {
      const label = String(o?.label ?? '').trim()
      if (!label) continue
      const scale = (Array.isArray(o.scale) ? (o.scale as Array<Record<string, unknown>>) : [])
        .map((s) => ({ item: Number(s?.item), factor: Number(s?.factor) }))
        .filter(({ item, factor }) => Number.isInteger(item) && item >= 0 && item < itemCount && factor >= 0.1 && factor <= 3)
      const add = (Array.isArray(o.add) ? (o.add as Array<Record<string, unknown>>) : [])
        .slice(0, 2)
        .map(parseItem)
        .filter((i) => i.kcal > 0)
      options.push({ label, ...(scale.length ? { scale } : {}), ...(add.length ? { add } : {}) })
    }
    if (options.length >= 2) questions.push({ text, options: options.slice(0, 4) })
    if (questions.length === MAX_QUESTIONS) break
  }
  return questions
}

export async function analyzeFood(
  input: FoodInput,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
  memory: FoodMemory[] = [],
): Promise<FoodAnalysis> {
  const parts: GeminiPart[] = [{ text: buildPrompt(input, memory) }]
  if (input.image) parts.push(await mediaPart(input.image, 'image/jpeg'))
  else if (input.audio) parts.push(await mediaPart(input.audio, 'audio/wav'))

  const parsed = await generateJson<{ dishName?: string; items?: Array<Record<string, unknown>>; questions?: unknown }>(
    parts,
    FOOD_SCHEMA,
    apiKey,
    model,
    signal,
  )

  const items = applyMemory((parsed.items ?? []).map(parseItem), memory)
  if (items.length === 0) {
    const where = input.image ? 'la foto' : input.audio ? 'el audio' : 'el texto'
    throw new Error(`No se reconoció comida en ${where}.`)
  }

  return {
    dishName: String(parsed.dishName ?? '').trim() || items[0].name,
    items,
    questions: parseQuestions(parsed.questions, items.length),
  }
}
