// Demo-day protection for the routes that call Gemini: per-visitor, per-network and site-wide limits, a shared
// answer cache (the same question on the same settings is answered once), and access codes: judges skip the public
// limits, and the team (Cupcakes) can also use the Clario lab and change the settings everyone sees. State is in memory; the hosted function runs as a single instance so the limits and cache are exact.

import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

export type Lane = 'public' | 'judge' | 'team'

export interface Caller {
  lane: Lane
  client: string
  ip: string
}

/** An over-limit request; the route answers 429 with this message and a retry-after. */
export class BusyError extends Error {
  status = 429
  retryAfter: number
  constructor(message: string, retryAfter: number) {
    super(message)
    this.retryAfter = retryAfter
  }
}

const header = (req: IncomingMessage, name: string) => {
  const v = req.headers[name]
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

const digest = (s: string) => createHash('sha256').update(s).digest()

const matches = (code: string, want: string | undefined) => !!want?.trim() && !!code.trim() && timingSafeEqual(digest(code.trim().toUpperCase()), digest(want.trim().toUpperCase()))

/** Which role an access code unlocks (compared in constant time): TEAM_CODE → team, JUDGE_CODE → judge. */
export function roleOfCode(code: string): 'team' | 'judge' | null {
  if (matches(code, process.env.TEAM_CODE)) return 'team'
  if (matches(code, process.env.JUDGE_CODE)) return 'judge'
  return null
}

export function callerOf(req: IncomingMessage): Caller {
  const ip = header(req, 'x-forwarded-for').split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  const id = header(req, 'x-clario-client')
  const client = /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : `ip:${ip}`
  return { lane: roleOfCode(header(req, 'x-clario-code') || header(req, 'x-clario-judge')) ?? 'public', client, ip }
}

// ---------- limits ----------

interface Limit {
  key: (c: Caller) => string
  max: number
  windowMs: number
  message: string
}

const MIN = 60_000
const HOUR = 60 * MIN
const busy = 'The AI advisor is busy right now because a lot of people are trying the demo.'
const LIMITS: Record<Lane, Limit[]> = {
  public: [
    { key: (c) => `c:${c.client}`, max: 6, windowMs: MIN, message: 'You are asking faster than the demo allows.' },
    { key: (c) => `c:${c.client}`, max: 40, windowMs: HOUR, message: 'You have reached the demo limit for this hour.' },
    // A whole venue can share one public IP, so the network limit is generous.
    { key: (c) => `ip:${c.ip}`, max: 120, windowMs: MIN, message: busy },
    { key: (c) => `ip:${c.ip}`, max: 900, windowMs: HOUR, message: busy },
    { key: () => 'public', max: 150, windowMs: MIN, message: busy },
    // About $3.60 of Gemini calls a day at ~$0.002 each, so the public can't spend the balance the judges rely on.
    { key: () => 'public', max: 1800, windowMs: 24 * HOUR, message: busy },
  ],
  // Judges skip the public limits; these only stop a leaked code from being abused.
  judge: [
    { key: (c) => `j:${c.client}`, max: 30, windowMs: MIN, message: 'Judge lane: too many requests in a minute.' },
    { key: () => 'judge', max: 120, windowMs: MIN, message: 'Judge lane: too many requests in a minute.' },
  ],
  team: [
    { key: (c) => `t:${c.client}`, max: 40, windowMs: MIN, message: 'Team access: too many requests in a minute.' },
    { key: () => 'team', max: 120, windowMs: MIN, message: 'Team access: too many requests in a minute.' },
  ],
}

const hits = new Map<string, number[]>()

function recent(key: string, windowMs: number, now: number) {
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  hits.set(key, list)
  return list
}

/** Reserves `cost` calls for this caller, or throws BusyError without reserving anything. */
export function admit(c: Caller, cost = 1) {
  const now = Date.now()
  for (const l of LIMITS[c.lane]) {
    const list = recent(`${l.key(c)}|${l.windowMs}`, l.windowMs, now)
    if (list.length + cost > l.max) {
      const retryAfter = Math.max(1, Math.ceil((list[0]! + l.windowMs - now) / 1000))
      throw new BusyError(`${l.message} Please try again in ${retryAfter < 90 ? `${retryAfter} seconds` : `${Math.ceil(retryAfter / 60)} minutes`}.`, retryAfter)
    }
  }
  for (const l of LIMITS[c.lane]) {
    const key = `${l.key(c)}|${l.windowMs}`
    const list = hits.get(key) ?? []
    for (let i = 0; i < cost; i++) list.push(now)
    hits.set(key, list)
  }
  if (hits.size > 20_000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1]! > 24 * HOUR) hits.delete(k)
}

/** Access-code guesses per network, so the codes can't be brute-forced. */
export function admitCodeAttempt(ip: string) {
  const now = Date.now()
  const list = recent(`code-try:${ip}`, MIN, now)
  if (list.length >= 10) throw new BusyError('Too many code attempts. Please wait a minute.', 60)
  list.push(now)
}

// ---------- shared answer cache ----------

const TTL = 6 * HOUR
const MAX_ENTRIES = 2000
const cache = new Map<string, { at: number; value: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

export const cacheKey = (parts: unknown) => createHash('sha256').update(JSON.stringify(parts)).digest('hex')
export const normalizeQuestion = (q: string) => q.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Returns the cached value for `key`, waits for an identical request already in flight, or runs `fn` once
 * (charging the caller only then). Failures are not cached.
 */
export async function cached<T>(key: string, fn: () => Promise<T>, charge: () => void): Promise<{ value: T; hit: boolean }> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.at < TTL) return { value: hit.value as T, hit: true }
  const running = inflight.get(key)
  if (running) return { value: (await running) as T, hit: true }
  charge()
  const p = fn()
  inflight.set(key, p)
  try {
    const value = await p
    cache.set(key, { at: Date.now(), value })
    if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
    return { value, hit: false }
  } finally {
    inflight.delete(key)
  }
}
