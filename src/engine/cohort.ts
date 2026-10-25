// Similar investors: a SYNTHETIC cohort generated around the investor's profile.
// Each member has a perturbed age, horizon, portfolio and goal. The same change (scaled to the
// member's size) is applied to each, and the goal likelihood is re-estimated with a fast,
// simplified simulation. Illustrative only: no real client data is used.

import { applyTrades, assetOf, portfolioStats, total, type Investor, type Portfolio, type Trade, type Universe } from './model'

export interface CohortResult {
  n: number
  heldOrImprovedPct: number
  declinedPct: number
  medianDeltaPts: number
  /** Distribution of per-member changes in goal likelihood (points), for a small chart. */
  deltas: number[]
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

/** Fast goal-likelihood estimate: one portfolio-level shock per year plus single-asset crashes. */
function quickSuccess(p: Portfolio, inv: { age: number; retireAge: number; target: number; monthlyContribution: number }, u: Universe, seed: number, paths: number) {
  const tot = total(p)
  if (tot <= 0) return 0
  const { mu, sigma } = portfolioStats(p, u)
  const drift = Math.log(1 + mu) - 0.5 * sigma * sigma
  const tails = Object.keys(p)
    .map((id) => ({ a: assetOf(u, id), w: (p[id] ?? 0) / tot }))
    .filter((x) => x.a?.tailProb && x.w > 0)
    .map((x) => ({ prob: x.a!.tailProb!, loss: x.a!.tailLoss ?? 0, w: x.w }))
  const years = Math.max(1, inv.retireAge - inv.age)
  const rand = mulberry32(seed)
  let hits = 0
  for (let i = 0; i < paths; i++) {
    let v = tot
    for (let y = 0; y < years; y++) {
      const u1 = rand() || 1e-12
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rand())
      let g = Math.exp(drift + sigma * z)
      for (const t of tails) if (rand() < t.prob) g *= 1 - t.w * t.loss
      v = v * g + inv.monthlyContribution * 12
    }
    if (v >= inv.target) hits++
  }
  return (hits / paths) * 100
}

export function similarInvestors(investor: Investor, trades: Trade[], u: Universe, opts: { n?: number; paths?: number; seed?: number } = {}): CohortResult {
  const n = opts.n ?? 400
  const paths = opts.paths ?? 160
  const rand = mulberry32(opts.seed ?? 11)
  const base = investor.portfolio
  const baseTot = total(base) || 1
  const deltas: number[] = []

  for (let m = 0; m < n; m++) {
    // Perturb the portfolio weights (±40%) and size (0.5x–2x), age (±5) and horizon (±3).
    const scale = 0.5 + rand() * 1.5
    const p: Portfolio = {}
    for (const id of Object.keys(base)) p[id] = (base[id] ?? 0) * scale * (0.6 + rand() * 0.8)
    const memberTot = total(p)
    const age = investor.age + Math.round((rand() - 0.5) * 10)
    const horizon = Math.max(3, investor.retireAge - investor.age + Math.round((rand() - 0.5) * 6))
    const inv = { age, retireAge: age + horizon, target: investor.target * (memberTot / baseTot) * (0.8 + rand() * 0.4), monthlyContribution: investor.monthlyContribution * scale }

    // The same change, scaled to the member's size, and capped by what they actually hold.
    const k = memberTot / baseTot
    const scaled = trades.map((t) => ({ asset: t.asset, amount: t.amount < 0 ? -Math.min(-t.amount * k, p[t.asset] ?? 0) : t.amount * k }))
    const sells = -scaled.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)
    const buys = scaled.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const fit = buys > 0 ? Math.min(1, sells / buys) : 1
    const adjusted = scaled.map((t) => (t.amount > 0 ? { ...t, amount: t.amount * fit } : t))

    const seed = 1000 + m
    const before = quickSuccess(p, inv, u, seed, paths)
    const after = quickSuccess(applyTrades(p, adjusted), inv, u, seed, paths)
    deltas.push(after - before)
  }

  const sorted = [...deltas].sort((a, b) => a - b)
  const held = deltas.filter((d) => d >= -0.5).length
  return {
    n,
    heldOrImprovedPct: (held / n) * 100,
    declinedPct: ((n - held) / n) * 100,
    medianDeltaPts: sorted[Math.floor(n / 2)],
    deltas,
  }
}
