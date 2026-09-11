// INTENT / AgentGuard: the deterministic verification core.
// No AI in here. Same proposal + same policy => same decision, every time.
// It identifies violations and returns constraints. It never invents a replacement investment.

import {
  ASSETS,
  applyTrades,
  equityValue,
  largestStock,
  portfolioStats,
  techExposure,
  total,
  usd,
  pct,
  type Investor,
  type Policy,
  type Portfolio,
  type Trade,
} from './model'
import { runTwin, type TwinResult } from './twin'

export interface Proposal {
  id: string
  attempt: number
  agent: string
  action: string
  summary: string
  rationale: string
  trades: Trade[]
  addresses: string
  triggeredBy: 'investor_request' | 'external_signal'
  contextSource: string
  contextTrust: 'trusted' | 'untrusted'
}

export type CheckStatus = 'pass' | 'warn' | 'fail'
export type CheckId = 'intent' | 'position' | 'sector' | 'cash' | 'risk' | 'goal' | 'anomaly' | 'context'

export interface Check {
  id: CheckId
  label: string
  status: CheckStatus
  observed: string
  limit: string
  detail: string
}

export type Decision = 'ALLOW' | 'REVISE' | 'BLOCK' | 'HUMAN_REVIEW'

export interface Verification {
  proposal: Proposal
  before: Portfolio
  after: Portfolio
  checks: Check[]
  decision: Decision
  reason: string
  twinBefore: TwinResult
  twinAfter: TwinResult
  deltaPts: number
}

/** Failures that mean "clearly unauthorized", not "correctable". */
const BLOCKING: CheckId[] = ['context', 'intent', 'anomaly']

export function verify(proposal: Proposal, investor: Investor, policy: Policy, objective: string): Verification {
  const before = investor.portfolio
  const after = applyTrades(before, proposal.trades)
  const tot = total(before)
  const totAfter = total(after)
  const checks: Check[] = []

  // 1. Intent alignment
  if (proposal.triggeredBy === 'external_signal') {
    checks.push({ id: 'intent', label: 'Intent alignment', status: 'fail', observed: 'Agent-initiated', limit: 'Investor-requested', detail: 'The investor never asked for this. The agent acted on outside content, not on the investor’s request.' })
  } else if (proposal.addresses !== objective) {
    checks.push({ id: 'intent', label: 'Intent alignment', status: 'fail', observed: proposal.addresses, limit: objective, detail: 'The proposal does not address the stated objective.' })
  } else {
    checks.push({ id: 'intent', label: 'Intent alignment', status: 'pass', observed: 'Addresses request', limit: objective, detail: 'The proposal addresses the investor’s stated objective. The other checks decide whether it does so within their plan.' })
  }

  // 2. Single-position limit
  const big = largestStock(after)
  const bigPct = (big.value / totAfter) * 100
  checks.push({
    id: 'position',
    label: 'Single-stock limit',
    status: bigPct > policy.maxSingleStockPct + 1e-9 ? 'fail' : 'pass',
    observed: big.id ? `${ASSETS[big.id].ticker} ${pct(bigPct)}` : 'No single stocks',
    limit: `≤ ${policy.maxSingleStockPct}%`,
    detail: big.id ? `${ASSETS[big.id].name} would be ${usd(big.value)} of a ${usd(totAfter)} portfolio.` : 'The portfolio holds only diversified funds.',
  })

  // 3. Sector concentration (look-through)
  const techBefore = (techExposure(before) / tot) * 100
  const techAfter = (techExposure(after) / totAfter) * 100
  checks.push({
    id: 'sector',
    label: 'Sector concentration',
    status: techAfter > policy.maxSectorPct + 1e-9 ? 'fail' : 'pass',
    observed: `Tech ${pct(techBefore)} → ${pct(techAfter)}`,
    limit: `≤ ${policy.maxSectorPct}%`,
    detail: 'Technology exposure, counting the tech share held inside every fund.',
  })

  // 4. Cash requirement
  const cashAfter = after.cash ?? 0
  checks.push({
    id: 'cash',
    label: 'Cash buffer',
    status: cashAfter + 1e-9 < policy.minCash ? 'fail' : 'pass',
    observed: usd(cashAfter),
    limit: `≥ ${usd(policy.minCash)}`,
    detail: `Cash reserve moves from ${usd(before.cash ?? 0)} to ${usd(cashAfter)}.`,
  })

  // 5. Risk profile
  const eqAfter = (equityValue(after) / totAfter) * 100
  const volBefore = portfolioStats(before).sigma * 100
  const volAfter = portfolioStats(after).sigma * 100
  const riskFail = eqAfter > policy.maxEquityPct + 1e-9 || volAfter > policy.maxVolPct + 1e-9
  checks.push({
    id: 'risk',
    label: 'Risk profile (Moderate)',
    status: riskFail ? 'fail' : 'pass',
    observed: `Equity ${pct(eqAfter, 0)} · Vol ${pct(volAfter)}`,
    limit: `≤ ${policy.maxEquityPct}% · ≤ ${policy.maxVolPct}%`,
    detail: `Modeled volatility moves from ${pct(volBefore)} to ${pct(volAfter)}.`,
  })

  // 6. Goal impact (Financial Twin)
  const twinBefore = runTwin(before, investor)
  const twinAfter = runTwin(after, { ...investor, portfolio: after })
  const deltaPts = twinAfter.successPct - twinBefore.successPct
  checks.push({
    id: 'goal',
    label: 'Goal impact (Financial Twin)',
    status: deltaPts <= -policy.materialGoalDropPts ? 'fail' : deltaPts < -2 ? 'warn' : 'pass',
    observed: `${pct(twinBefore.successPct, 0)} → ${pct(twinAfter.successPct, 0)}`,
    limit: `drop < ${policy.materialGoalDropPts} pts`,
    detail: `Modeled likelihood of reaching ${usd(investor.target)} by age ${investor.retireAge} changes by ${deltaPts >= 0 ? '+' : ''}${deltaPts.toFixed(1)} pts.`,
  })

  // 7. Anomaly: size of the move relative to the portfolio
  const traded = proposal.trades.reduce((s, t) => s + Math.max(0, t.amount), 0)
  const tradedPct = (traded / tot) * 100
  checks.push({
    id: 'anomaly',
    label: 'Anomaly (trade size)',
    status: tradedPct > policy.anomalyBlockPct ? 'fail' : tradedPct > policy.anomalyWarnPct ? 'warn' : 'pass',
    observed: `${usd(traded)} (${pct(tradedPct)})`,
    limit: `warn > ${policy.anomalyWarnPct}% · block > ${policy.anomalyBlockPct}%`,
    detail: 'Compares the size of this single action with the whole portfolio.',
  })

  // 8. Context trust
  checks.push({
    id: 'context',
    label: 'Context trust',
    status: proposal.contextTrust === 'untrusted' ? 'fail' : 'pass',
    observed: proposal.contextSource,
    limit: 'Trusted sources only',
    detail: proposal.contextTrust === 'untrusted' ? 'The proposal was driven by an unverified, urgent external message.' : 'The proposal came from the investor’s own request.',
  })

  const failed = checks.filter((c) => c.status === 'fail')
  const blocking = failed.filter((c) => BLOCKING.includes(c.id))
  let decision: Decision
  let reason: string
  if (blocking.length) {
    decision = 'BLOCK'
    reason = `Clearly unauthorized: ${blocking.map((c) => c.label.toLowerCase()).join(', ')}. Nothing is executed and the investor is told why.`
  } else if (!failed.length) {
    decision = 'ALLOW'
    reason = 'All required checks pass. The investor can now review and approve.'
  } else if (proposal.attempt >= policy.maxAttempts) {
    decision = 'HUMAN_REVIEW'
    reason = `Revision limit reached (${proposal.attempt}/${policy.maxAttempts}). Escalated to the investor or advisor. It is never approved automatically.`
  } else {
    decision = 'REVISE'
    reason = `${failed.length} correctable violation${failed.length > 1 ? 's' : ''}. Structured feedback goes back to the AI agent.`
  }

  return { proposal, before, after, checks, decision, reason, twinBefore, twinAfter, deltaPts }
}

export function buildFeedback(v: Verification, policy: Policy) {
  const tot = total(v.before)
  const round = (n: number) => Math.max(0, Math.round(n / 100) * 100)
  return {
    type: 'INTENT_FEEDBACK',
    proposal_id: v.proposal.id,
    decision: v.decision,
    attempt: `${v.proposal.attempt}/${policy.maxAttempts}`,
    violations: v.checks
      .filter((c) => c.status === 'fail')
      .map((c) => ({ check: c.id, observed: c.observed, limit: c.limit })),
    constraints_for_revision: {
      max_single_stock_usd: round((policy.maxSingleStockPct / 100) * tot),
      max_additional_tech_exposure_usd: round((policy.maxSectorPct / 100) * tot - techExposure(v.before)),
      max_deployable_cash_usd: round((v.before.cash ?? 0) - policy.minCash),
      max_additional_equity_usd: round((policy.maxEquityPct / 100) * tot - equityValue(v.before)),
      max_goal_likelihood_drop_pts: policy.materialGoalDropPts,
    },
    preserve: { objective: 'increase_ai_exposure', risk_profile: 'moderate' },
    note: 'INTENT reports violations and limits only. It does not suggest investments.',
  }
}
