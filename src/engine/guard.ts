// Clario / AgentGuard: the deterministic verification core.
// No AI in here. Same proposal + same policy + same config => same decision, every time.
// It identifies violations and returns constraints. It never invents a replacement investment.

import {
  DEFAULT_UNIVERSE,
  applyTrades,
  assetOf,
  cashId,
  equityValue,
  largestStock,
  portfolioStats,
  techExposure,
  total,
  usd,
  pct,
  type CheckId,
  type CheckMode,
  type Investor,
  type Policy,
  type Portfolio,
  type Trade,
  type Universe,
} from './model'
import { DEFAULT_OBJECTIVES, METRICS, findObjective, requirementOf, serves, type Objective } from './objectives'
import { DEFAULT_TWIN, runTwin, type TwinResult, type TwinSettings } from './twin'

export type { CheckId } from './model'

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

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'off'

/** Numbers behind a check, for visualising observed value against its limit. */
export interface Meter {
  value: number
  limit: number
  /** 'max': value must stay at or below limit. 'min': at or above. */
  kind: 'max' | 'min'
  unit: '%' | '$' | 'pts'
  /** Optional warning threshold (same direction as limit). */
  warn?: number
  /** Optional starting value, before the proposal. */
  before?: number
}

export interface Check {
  id: CheckId
  label: string
  status: CheckStatus
  mode: CheckMode
  observed: string
  limit: string
  detail: string
  meter?: Meter
  /** 'rule': decided by code alone. 'you': rests on a part of the request's reading the investor set themselves. */
  basis?: 'rule' | 'you'
}

export type Decision = 'ALLOW' | 'REVISE' | 'BLOCK' | 'HUMAN_REVIEW'

export interface Verification {
  proposal: Proposal
  objective: string
  before: Portfolio
  after: Portfolio
  checks: Check[]
  decision: Decision
  reason: string
  twinBefore: TwinResult
  twinAfter: TwinResult
  deltaPts: number
}

export interface VerifyConfig {
  universe: Universe
  objectives: Objective[]
  twin: TwinSettings
}

export const DEFAULT_VERIFY_CONFIG: VerifyConfig = { universe: DEFAULT_UNIVERSE, objectives: DEFAULT_OBJECTIVES, twin: DEFAULT_TWIN }

export function verify(proposal: Proposal, investor: Investor, policy: Policy, objective: string, cfg: VerifyConfig = DEFAULT_VERIFY_CONFIG): Verification {
  const u = cfg.universe
  const before = investor.portfolio
  const after = applyTrades(before, proposal.trades)
  const tot = total(before) || 1
  const totAfter = total(after) || 1
  const checks: Check[] = []
  const cid = cashId(u)
  const push = (c: Omit<Check, 'mode'>) => {
    const mode = policy.checkModes[c.id]
    checks.push(mode === 'off' ? { ...c, mode, status: 'off' } : { ...c, mode })
  }

  // 1. Intent alignment: the label must match AND the portfolio change must actually serve it.
  const spec = findObjective(cfg.objectives, objective)
  const servesRes = spec ? serves(spec, before, after, u) : null
  let intentStatus: CheckStatus
  if (proposal.triggeredBy === 'external_signal') {
    intentStatus = 'fail'
    push({ id: 'intent', label: 'Intent alignment', status: 'fail', observed: 'Agent-initiated', limit: 'Investor-requested', detail: 'The investor never asked for this. The agent acted on outside content, not on the investor’s request.' })
  } else if (proposal.addresses !== objective) {
    intentStatus = 'fail'
    push({ id: 'intent', label: 'Intent alignment', status: 'fail', observed: proposal.addresses || '(none)', limit: objective, detail: 'The proposal does not address the stated objective.' })
  } else if (spec && servesRes && !servesRes.ok) {
    intentStatus = 'fail'
    const m = METRICS[spec.metric]
    const fmt = (n: number) => (m.unit === '$' ? usd(n) : pct(n))
    push({ id: 'intent', label: 'Intent alignment', status: 'fail', observed: `${m.label} ${fmt(servesRes.before)} → ${fmt(servesRes.after)}`, limit: `must go ${spec.direction}`, detail: `The agent says it addresses “${spec.label}”, but the trades don’t. ${requirementOf(spec)}` })
  } else {
    intentStatus = 'pass'
    push({ id: 'intent', label: 'Intent alignment', status: 'pass', observed: 'Addresses request', limit: objective, detail: spec ? `Serves “${spec.label}”. ${requirementOf(spec)}` : 'The proposal addresses the investor’s stated objective.' })
  }

  // 2. Single-position limit, judged on the stocks this proposal adds to. A stock that was already over the limit
  //    before the proposal is the investor's own position: it is noted, not counted against the agent.
  const added = Object.keys(after).filter((id) => assetOf(u, id)?.kind === 'stock' && (after[id] ?? 0) > (before[id] ?? 0) + 0.5)
  const bigAdded = added.reduce<{ id: string | null; value: number }>((b, id) => ((after[id] ?? 0) > b.value ? { id, value: after[id] ?? 0 } : b), { id: null, value: 0 })
  const big = bigAdded.id ? bigAdded : largestStock(after, u)
  const bigPct = (big.value / totAfter) * 100
  const bigA = big.id ? assetOf(u, big.id) : undefined
  const over = bigPct > policy.maxSingleStockPct + 1e-9
  const preBig = largestStock(before, u)
  const preA = preBig.id ? assetOf(u, preBig.id) : undefined
  const preOver = !!preA && (preBig.value / tot) * 100 > policy.maxSingleStockPct + 1e-9 && preBig.id !== bigAdded.id
  push({
    id: 'position',
    label: 'Single-stock limit',
    status: over && bigAdded.id ? 'fail' : 'pass',
    observed: bigA ? `${bigA.ticker} ${pct(bigPct)}` : 'No single stocks',
    limit: `≤ ${policy.maxSingleStockPct}%`,
    detail:
      (bigA ? `${bigA.name} would be ${usd(big.value)} of a ${usd(totAfter)} portfolio.` : 'The portfolio holds only diversified funds.') +
      (preOver ? ` ${preA!.name} was already ${pct((preBig.value / tot) * 100)} before this proposal, above the limit; the proposal doesn't add to it.` : ''),
    meter: { value: bigPct, limit: policy.maxSingleStockPct, kind: 'max', unit: '%', before: (largestStock(before, u).value / tot) * 100 },
  })

  // 3. Sector concentration (look-through)
  const techBefore = (techExposure(before, u) / tot) * 100
  const techAfter = (techExposure(after, u) / totAfter) * 100
  push({
    id: 'sector',
    label: 'Sector concentration',
    status: techAfter > policy.maxSectorPct + 1e-9 ? 'fail' : 'pass',
    observed: `Tech ${pct(techBefore)} → ${pct(techAfter)}`,
    limit: `≤ ${policy.maxSectorPct}%`,
    detail: 'Technology exposure, counting the tech share held inside every fund.',
    meter: { value: techAfter, limit: policy.maxSectorPct, kind: 'max', unit: '%', before: techBefore },
  })

  // 4. Cash requirement
  const cashBefore = cid ? (before[cid] ?? 0) : 0
  const cashAfter = cid ? (after[cid] ?? 0) : 0
  push({
    id: 'cash',
    label: 'Cash buffer',
    status: cashAfter + 1e-9 < policy.minCash ? 'fail' : 'pass',
    observed: usd(cashAfter),
    limit: `≥ ${usd(policy.minCash)}`,
    detail: cid ? `Cash reserve moves from ${usd(cashBefore)} to ${usd(cashAfter)}.` : 'The asset universe has no cash asset.',
    meter: { value: cashAfter, limit: policy.minCash, kind: 'min', unit: '$', before: cashBefore },
  })

  // 5. Risk profile
  const eqBefore = (equityValue(before, u) / tot) * 100
  const eqAfter = (equityValue(after, u) / totAfter) * 100
  const volBefore = portfolioStats(before, u).sigma * 100
  const volAfter = portfolioStats(after, u).sigma * 100
  const eqFail = eqAfter > policy.maxEquityPct + 1e-9
  const volFail = volAfter > policy.maxVolPct + 1e-9
  push({
    id: 'risk',
    label: `Risk profile (${investor.riskProfile})`,
    status: eqFail || volFail ? 'fail' : 'pass',
    observed: `Equity ${pct(eqAfter, 0)} · Vol ${pct(volAfter)}`,
    limit: `≤ ${policy.maxEquityPct}% · ≤ ${policy.maxVolPct}%`,
    detail: `Equity ${pct(eqBefore, 0)} → ${pct(eqAfter, 0)}. Modeled volatility ${pct(volBefore)} → ${pct(volAfter)}.`,
    meter: { value: volAfter, limit: policy.maxVolPct, kind: 'max', unit: '%', before: volBefore },
  })

  // 6. Goal impact (Financial Twin)
  const twinBefore = runTwin(before, investor, u, cfg.twin)
  const twinAfter = runTwin(after, { ...investor, portfolio: after }, u, cfg.twin)
  const deltaPts = twinAfter.successPct - twinBefore.successPct
  push({
    id: 'goal',
    label: 'Goal impact (Financial Twin)',
    status: deltaPts <= -policy.materialGoalDropPts ? 'fail' : deltaPts < -policy.goalWarnPts ? 'warn' : 'pass',
    observed: `${pct(twinBefore.successPct, 0)} → ${pct(twinAfter.successPct, 0)}`,
    limit: `drop < ${policy.materialGoalDropPts} pts`,
    detail: `Modeled likelihood of reaching ${usd(investor.target)} by age ${investor.retireAge} changes by ${deltaPts >= 0 ? '+' : ''}${deltaPts.toFixed(1)} pts.`,
    meter: { value: Math.max(0, -deltaPts), limit: policy.materialGoalDropPts, kind: 'max', unit: 'pts', warn: policy.goalWarnPts },
  })

  // 7. Anomaly: size of the move relative to the portfolio
  const traded = proposal.trades.reduce((s, t) => s + Math.max(0, t.amount), 0)
  const tradedPct = (traded / tot) * 100
  push({
    id: 'anomaly',
    label: 'Anomaly (trade size)',
    status: tradedPct > policy.anomalyBlockPct ? 'fail' : tradedPct > policy.anomalyWarnPct ? 'warn' : 'pass',
    observed: `${usd(traded)} (${pct(tradedPct)})`,
    limit: `warn > ${policy.anomalyWarnPct}% · fail > ${policy.anomalyBlockPct}%`,
    detail: 'Compares the size of this single action with the whole portfolio.',
    meter: { value: tradedPct, limit: policy.anomalyBlockPct, kind: 'max', unit: '%', warn: policy.anomalyWarnPct },
  })

  // 8. Context trust. Untrusted content in the agent's inputs fails the check when the proposal
  // also drifts from the intent. If it still serves the locked objective, the policy decides.
  const untrusted = proposal.contextTrust === 'untrusted'
  const intentFailed = intentStatus === 'fail'
  push({
    id: 'context',
    label: 'Context trust',
    status: !untrusted ? 'pass' : intentFailed || !policy.untrustedAlignedWarns ? 'fail' : 'warn',
    observed: proposal.contextSource,
    limit: 'Trusted sources only',
    detail: !untrusted
      ? 'The proposal came from the investor’s own request.'
      : intentFailed
        ? 'The proposal was driven by unverified external content and does not serve the investor’s intent.'
        : policy.untrustedAlignedWarns
          ? 'Unverified external content was in the agent’s inputs. The proposal still serves the locked intent, so the other checks decide.'
          : 'Unverified external content was in the agent’s inputs. This policy treats that as a failure.',
  })

  const failed = checks.filter((c) => c.status === 'fail')
  const blocking = failed.filter((c) => c.mode === 'block')
  let decision: Decision
  let reason: string
  if (blocking.length) {
    decision = 'BLOCK'
    reason = `Blocking failure: ${blocking.map((c) => c.label.toLowerCase()).join(', ')}. Nothing is executed and the investor is told why.`
  } else if (!failed.length) {
    decision = 'ALLOW'
    reason = 'All active checks pass. The investor can now review and approve.'
  } else if (proposal.attempt >= policy.maxAttempts) {
    decision = 'HUMAN_REVIEW'
    reason = `Revision limit reached (${proposal.attempt}/${policy.maxAttempts}). Escalated to the investor or advisor. It is never approved automatically.`
  } else {
    decision = 'REVISE'
    reason = `${failed.length} correctable violation${failed.length > 1 ? 's' : ''}. Structured feedback goes back to the AI agent.`
  }

  return { proposal, objective, before, after, checks, decision, reason, twinBefore, twinAfter, deltaPts }
}

export function buildFeedback(v: Verification, policy: Policy, investor: Investor, u: Universe = DEFAULT_UNIVERSE) {
  const tot = total(v.before)
  const cid = cashId(u)
  const round = (n: number) => Math.max(0, Math.round(n / 100) * 100)
  return {
    type: 'CLARIO_FEEDBACK',
    proposal_id: v.proposal.id,
    decision: v.decision,
    attempt: `${v.proposal.attempt}/${policy.maxAttempts}`,
    violations: v.checks
      .filter((c) => c.status === 'fail')
      .map((c) => ({ check: c.id, observed: c.observed, limit: c.limit })),
    constraints_for_revision: {
      max_single_stock_usd: round((policy.maxSingleStockPct / 100) * tot),
      max_additional_tech_exposure_usd: round((policy.maxSectorPct / 100) * tot - techExposure(v.before, u)),
      max_deployable_cash_usd: round((cid ? (v.before[cid] ?? 0) : 0) - policy.minCash),
      max_additional_equity_usd: round((policy.maxEquityPct / 100) * tot - equityValue(v.before, u)),
      max_volatility_pct: policy.maxVolPct,
      max_goal_likelihood_drop_pts: policy.materialGoalDropPts,
    },
    preserve: { objective: v.objective, risk_profile: investor.riskProfile.toLowerCase() },
    note: 'Clario reports violations and limits only. It does not suggest investments.',
  }
}
