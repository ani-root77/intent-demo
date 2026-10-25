// Display data for the mock portal, derived deterministically from the logged-in profile.
// Everything here is fictional: account names, numbers and history are generated.

import type { Profile, Workspace } from '../engine/config'
import { total, type Portfolio } from '../engine/model'

export interface Account {
  id: string
  name: string
  number: string
  holdings: Portfolio
  value: number
  dayChange: number
  dayChangePct: number
}

function hash(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function dayChangeOf(p: Portfolio, ws: Workspace) {
  return ws.universe.assets.reduce((s, a) => {
    const v = p[a.id] ?? 0
    const pctMove = (a.dayChangePct ?? 0) / 100
    // value today is v; yesterday it was v / (1 + move)
    return s + (v - v / (1 + pctMove))
  }, 0)
}

const SPLIT: { name: string; share: number }[] = [
  { name: 'Individual Brokerage', share: 0.55 },
  { name: 'Roth IRA', share: 0.27 },
  { name: 'Traditional IRA', share: 0.18 },
]

/** Splits the profile's holdings into a few fictional accounts. */
export function accountsOf(profile: Profile, ws: Workspace): Account[] {
  const h = hash(profile.id)
  return SPLIT.map((s, k) => {
    const holdings: Portfolio = {}
    for (const id of Object.keys(profile.investor.portfolio)) holdings[id] = Math.round((profile.investor.portfolio[id] ?? 0) * s.share)
    const value = total(holdings)
    const dayChange = dayChangeOf(holdings, ws)
    return {
      id: `${profile.id}-${k}`,
      name: s.name,
      number: `X${String((h >>> (k * 3)) % 90000000 + 10000000)}`,
      holdings,
      value,
      dayChange,
      dayChangePct: value ? (dayChange / (value - dayChange)) * 100 : 0,
    }
  })
}

/** A plausible one-year balance history that ends at today's value. Fictional. */
export function balanceHistory(profile: Profile, days = 260) {
  const end = total(profile.investor.portfolio)
  const r = rng(hash(profile.id + 'hist'))
  const vals: number[] = [end]
  for (let i = 1; i < days; i++) {
    const shock = (r() - 0.5) * 0.022 + (r() < 0.02 ? -0.03 : 0)
    vals.push(vals[i - 1] / (1 + 0.0003 + shock))
  }
  return vals.reverse()
}

export function sparkline(seed: string, n = 40, trend = 0) {
  const r = rng(hash(seed))
  const out = [0]
  for (let i = 1; i < n; i++) out.push(out[i - 1] + (r() - 0.5) + trend / n)
  return out
}
