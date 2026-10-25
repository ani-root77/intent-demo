// Financial Twin: a seeded Monte Carlo simulation of the investor's path to their goal.
// It does not predict markets. It compares portfolios under the SAME simulated market
// scenarios (common random numbers), so differences come from the portfolio, not luck.

import { DEFAULT_UNIVERSE, total, type Investor, type Portfolio, type Universe } from './model'

export interface TwinSettings {
  /** Number of simulated market paths. */
  paths: number
  /** Random seed. The same seed gives the same scenarios for every portfolio. */
  seed: number
  /** How many individual paths to return for visualisation. */
  samplePaths: number
}

export const DEFAULT_TWIN: TwinSettings = { paths: 5000, seed: 7, samplePaths: 60 }
/** Kept for the guided demo. */
export const TWIN_SETTINGS = DEFAULT_TWIN

export interface TwinResult {
  successPct: number
  ages: number[]
  p10: number[]
  p50: number[]
  p90: number[]
  /** A few individual simulated paths (value by year), for animation. */
  samples: number[][]
  /** Whether each sample path reached the target. */
  sampleHits: boolean[]
  /** Histogram of final values: bin edges (length n+1) and counts (length n). */
  hist: { edges: number[]; counts: number[] }
  paths: number
  seed: number
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cache = new Map<string, TwinResult>()

export function runTwin(portfolio: Portfolio, investor: Investor, u: Universe = DEFAULT_UNIVERSE, settings: TwinSettings = DEFAULT_TWIN): TwinResult {
  const key = JSON.stringify([portfolio, investor.target, investor.monthlyContribution, investor.age, investor.retireAge, u, settings])
  const hit = cache.get(key)
  if (hit) return hit
  if (cache.size > 400) cache.clear()

  const years = Math.max(1, Math.round(investor.retireAge - investor.age))
  const N = Math.max(100, Math.round(settings.paths))
  const start = total(portfolio)
  const annualContribution = investor.monthlyContribution * 12
  const weights = u.assets.map((a) => (start > 0 ? (portfolio[a.id] ?? 0) / start : 0))
  const assets = u.assets.map((a) => ({
    drift: Math.log(1 + a.mu) - 0.5 * a.sigma ** 2,
    mkt: a.beta * u.marketVol,
    idio: Math.sqrt(Math.max(0, a.sigma ** 2 - a.beta ** 2 * u.marketVol ** 2)),
    tailProb: a.tailProb ?? 0,
    tailLog: a.tailLoss ? Math.log(Math.max(1e-6, 1 - a.tailLoss)) : 0,
  }))

  const rand = mulberry32(settings.seed)
  const gauss = () => {
    const u1 = rand() || 1e-12
    const u2 = rand()
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }

  const nSamples = Math.min(N, Math.max(0, Math.round(settings.samplePaths)))
  const samples: number[][] = []
  const sampleHits: boolean[] = []
  const byYear: Float64Array[] = Array.from({ length: years + 1 }, () => new Float64Array(N))
  let hits = 0
  for (let i = 0; i < N; i++) {
    let v = start
    byYear[0][i] = v
    const path = i < nSamples ? [v] : null
    for (let y = 1; y <= years; y++) {
      const zm = gauss()
      let growth = 0
      // Draw for every asset (even at 0 weight) so every portfolio sees identical scenarios.
      for (let j = 0; j < assets.length; j++) {
        const a = assets[j]
        const zi = gauss()
        const r = rand()
        let lr = a.drift + a.mkt * zm + a.idio * zi
        if (r < a.tailProb) lr += a.tailLog
        growth += weights[j] * Math.exp(lr)
      }
      v = v * growth + annualContribution
      byYear[y][i] = v
      path?.push(v)
    }
    if (v >= investor.target) hits++
    if (path) {
      samples.push(path)
      sampleHits.push(v >= investor.target)
    }
  }

  const q = (arr: Float64Array, p: number) => arr[Math.floor(p * (arr.length - 1))]
  const res: TwinResult = { successPct: (hits / N) * 100, ages: [], p10: [], p50: [], p90: [], samples, sampleHits, hist: { edges: [], counts: [] }, paths: N, seed: settings.seed }
  byYear.forEach((arr, y) => {
    arr.sort()
    res.ages.push(investor.age + y)
    res.p10.push(q(arr, 0.1))
    res.p50.push(q(arr, 0.5))
    res.p90.push(q(arr, 0.9))
  })

  // Histogram of final values between the 1st and 99th percentile.
  const fin = byYear[years]
  const lo = q(fin, 0.01)
  const hi = q(fin, 0.99)
  const bins = 30
  const w = (hi - lo) / bins || 1
  res.hist.edges = Array.from({ length: bins + 1 }, (_, k) => lo + k * w)
  res.hist.counts = new Array(bins).fill(0)
  for (const x of fin) res.hist.counts[Math.min(bins - 1, Math.max(0, Math.floor((x - lo) / w)))]++

  cache.set(key, res)
  return res
}
