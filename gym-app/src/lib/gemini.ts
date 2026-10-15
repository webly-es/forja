import type { FoodItem } from '../types'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export interface FoodAnalysis {
  dishName: string
  items: FoodItem[]
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

export interface FoodInput {
  text?: string
  image?: Blob
  audio?: Blob
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(blob)
  })
}

async function readErrorMessage(response: Response): Promise<string> {
  let detail = ''
  try {
    const body = await response.json()
    const err = Array.isArray(body) ? body[0]?.error : body?.error
    detail = err?.message ?? ''
  } catch {
    // body isn't JSON
  }
  if (response.status === 503 || response.status === 500) {
    return 'Gemini está saturado ahora mismo. Inténtalo de nuevo en unos segundos.'
  }
  if (response.status === 429) {
    return 'Has alcanzado el límite gratuito de Gemini por ahora. Espera un poco o añade la comida a mano.'
  }
  if (response.status === 400 && /api key/i.test(detail)) {
    return 'La clave de Gemini no es válida. Revísala en Ajustes.'
  }
  if (response.status === 403) {
    return 'La clave de Gemini no tiene permiso para este modelo. Revísala en Ajustes.'
  }
  if (response.status === 404) {
    return 'El modelo de Gemini configurado no existe. Revísalo en Ajustes.'
  }
  return detail ? `Error de Gemini: ${detail}` : `Error de Gemini (${response.status})`
}

const GENERATE_TIMEOUT_MS = 20_000
// Fast, reliable fallback when the configured model is overloaded or too slow.
const FALLBACK_MODEL = 'gemini-flash-lite-latest'

class SlowModelError extends Error {}

async function request(path: string, apiKey: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/${path}`, {
      ...init,
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (init?.signal?.aborted) throw err
    throw new Error('Sin conexión. Revisa tu internet o añade la comida a mano.')
  }
}

// One generation attempt, abandoned after GENERATE_TIMEOUT_MS or when the caller cancels.
async function generate(
  model: string,
  apiKey: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController()
  const onCancel = () => controller.abort()
  signal?.addEventListener('abort', onCancel)
  const timer = window.setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)
  try {
    const response = await request(`models/${encodeURIComponent(model)}:generateContent`, apiKey, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    // Read the body inside the timeout too, so a stalled stream can't hang the caller.
    return new Response(await response.text(), { status: response.status })
  } catch (err) {
    if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError')
    if (controller.signal.aborted) throw new SlowModelError('Gemini tarda demasiado ahora mismo. Inténtalo de nuevo.')
    throw err
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onCancel)
  }
}

// Model text lives in candidates[0].content.parts[].text; thought parts
// (if the model thinks) are skipped.
function extractText(body: unknown): string {
  const candidates = (body as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>
  })?.candidates
  return (candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

export async function analyzeFood(
  input: FoodInput,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<FoodAnalysis> {
  if (!apiKey) throw new Error('Falta la clave de Gemini. Añádela en Ajustes.')

  const parts: Array<Record<string, unknown>> = [{ text: buildPrompt(input) }]
  const media = input.image ?? input.audio
  if (media) {
    const fallbackType = input.image ? 'image/jpeg' : 'audio/wav'
    parts.push({ inlineData: { mimeType: media.type || fallbackType, data: await blobToBase64(media) } })
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: FOOD_SCHEMA },
    store: false,
  }
  const fallbackBody = {
    ...body,
    generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingLevel: 'minimal' } },
  }

  // An overloaded or slow model goes straight to the lite model instead of leaving the user waiting.
  let response = await generate(model, apiKey, body, signal).catch((err) => {
    if (err instanceof SlowModelError && model !== FALLBACK_MODEL) return null
    throw err
  })
  if (!response || (model !== FALLBACK_MODEL && (response.status === 503 || response.status === 500))) {
    response = await generate(FALLBACK_MODEL, apiKey, fallbackBody, signal)
  }
  if (!response.ok) throw new Error(await readErrorMessage(response))

  const text = extractText(await response.json())
  let parsed: { dishName?: string; items?: Array<Record<string, unknown>> }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini no devolvió un resultado válido. Inténtalo otra vez.')
  }

  const items: FoodItem[] = (parsed.items ?? []).map((item) => ({
    name: String(item.name ?? '').trim() || 'Alimento',
    grams: toNumber(item.grams),
    kcal: toNumber(item.kcal),
    proteinG: toNumber(item.proteinG),
    carbsG: toNumber(item.carbsG),
    fatG: toNumber(item.fatG),
  }))
  if (items.length === 0) {
    const where = input.image ? 'la foto' : input.audio ? 'el audio' : 'el texto'
    throw new Error(`No se reconoció comida en ${where}.`)
  }

  return { dishName: String(parsed.dishName ?? '').trim() || items[0].name, items }
}

// Checks the key and model without spending generation quota.
export async function testGeminiKey(apiKey: string, model: string): Promise<void> {
  if (!apiKey) throw new Error('Pega primero la clave.')
  const response = await request(`models/${encodeURIComponent(model)}`, apiKey)
  if (!response.ok) throw new Error(await readErrorMessage(response))
}
