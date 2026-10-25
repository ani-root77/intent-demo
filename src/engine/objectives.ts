// The set of objectives an investor intent can be locked to. Users can edit and add them.
// Clario's rules (and the investor) can only pick one of these ids. Whether a proposal actually serves the
// objective is decided deterministically from a metric and a direction.

import { cashId, equityValue, portfolioStats, techExposure, total, type Portfolio, type Universe } from './model'

export type ObjectiveMetric = 'tech' | 'volatility' | 'cash' | 'equity' | 'expectedReturn' | 'none'

export interface Objective {
  id: string
  label: string
  /** Describes which investor requests this objective covers (shown to the advisor and in settings). */
  matches: string
  metric: ObjectiveMetric
  direction: 'up' | 'down'
  /** How risky this objective is in itself, for intent-drift detection. */
  lean: RiskLean
}

/** 0 very conservative … 4 very aggressive. 'neutral' carries no risk signal. */
export type RiskLean = 'very_conservative' | 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive' | 'neutral'
export const RISK_LEANS: RiskLean[] = ['very_conservative', 'conservative', 'moderate', 'aggressive', 'very_aggressive', 'neutral']
export const leanLevel = (l: RiskLean): number | null => (l === 'neutral' ? null : RISK_LEANS.indexOf(l))

export const METRICS: Record<ObjectiveMetric, { label: string; unit: string; measure: (p: Portfolio, u: Universe) => number }> = {
  tech: { label: 'Technology exposure', unit: '$', measure: (p, u) => techExposure(p, u) },
  volatility: { label: 'Modeled volatility', unit: '%', measure: (p, u) => portfolioStats(p, u).sigma * 100 },
  cash: { label: 'Cash reserve', unit: '$', measure: (p, u) => { const c = cashId(u); return c ? (p[c] ?? 0) : 0 } },
  equity: { label: 'Equity share', unit: '%', measure: (p, u) => (equityValue(p, u) / (total(p) || 1)) * 100 },
  expectedReturn: { label: 'Expected return', unit: '%', measure: (p, u) => portfolioStats(p, u).mu * 100 },
  none: { label: 'No direction required', unit: '', measure: () => 0 },
}

export const DEFAULT_OBJECTIVES: Objective[] = [
  { id: 'increase_ai_exposure', label: 'Increase AI / technology exposure', matches: 'The investor wants more exposure to AI, technology or tech growth companies.', metric: 'tech', direction: 'up', lean: 'aggressive' },
  { id: 'reduce_risk', label: 'Reduce portfolio risk', matches: 'The investor wants less risk, less volatility, more safety or more defensive holdings.', metric: 'volatility', direction: 'down', lean: 'conservative' },
  { id: 'raise_cash', label: 'Raise cash', matches: 'The investor wants to hold more cash or free up liquidity.', metric: 'cash', direction: 'up', lean: 'conservative' },
  { id: 'long_term_growth_moderate', label: 'Long-term growth at moderate risk', matches: 'A general mandate to grow or manage the portfolio toward the long-term goal, without a specific tilt.', metric: 'none', direction: 'up', lean: 'moderate' },
]

/** Tolerance so rounding noise never counts as movement. */
const EPS: Record<string, number> = { $: 0.5, '%': 1e-4, '': 0 }

export function requirementOf(o: Objective) {
  if (o.metric === 'none') return 'No direction is required. The policy checks decide.'
  return `${METRICS[o.metric].label} must go ${o.direction}.`
}

export function serves(o: Objective, before: Portfolio, after: Portfolio, u: Universe) {
  if (o.metric === 'none') return { ok: true, before: 0, after: 0 }
  const m = METRICS[o.metric]
  const b = m.measure(before, u)
  const a = m.measure(after, u)
  const eps = EPS[m.unit] ?? 0
  return { ok: o.direction === 'up' ? a > b + eps : a < b - eps, before: b, after: a }
}

export const findObjective = (list: Objective[], id: unknown) => (typeof id === 'string' ? list.find((o) => o.id === id) : undefined)
