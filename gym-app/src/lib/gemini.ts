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

function buildPrompt(note: string): string {
  return [
    'Eres un nutricionista. Analiza la foto de este plato de comida.',
    'Identifica cada alimento visible y estima su peso en gramos, sus kcal, proteína, carbohidratos y grasa.',
    'Ten en cuenta el aceite, mantequilla o salsas que se vean, aunque sea en pequeña cantidad.',
    'Usa raciones realistas según el tamaño del plato y los cubiertos. Responde en español.',
    'Si la foto no contiene comida, devuelve items vacío.',
    note.trim() ? `Nota del usuario sobre el plato (úsala, es más fiable que la foto): ${note.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
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

async function request(path: string, apiKey: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/${path}`, {
      ...init,
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    })
  } catch {
    throw new Error('Sin conexión. Revisa tu internet o añade la comida a mano.')
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

export async function analyzeFoodPhoto(
  image: Blob,
  note: string,
  apiKey: string,
  model: string,
): Promise<FoodAnalysis> {
  if (!apiKey) throw new Error('Falta la clave de Gemini. Añádela en Ajustes.')

  const data = await blobToBase64(image)
  const response = await request(`models/${encodeURIComponent(model)}:generateContent`, apiKey, {
    method: 'POST',
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildPrompt(note) }, { inlineData: { mimeType: image.type || 'image/jpeg', data } }],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: FOOD_SCHEMA },
      store: false,
    }),
  })
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
  if (items.length === 0) throw new Error('No se reconoció comida en la foto.')

  return { dishName: String(parsed.dishName ?? '').trim() || items[0].name, items }
}

// Checks the key and model without spending generation quota.
export async function testGeminiKey(apiKey: string, model: string): Promise<void> {
  if (!apiKey) throw new Error('Pega primero la clave.')
  const response = await request(`models/${encodeURIComponent(model)}`, apiKey)
  if (!response.ok) throw new Error(await readErrorMessage(response))
}
