// Financial Twin: a seeded Monte Carlo simulation of the investor's path to their goal.
// It does not predict markets. It compares portfolios under the SAME simulated market
// scenarios (common random numbers), so differences come from the portfolio, not luck.

import { ASSETS, ASSET_ORDER, MARKET_VOL, total, type Investor, type Portfolio } from './model'

export const TWIN_SETTINGS = { paths: 5000, seed: 7 }

export interface TwinResult {
  successPct: number
  ages: number[]
  p10: number[]
  p50: number[]
  p90: number[]
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

export function runTwin(portfolio: Portfolio, investor: Investor): TwinResult {
  const key = JSON.stringify([portfolio, investor.target, investor.monthlyContribution, investor.age, investor.retireAge])
  const hit = cache.get(key)
  if (hit) return hit

  const years = investor.retireAge - investor.age
  const N = TWIN_SETTINGS.paths
  const start = total(portfolio)
  const annualContribution = investor.monthlyContribution * 12
  const weights = ASSET_ORDER.map((id) => (portfolio[id] ?? 0) / start)
  const assets = ASSET_ORDER.map((id) => {
    const a = ASSETS[id]
    return {
      drift: Math.log(1 + a.mu) - 0.5 * a.sigma ** 2,
      mkt: a.beta * MARKET_VOL,
      idio: Math.sqrt(Math.max(0, a.sigma ** 2 - a.beta ** 2 * MARKET_VOL ** 2)),
      tailProb: a.tailProb ?? 0,
      tailLog: a.tailLoss ? Math.log(1 - a.tailLoss) : 0,
    }
  })

  const rand = mulberry32(TWIN_SETTINGS.seed)
  const gauss = () => {
    const u1 = rand() || 1e-12
    const u2 = rand()
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }

  const byYear: Float64Array[] = Array.from({ length: years + 1 }, () => new Float64Array(N))
  let hits = 0
  for (let i = 0; i < N; i++) {
    let v = start
    byYear[0][i] = v
    for (let y = 1; y <= years; y++) {
      const zm = gauss()
      let growth = 0
      // Draw for every asset (even at 0 weight) so every portfolio sees identical scenarios.
      for (let j = 0; j < assets.length; j++) {
        const a = assets[j]
        const zi = gauss()
        const u = rand()
        let lr = a.drift + a.mkt * zm + a.idio * zi
        if (u < a.tailProb) lr += a.tailLog
        growth += weights[j] * Math.exp(lr)
      }
      v = v * growth + annualContribution
      byYear[y][i] = v
    }
    if (v >= investor.target) hits++
  }

  const q = (arr: Float64Array, p: number) => arr[Math.floor(p * (arr.length - 1))]
  const res: TwinResult = { successPct: (hits / N) * 100, ages: [], p10: [], p50: [], p90: [] }
  byYear.forEach((arr, y) => {
    arr.sort()
    res.ages.push(investor.age + y)
    res.p10.push(q(arr, 0.1))
    res.p50.push(q(arr, 0.5))
    res.p90.push(q(arr, 0.9))
  })
  cache.set(key, res)
  return res
}
