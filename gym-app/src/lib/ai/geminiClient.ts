// Generic Gemini access: HTTP, timeouts, model fallback and error messages.
// Feature-specific prompts and schemas live next to this file (food.ts, activity.ts).

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

const GENERATE_TIMEOUT_MS = 20_000
// Fast, reliable fallback when the configured model is overloaded or too slow.
const FALLBACK_MODEL = 'gemini-flash-lite-latest'

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

class SlowModelError extends Error {}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(blob)
  })
}

export async function mediaPart(blob: Blob, fallbackType: string): Promise<GeminiPart> {
  return { inlineData: { mimeType: blob.type || fallbackType, data: await blobToBase64(blob) } }
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
    return 'Has alcanzado el límite gratuito de Gemini por ahora. Espera un poco o añádelo a mano.'
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
  } catch (err) {
    if (init?.signal?.aborted) throw err
    throw new Error('Sin conexión. Revisa tu internet o añádelo a mano.')
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

// Sends prompt + media and returns the model's JSON answer, shaped by `schema`.
export async function generateJson<T>(
  parts: GeminiPart[],
  schema: Record<string, unknown>,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<T> {
  if (!apiKey) throw new Error('Falta la clave de Gemini. Añádela en Ajustes.')

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema },
    store: false,
  }
  // The lite model accepts (and is fastest with) minimal thinking; flash rejects it with 400.
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

  try {
    return JSON.parse(extractText(await response.json())) as T
  } catch {
    throw new Error('Gemini no devolvió un resultado válido. Inténtalo otra vez.')
  }
}

export function toPositiveInt(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

// Checks the key and model without spending generation quota.
export async function testGeminiKey(apiKey: string, model: string): Promise<void> {
  if (!apiKey) throw new Error('Pega primero la clave.')
  const response = await request(`models/${encodeURIComponent(model)}`, apiKey)
  if (!response.ok) throw new Error(await readErrorMessage(response))
}
