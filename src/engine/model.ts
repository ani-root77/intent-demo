// Demo data model: fictional assets, the demo investor (Maya), and her hard constraints.
// Every number here is illustrative and configurable. Nothing is financial advice.

export type AssetId = 'usTotal' | 'growth' | 'intl' | 'bonds' | 'cash' | 'nvai' | 'crtx' | 'aiix'
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
  /** Single-stock tail risk: annual chance of a sudden idiosyncratic drawdown. */
  tailProb?: number
  tailLoss?: number
  color: string
}

export const MARKET_VOL = 0.15

export const ASSETS: Record<AssetId, Asset> = {
  usTotal: { id: 'usTotal', name: 'US Total Market Index', ticker: 'USTM', kind: 'fund', equity: true, techShare: 0.3, mu: 0.08, sigma: 0.16, beta: 1.0, color: '#0f766e' },
  growth: { id: 'growth', name: 'Large-Cap Growth Fund', ticker: 'LCGF', kind: 'fund', equity: true, techShare: 0.5, mu: 0.09, sigma: 0.2, beta: 1.15, color: '#14b8a6' },
  intl: { id: 'intl', name: 'International Equity Index', ticker: 'INTL', kind: 'fund', equity: true, techShare: 0.12, mu: 0.075, sigma: 0.17, beta: 0.85, color: '#5eead4' },
  bonds: { id: 'bonds', name: 'Core Bond Index', ticker: 'BOND', kind: 'bond', equity: false, techShare: 0, mu: 0.04, sigma: 0.06, beta: 0.1, color: '#64748b' },
  cash: { id: 'cash', name: 'Cash reserve', ticker: 'CASH', kind: 'cash', equity: false, techShare: 0, mu: 0.03, sigma: 0.005, beta: 0, color: '#cbd5e1' },
  nvai: { id: 'nvai', name: 'NovaMind AI Corp', ticker: 'NVAI', kind: 'stock', equity: true, techShare: 1, mu: 0.12, sigma: 0.5, beta: 1.4, tailProb: 0.12, tailLoss: 0.65, color: '#f97316' },
  crtx: { id: 'crtx', name: 'Cortex Robotics', ticker: 'CRTX', kind: 'stock', equity: true, techShare: 1, mu: 0.12, sigma: 0.5, beta: 1.4, tailProb: 0.12, tailLoss: 0.65, color: '#ef4444' },
  aiix: { id: 'aiix', name: 'Diversified AI Innovation ETF', ticker: 'AIIX', kind: 'fund', equity: true, techShare: 0.7, mu: 0.095, sigma: 0.24, beta: 1.2, color: '#6366f1' },
}

export const ASSET_ORDER: AssetId[] = ['usTotal', 'growth', 'intl', 'aiix', 'nvai', 'crtx', 'bonds', 'cash']

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

export interface Policy {
  maxSingleStockPct: number
  maxSectorPct: number
  minCash: number
  maxEquityPct: number
  maxVolPct: number
  materialGoalDropPts: number
  maxAttempts: number
  anomalyWarnPct: number
  anomalyBlockPct: number
}

export const DEFAULT_POLICY: Policy = {
  maxSingleStockPct: 5,
  maxSectorPct: 30,
  minCash: 20_000,
  maxEquityPct: 75,
  maxVolPct: 13,
  materialGoalDropPts: 5,
  maxAttempts: 3,
  anomalyWarnPct: 10,
  anomalyBlockPct: 25,
}

export interface Trade {
  asset: AssetId
  /** Positive = buy, negative = sell (USD). */
  amount: number
}

export const total = (p: Portfolio) => Object.values(p).reduce((a, b) => a + (b ?? 0), 0)

export function applyTrades(p: Portfolio, trades: Trade[]): Portfolio {
  const next: Portfolio = { ...p }
  for (const t of trades) next[t.asset] = (next[t.asset] ?? 0) + t.amount
  for (const id of Object.keys(next) as AssetId[]) if ((next[id] ?? 0) <= 0.5) delete next[id]
  return next
}

export function techExposure(p: Portfolio) {
  return (Object.keys(p) as AssetId[]).reduce((s, id) => s + (p[id] ?? 0) * ASSETS[id].techShare, 0)
}

export function equityValue(p: Portfolio) {
  return (Object.keys(p) as AssetId[]).reduce((s, id) => s + (ASSETS[id].equity ? (p[id] ?? 0) : 0), 0)
}

export function largestStock(p: Portfolio): { id: AssetId | null; value: number } {
  let best: { id: AssetId | null; value: number } = { id: null, value: 0 }
  for (const id of Object.keys(p) as AssetId[]) {
    if (ASSETS[id].kind === 'stock' && (p[id] ?? 0) > best.value) best = { id, value: p[id] ?? 0 }
  }
  return best
}

/** Analytical expected return and volatility using a one-factor model. */
export function portfolioStats(p: Portfolio) {
  const tot = total(p)
  let mu = 0
  let beta = 0
  let idioVar = 0
  for (const id of Object.keys(p) as AssetId[]) {
    const a = ASSETS[id]
    const w = (p[id] ?? 0) / tot
    mu += w * a.mu
    beta += w * a.beta
    idioVar += w * w * Math.max(0, a.sigma ** 2 - a.beta ** 2 * MARKET_VOL ** 2)
  }
  return { mu, sigma: Math.sqrt(beta * beta * MARKET_VOL ** 2 + idioVar) }
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
