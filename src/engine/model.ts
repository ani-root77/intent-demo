// Data model: assets (the "universe"), investors, and their hard constraints.
// Every engine function takes the universe it should use. The DEFAULT_* values are only
// starting points; the playground lets the user edit all of them.
// Every number here is illustrative and configurable. Nothing is financial advice.

export type AssetId = string
export type AssetKind = 'fund' | 'stock' | 'bond' | 'cash'

export interface Asset {
  id: AssetId
  name: string
  ticker: string
  kind: AssetKind
  equity: boolean
  /** Share of the holding that looks through to the Technology sector. */
  techShare: number
  /** Expected annual return (arithmetic). */
  mu: number
  /** Annual volatility. */
  sigma: number
  /** Sensitivity to the shared market factor. */
  beta: number
  /** Tail risk: annual chance of a sudden idiosyncratic drawdown. */
  tailProb?: number
  tailLoss?: number
  color: string
  /** Illustrative last price, for showing positions. */
  price?: number
  /** Today's move in percent, from the market snapshot. */
  dayChangePct?: number
  /** Display sector, e.g. "Technology". */
  sector?: string
  /** Other names the investor or the AI might use (e.g. "nvidia", "bitcoin"). Used by Clario's rule-based text reading. */
  aliases?: string[]
}

export interface Universe {
  assets: Asset[]
  /** Volatility of the shared market factor. */
  marketVol: number
}

export const DEFAULT_ASSET_LIST: Asset[] = [
  { id: 'usTotal', name: 'US Total Market Index', ticker: 'USTM', kind: 'fund', equity: true, techShare: 0.3, mu: 0.08, sigma: 0.16, beta: 1.0, color: '#0f766e' },
  { id: 'growth', name: 'Large-Cap Growth Fund', ticker: 'LCGF', kind: 'fund', equity: true, techShare: 0.5, mu: 0.09, sigma: 0.2, beta: 1.15, color: '#14b8a6' },
  { id: 'intl', name: 'International Equity Index', ticker: 'INTL', kind: 'fund', equity: true, techShare: 0.12, mu: 0.075, sigma: 0.17, beta: 0.85, color: '#5eead4' },
  { id: 'aiix', name: 'Diversified AI Innovation ETF', ticker: 'AIIX', kind: 'fund', equity: true, techShare: 0.7, mu: 0.095, sigma: 0.24, beta: 1.2, color: '#6366f1' },
  { id: 'nvai', name: 'NovaMind AI Corp', ticker: 'NVAI', kind: 'stock', equity: true, techShare: 1, mu: 0.12, sigma: 0.5, beta: 1.4, tailProb: 0.12, tailLoss: 0.65, color: '#f97316' },
  { id: 'crtx', name: 'Cortex Robotics', ticker: 'CRTX', kind: 'stock', equity: true, techShare: 1, mu: 0.12, sigma: 0.5, beta: 1.4, tailProb: 0.12, tailLoss: 0.65, color: '#ef4444' },
  { id: 'bonds', name: 'Core Bond Index', ticker: 'BOND', kind: 'bond', equity: false, techShare: 0, mu: 0.04, sigma: 0.06, beta: 0.1, color: '#64748b' },
  { id: 'cash', name: 'Cash reserve', ticker: 'CASH', kind: 'cash', equity: false, techShare: 0, mu: 0.03, sigma: 0.005, beta: 0, color: '#cbd5e1' },
]

export const DEFAULT_UNIVERSE: Universe = { assets: DEFAULT_ASSET_LIST, marketVol: 0.15 }

/** Default-universe lookups, used by the scripted guided demo. */
export const MARKET_VOL = DEFAULT_UNIVERSE.marketVol
export const ASSETS: Record<AssetId, Asset> = Object.fromEntries(DEFAULT_ASSET_LIST.map((a) => [a.id, a]))
export const ASSET_ORDER: AssetId[] = DEFAULT_ASSET_LIST.map((a) => a.id)

const maps = new WeakMap<Universe, Map<AssetId, Asset>>()
/** Asset lookup for a universe. Unknown ids return undefined. */
export function assetOf(u: Universe, id: AssetId): Asset | undefined {
  let m = maps.get(u)
  if (!m) {
    m = new Map(u.assets.map((a) => [a.id, a]))
    maps.set(u, m)
  }
  return m.get(id)
}

/** The id of the universe's cash asset (first asset of kind "cash"). */
export const cashId = (u: Universe) => u.assets.find((a) => a.kind === 'cash')?.id

export type Portfolio = Partial<Record<AssetId, number>>

export interface Investor {
  name: string
  age: number
  retireAge: number
  target: number
  monthlyContribution: number
  riskProfile: string
  preference: string
  portfolio: Portfolio
}

export const MAYA: Investor = {
  name: 'Maya',
  age: 35,
  retireAge: 55,
  target: 2_500_000,
  monthlyContribution: 5_000,
  riskProfile: 'Moderate',
  preference: 'Increase AI exposure',
  portfolio: { usTotal: 120_000, growth: 40_000, intl: 35_000, bonds: 60_000, cash: 45_000 },
}

export type CheckId = 'intent' | 'position' | 'sector' | 'cash' | 'risk' | 'goal' | 'anomaly' | 'context' | 'focus' | 'coverage' | 'consistency' | 'advice'
/** What a failed check leads to. "off" skips the check entirely. */
export type CheckMode = 'block' | 'revise' | 'off'

export interface Policy {
  maxSingleStockPct: number
  maxSectorPct: number
  minCash: number
  maxEquityPct: number
  maxVolPct: number
  materialGoalDropPts: number
  /** Goal drops larger than this (but below the material drop) are a warning. */
  goalWarnPts: number
  maxAttempts: number
  anomalyWarnPct: number
  anomalyBlockPct: number
  /** When untrusted content was in the agent's inputs but the proposal still serves the intent: warn (true) or fail (false). */
  untrustedAlignedWarns: boolean
  /** Portal: show "blocked" when at least this share of active checks fail. */
  blockFailSharePct: number
  checkModes: Record<CheckId, CheckMode>
}

export const DEFAULT_CHECK_MODES: Record<CheckId, CheckMode> = {
  intent: 'block',
  position: 'revise',
  sector: 'revise',
  cash: 'revise',
  risk: 'revise',
  goal: 'revise',
  anomaly: 'block',
  context: 'block',
  focus: 'revise',
  coverage: 'revise',
  consistency: 'revise',
  advice: 'revise',
}

export const DEFAULT_POLICY: Policy = {
  maxSingleStockPct: 5,
  maxSectorPct: 30,
  minCash: 20_000,
  maxEquityPct: 75,
  maxVolPct: 13,
  materialGoalDropPts: 5,
  goalWarnPts: 2,
  maxAttempts: 3,
  anomalyWarnPct: 10,
  anomalyBlockPct: 25,
  untrustedAlignedWarns: true,
  blockFailSharePct: 75,
  checkModes: DEFAULT_CHECK_MODES,
}

export interface Trade {
  asset: AssetId
  /** Positive = buy, negative = sell (USD). */
  amount: number
}

export const total = (p: Portfolio) => Object.values(p).reduce<number>((a, b) => a + (b ?? 0), 0)

export function applyTrades(p: Portfolio, trades: Trade[]): Portfolio {
  const next: Portfolio = { ...p }
  for (const t of trades) next[t.asset] = (next[t.asset] ?? 0) + t.amount
  for (const id of Object.keys(next)) if ((next[id] ?? 0) <= 0.5) delete next[id]
  return next
}

export function techExposure(p: Portfolio, u: Universe = DEFAULT_UNIVERSE) {
  return Object.keys(p).reduce((s, id) => s + (p[id] ?? 0) * (assetOf(u, id)?.techShare ?? 0), 0)
}

export function equityValue(p: Portfolio, u: Universe = DEFAULT_UNIVERSE) {
  return Object.keys(p).reduce((s, id) => s + (assetOf(u, id)?.equity ? (p[id] ?? 0) : 0), 0)
}

export function largestStock(p: Portfolio, u: Universe = DEFAULT_UNIVERSE): { id: AssetId | null; value: number } {
  let best: { id: AssetId | null; value: number } = { id: null, value: 0 }
  for (const id of Object.keys(p)) {
    if (assetOf(u, id)?.kind === 'stock' && (p[id] ?? 0) > best.value) best = { id, value: p[id] ?? 0 }
  }
  return best
}

/** Analytical expected return and volatility using a one-factor model. */
export function portfolioStats(p: Portfolio, u: Universe = DEFAULT_UNIVERSE) {
  const tot = total(p) || 1
  const mv = u.marketVol
  let mu = 0
  let beta = 0
  let idioVar = 0
  for (const id of Object.keys(p)) {
    const a = assetOf(u, id)
    if (!a) continue
    const w = (p[id] ?? 0) / tot
    mu += w * a.mu
    beta += w * a.beta
    idioVar += w * w * Math.max(0, a.sigma ** 2 - a.beta ** 2 * mv ** 2)
  }
  return { mu, sigma: Math.sqrt(beta * beta * mv ** 2 + idioVar) }
}

export const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const usdShort = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `$${Math.round(n / 1e3)}k`
  return `$${Math.round(n)}`
}

export const pct = (n: number, d = 1) => `${n.toFixed(d)}%`
