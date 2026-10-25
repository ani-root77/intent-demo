// Minimal Gemini REST client. JSON-only output, constrained by a response schema.
// The API key is read on the server and never sent to the browser.
// Every call is returned with its exact prompt and raw output, so the UI can show it.

import type { LlmCall } from '../src/engine/timeline'

export type { LlmCall }

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export class GeminiError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}


interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
  error?: { message?: string }
}

export const keyConfigured = () => !!process.env.GEMINI_API_KEY

/**
 * Rate limits are per model. When the chosen model is rate-limited, overloaded or times out, the call moves on to
 * these models, each with its own allowance, before waiting and trying again. The judge lane also gets two models
 * the public never uses, so a crowd can't use up the judges' capacity.
 */
export const PUBLIC_FALLBACKS = ['gemini-3.1-flash-lite']
export const JUDGE_FALLBACKS = ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite']
/** Stop starting new attempts after this long, so a hosted request (2-minute limit) still gets an answer back. */
const BUDGET_MS = 100_000

class RetryableError extends GeminiError {
  /** Seconds Google asked us to wait, when it said. */
  retryAfter: number | null
  constructor(message: string, status: number, retryAfter: number | null) {
    super(message, status)
    this.retryAfter = retryAfter
  }
}

export async function generateJson(role: LlmCall['role'], model: string, system: string, prompt: string, schema: object, temperature: number, fallbacks = PUBLIC_FALLBACKS): Promise<LlmCall> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new GeminiError('GEMINI_API_KEY is not set. Copy .env.example to .env, add your key, and restart the server.', 503)

  const t0 = Date.now()
  const chain = [model, ...fallbacks.filter((m) => m !== model)]
  let last: GeminiError | null = null
  for (let round = 0; round < 3; round++) {
    let wait = 0
    for (const [i, m] of chain.entries()) {
      const left = BUDGET_MS - (Date.now() - t0)
      if (left < 5_000) break
      try {
        return await callOnce(key, role, m, system, prompt, schema, temperature, Math.min(45_000, left))
      } catch (e) {
        if (e instanceof RetryableError) {
          last = e
          wait = Math.max(wait, e.retryAfter ?? 5)
          continue
        }
        // A fallback model this key can't use is skipped; a bad request or a wrong main model is a real error.
        if (i > 0 && e instanceof GeminiError && e.status === 404) continue
        throw e
      }
    }
    const left = BUDGET_MS - (Date.now() - t0)
    if (left < 10_000) break
    await new Promise((r) => setTimeout(r, Math.min(wait + 1, 20, (left - 8_000) / 1000) * 1000))
  }
  throw new GeminiError(`The AI advisor is busy right now because a lot of people are trying the demo. Please try again in a minute.${last ? ` (${last.message})` : ''}`, 503)
}

async function callOnce(key: string, role: LlmCall['role'], model: string, system: string, prompt: string, schema: object, temperature: number, timeoutMs: number): Promise<LlmCall> {
  const t0 = Date.now()
  let res: Response
  try {
    res = await fetch(`${BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    throw new RetryableError(`Could not reach Gemini: ${(e as Error).message}`, 503, null)
  }

  const body = (await res.json().catch(() => null)) as GeminiResponse | null
  if (!res.ok) {
    const message = `Gemini ${res.status}: ${body?.error?.message ?? res.statusText}.`
    if (res.status === 429 || res.status >= 500) {
      const delay = /"?retryDelay"?\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(JSON.stringify(body ?? ''))?.[1]
      throw new RetryableError(message, res.status, delay ? Number(delay) : null)
    }
    const hint = res.status === 404 ? ` Model "${model}" was not found. Pick another model in Settings → Agent.` : ''
    throw new GeminiError(message + hint, res.status)
  }
  const cand = body?.candidates?.[0]
  const raw = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
  let output: unknown = null
  try {
    output = JSON.parse(raw)
  } catch {
    /* left as null; the caller treats it as malformed */
  }
  return { role, model, temperature, system, prompt, raw, output, ms: Date.now() - t0, ...(output === null ? { rejected: [`No valid JSON (finishReason: ${cand?.finishReason ?? 'unknown'})`] } : {}) }
}

/** Lists models this key can call with generateContent. */
export async function listModels(): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return []
  const res = await fetch(`${BASE}?pageSize=200`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return []
  const body = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }
  return (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /gemini/.test(m.name) && !/tts|image|banana|robotics|computer-use|transcribe/.test(m.name))
    .map((m) => m.name.replace(/^models\//, ''))
}
