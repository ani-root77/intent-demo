// Intent sessions: the server-side record Clario verifies against.
// The locked intent, the profile, the engine config, the attempt counter and the provenance of
// the agent's context all live here. None of them can be set or changed by the agent.

import { randomUUID } from 'node:crypto'
import type { EngineConfig, Profile } from '../src/engine/config'
import { buildFeedback, verify, type Proposal, type Verification } from '../src/engine/guard'
import { usd, type Investor, type Policy, type Trade } from '../src/engine/model'
import { findObjective, requirementOf } from '../src/engine/objectives'
import { validateTrades } from '../src/engine/validate'

export interface ContextItem {
  source: string
  text: string
  trust: 'trusted' | 'untrusted'
}

export interface LockedIntent {
  intent_id: string
  profile: string
  objective: string
  objective_label: string
  requirement: string
  said_by_investor: string
  restated_by_parser: string
  inherited_from_profile: Record<string, string>
  locked: true
  editable_by_agent: false
  parsed_by: string
  fingerprint: string
}

export interface Session {
  id: string
  kind: 'request' | 'mandate'
  intent: Readonly<LockedIntent>
  investor: Readonly<Investor>
  policy: Readonly<Policy>
  cfg: Readonly<EngineConfig>
  context: ContextItem[]
  attempts: number
  verifications: Verification[]
  closed: boolean
}

const sessions = new Map<string, Session>()

export function fnv1a(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze)
    Object.freeze(o)
  }
  return o
}

export function createSession(opts: { kind: 'request' | 'mandate'; text: string; objective: string; restated: string; profile: Profile; cfg: EngineConfig; parsedBy: string }): Session {
  const id = randomUUID()
  const investor = structuredClone(opts.profile.investor)
  const policy = structuredClone(opts.profile.policy)
  const cfg = structuredClone(opts.cfg)
  const spec = findObjective(cfg.objectives, opts.objective)
  const body = {
    intent_id: id,
    profile: investor.name,
    objective: opts.objective,
    objective_label: spec?.label ?? opts.objective,
    requirement: spec ? requirementOf(spec) : '',
    said_by_investor: opts.text,
    restated_by_parser: opts.restated,
    inherited_from_profile: {
      risk_profile: investor.riskProfile.toLowerCase(),
      goal: `retire at ${investor.retireAge} with ${usd(investor.target)}`,
      max_single_stock: `${policy.maxSingleStockPct}%`,
      max_sector: `${policy.maxSectorPct}%`,
      min_cash: usd(policy.minCash),
      max_equity: `${policy.maxEquityPct}%`,
      max_volatility: `${policy.maxVolPct}%`,
    },
    locked: true as const,
    editable_by_agent: false as const,
    parsed_by: opts.parsedBy,
  }
  const intent = deepFreeze({ ...body, fingerprint: fnv1a(JSON.stringify([body, policy, cfg])) })
  if (sessions.size > 500) sessions.delete(sessions.keys().next().value as string)
  const s: Session = {
    id,
    kind: opts.kind,
    intent,
    investor: deepFreeze(investor),
    policy: deepFreeze(policy),
    cfg: deepFreeze(cfg),
    context: [{ source: 'Investor request', text: opts.text, trust: 'trusted' }],
    attempts: 0,
    verifications: [],
    closed: false,
  }
  sessions.set(id, s)
  return s
}

export const getSession = (id: unknown) => (typeof id === 'string' ? sessions.get(id) : undefined)

/** Called by whatever feeds the agent (news, email, feeds). Anything not from the investor is untrusted. */
export function addContext(s: Session, source: string, text: string): ContextItem {
  const item: ContextItem = { source: source.slice(0, 120) || 'Unknown source', text: text.slice(0, 4000), trust: 'untrusted' }
  s.context.push(item)
  return item
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * Checks that a raw proposal is well-formed and executable on the current portfolio.
 * Malformed proposals are rejected before verification and do not count as an attempt.
 * Trust, trigger, attempt number and id are set here from the session, never from the agent.
 */
export function normalizeProposal(s: Session, raw: unknown, agent: string): { ok: true; proposal: Proposal } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const summary = str(r.summary, 200)
  const rationale = str(r.rationale, 1500)
  const action = str(r.action, 20).toUpperCase() || 'REBALANCE'
  const addresses = str(r.addresses, 60)
  if (!summary) errors.push('summary is required')
  if (!rationale) errors.push('rationale is required')
  if (!addresses) errors.push('addresses is required')

  const v = validateTrades(s.cfg.universe, s.investor.portfolio, r.trades)
  if (!v.ok) errors.push(...v.errors)
  if (errors.length || !v.ok) return { ok: false, errors }

  const untrusted = s.context.filter((c) => c.trust === 'untrusted')
  const tradeList: Trade[] = v.trades
  return {
    ok: true,
    proposal: {
      id: `prop_${s.id.slice(0, 8)}_v${s.attempts + 1}`,
      attempt: s.attempts + 1,
      agent: agent.slice(0, 80) || 'Unknown agent',
      action,
      summary,
      rationale,
      trades: tradeList,
      addresses,
      triggeredBy: s.kind === 'mandate' && untrusted.length ? 'external_signal' : 'investor_request',
      contextSource: untrusted.length ? untrusted.map((c) => c.source).join(', ') : 'Investor request',
      contextTrust: untrusted.length ? 'untrusted' : 'trusted',
    },
  }
}

export type VerifyResult =
  | { ok: true; verification: Verification; feedback?: ReturnType<typeof buildFeedback> }
  | { ok: false; status: number; errors: string[] }

export function verifyInSession(s: Session, raw: unknown, agent: string): VerifyResult {
  if (s.closed) return { ok: false, status: 409, errors: [`Intent ${s.id} is closed (${s.verifications.at(-1)?.decision}). Start a new intent.`] }
  const n = normalizeProposal(s, raw, agent)
  if (!n.ok) return { ok: false, status: 422, errors: n.errors }
  s.attempts++
  const v = verify(n.proposal, s.investor, s.policy, s.intent.objective, s.cfg)
  s.verifications.push(v)
  if (v.decision !== 'REVISE') {
    s.closed = true
    return { ok: true, verification: v }
  }
  return { ok: true, verification: v, feedback: buildFeedback(v, s.policy, s.investor, s.cfg.universe) }
}
