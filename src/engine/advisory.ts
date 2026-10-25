// AI Advisory: Clario's assessment of one AI answer to one investor question.
// The AI (Gemini) writes the answer. Clario itself uses no AI at all:
// - Clario reads the request with fixed rules. The investor sees that reading and can correct any part of
//   it; when the rules can't read a request with confidence, Clario asks the investor instead of guessing.
// - Clario reads the advisor's written answer itself; it never relies on the advisor's own labels
//   (its verdict, its cited sources, its list of unverifiable assets) to decide anything.
// - Checks, simulation, synthetic cohort, verdict and intent drift are all computed in code.

import { riskLevelOf, type Profile, type RiskLevel, type Workspace } from './config'
import { similarInvestors, type CohortResult } from './cohort'
import { verify, type Check, type Proposal, type Verification } from './guard'
import { applyTrades, cashId, total, usd, type Asset, type CheckId, type Policy, type Portfolio, type Trade, type Universe } from './model'
import { leanLevel, type RiskLean } from './objectives'
import { readRequestNlp, scanAnswerNlp } from './nlp'
import { stanceByTicker, type AnswerScan, type RuleReading } from './rules'
import type { LlmCall } from './timeline'

export type RequestType = 'suggestion' | 'advice' | 'other'
export type AdvisorVerdict = 'do_it' | 'do_partially' | 'dont' | 'not_applicable'
export type RequestedTrade = { ticker: string; side: 'BUY' | 'SELL'; usd: number; percent: number }

/** The AI advisor's answer, with its trades already validated. */
export interface AdvisorReply {
  answer: string
  /** The advisor's own label. Shown for reference only; Clario does not use it to decide anything. */
  verdict: AdvisorVerdict
  trades: Trade[]
  /** Self-reported by the advisor. Shown for reference only; Clario finds unverifiable recommendations itself. */
  other_assets: string[]
  /** Self-reported by the advisor. Can only add flags, never remove them. */
  cited_headlines: number[]
  /** Set when the advisor's trades could not be executed even after repairs. */
  invalid?: string[]
}

export interface AdviceResult {
  id: string
  at: string
  question: string
  profileId: string
  advisor: AdvisorReply
  calls: LlmCall[]
  model: string
  style: string
  ms: number
}

export type IntentVerdict = 'VERIFIED' | 'CAUTION' | 'BLOCKED' | 'UNVERIFIABLE' | 'NO_ACTION'

export interface Evidence {
  kind: 'support' | 'against' | 'caution'
  text: string
}

/** Where a piece of Clario's reading came from: its rules, the investor's own correction, or nowhere. */
export type Source = 'rules' | 'you' | 'none'

export interface Drift {
  detected: boolean
  direction: 'riskier' | 'safer' | null
  requestLean: RiskLean
  profileRisk: RiskLevel
  suggestedRisk: RiskLevel
  recentSimilar: number
  recentTotal: number
  /** Where the risk reading came from. */
  source: Source
}

/** The investor's corrections to Clario's reading of their request. Any field left out keeps the rules' reading. */
export interface IntentEdit {
  request_type?: RequestType
  objective?: string
  lean?: RiskLean
  /** Tickers of the known assets the request is about. */
  assets?: string[]
  /** The explicit action asked for; [] means "none". */
  requested?: RequestedTrade[]
  /** Set when the investor has confirmed the reading (with or without changes). */
  confirmed?: boolean
}

/** Clario's reading of the request: the rules' reading, with the investor's corrections applied. */
export interface Reading {
  request_type: RequestType
  objective: string
  lean: RiskLean
  known: Asset[]
  unknown: string[]
  requested: RequestedTrade[]
  sources: { type: Source; objective: Source; lean: Source; assets: Source; requested: Source }
  /** True when the rules could not read the request well enough to judge an answer against it. */
  needsConfirm: boolean
  /** True once the investor has confirmed or corrected the reading. */
  confirmed: boolean
  rules: RuleReading
}

export interface Assessment {
  verdict: IntentVerdict
  verdictReason: string
  checks: Check[]
  counts: { pass: number; warn: number; fail: number; off: number; active: number; rule: number; you: number }
  verification: Verification | null
  /** When the AI recommends no trade but the investor asked for one: what doing it anyway would mean. */
  hypothetical: Verification | null
  hypotheticalTrades: Trade[]
  cohort: CohortResult | null
  evidence: Evidence[]
  reading: Reading
  scan: AnswerScan
  known: Asset[]
  unknown: string[]
  /** Assets the AI recommends that Clario can't model (found by Clario, not taken from the AI's label). */
  unverifiableRecs: string[]
  citedHeadlines: Workspace['market']['headlines']
  rumorTickers: string[]
  drift: Drift
}

const PROFILE_LEVEL: Record<RiskLevel, number> = { Conservative: 1, Moderate: 2, Aggressive: 3 }

function applyMode(c: Omit<Check, 'mode'>, policy: Policy): Check {
  const mode = policy.checkModes[c.id]
  return mode === 'off' ? { ...c, mode, status: 'off' } : { ...c, mode }
}

const uniqCI = (xs: string[]) => xs.filter((x, i) => xs.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i)

/**
 * Clario's reading of a request: the rule-based reading (no AI), with the investor's corrections on top.
 * The rules either find a field (and show the words that matched) or report no opinion; they never guess.
 */
export function readingOf(question: string, profile: Profile, ws: Workspace, edit: IntentEdit = {}): Reading {
  const u = ws.universe
  const rules = readRequestNlp(question, u, ws.objectives, ws.rules, profile.investor.name)
  const src = <T>(mine: T | undefined, ruled: unknown): Source => (mine !== undefined ? 'you' : ruled === null || ruled === undefined || ruled === 'neutral' || (Array.isArray(ruled) && !ruled.length) ? 'none' : 'rules')

  const request_type = edit.request_type ?? rules.request_type ?? 'other'
  const objective = edit.objective ?? rules.objective ?? 'unclear'
  const lean = edit.lean ?? rules.implied_risk
  const known = edit.assets ? edit.assets.map((tk) => u.assets.find((a) => a.ticker === tk)).filter((a): a is Asset => !!a) : rules.known
  const requested = edit.requested ?? rules.requested_trades

  // The rules have read enough to judge an answer when they know what kind of request it is, and what it is about.
  const about = rules.objective !== null || rules.known.length > 0 || rules.unknown.length > 0 || rules.requested_trades.length > 0
  const needsConfirm = rules.request_type === null || !about

  return {
    request_type,
    objective,
    lean,
    known,
    unknown: rules.unknown,
    requested,
    sources: {
      type: src(edit.request_type, rules.request_type),
      objective: src(edit.objective, rules.objective),
      lean: src(edit.lean, rules.implied_risk),
      assets: src(edit.assets, [...rules.known, ...rules.unknown]),
      requested: src(edit.requested, rules.requested_trades),
    },
    needsConfirm,
    confirmed: !!edit.confirmed,
    rules,
  }
}

export function detectDrift(lean: RiskLean, source: Source, profile: Profile, ws: Workspace, excludeAt?: string): Drift {
  const profileRisk = riskLevelOf(profile.investor.riskProfile)
  const req = leanLevel(lean)
  const p = PROFILE_LEVEL[profileRisk]
  const detected = req !== null && Math.abs(req - p) >= ws.portal.driftLevels
  const direction = req === null || req === p ? null : req > p ? 'riskier' : 'safer'
  const suggestedRisk: RiskLevel = req === null ? profileRisk : req <= 1 ? 'Conservative' : req === 2 ? 'Moderate' : 'Aggressive'
  const recent = profile.history.filter((h) => h.at !== excludeAt).slice(-5)
  const recentSimilar = recent.filter((h) => {
    const l = leanLevel(h.lean)
    return l !== null && direction !== null && (direction === 'riskier' ? l > p : l < p)
  }).length
  return { detected, direction, requestLean: lean, profileRisk, suggestedRisk, recentSimilar, recentTotal: recent.length, source }
}

export function assess(result: AdviceResult, profile: Profile, ws: Workspace, edit: IntentEdit = {}): Assessment {
  const { advisor } = result
  const u = ws.universe
  const policy = profile.policy
  const investor = profile.investor
  const assets = u.assets
  const tickerOf = (id: string) => assets.find((a) => a.id === id)?.ticker ?? id

  const reading = readingOf(result.question, profile, ws, edit)
  const objective = reading.objective

  // Clario's own reading of the written answer.
  const scan = scanAnswerNlp(advisor.answer, u, ws.rules, investor.name)
  const stances = stanceByTicker(scan)
  const tradeBuys = advisor.trades.filter((t) => t.amount > 0).map((t) => tickerOf(t.asset))
  const textBuys = [...stances].filter(([, s]) => s.stance === 'buy').map(([t]) => t)
  const textAvoid = [...stances].filter(([, s]) => s.stance === 'avoid').map(([t]) => t)
  const recommendsBuying = [...new Set([...tradeBuys, ...textBuys])]

  // Assets Clario can't model that the answer recommends: found only by Clario's own scan of the text.
  // The advisor's "other_assets" label is not used for any decision.
  const unverifiableRecs = uniqCI(scan.unknownBuys.map((x) => x.name))
  const known = reading.known
  const unknown = uniqCI([...reading.unknown, ...unverifiableRecs])

  // Context: did the answer act on unverified content? Decided from what it recommends buying.
  const unverified = ws.market.headlines.filter((h) => !h.verified)
  const citedHeadlines = ws.market.headlines.filter((h) => advisor.cited_headlines.includes(h.id))
  const rumorTickers = [...new Set(unverified.flatMap((h) => h.tickers).filter((t) => recommendsBuying.includes(t)))]
  const citedUnverified = citedHeadlines.filter((h) => !h.verified)
  const untrusted = rumorTickers.length > 0 || citedUnverified.length > 0
  const contextSource = untrusted
    ? `Unverified: ${[...(rumorTickers.length ? [`recommends ${rumorTickers.join(', ')}, the subject of an unverified post`] : []), ...citedUnverified.map((h) => `cites “${h.source}”`)].join('; ')}`
    : 'Investor question + verified market data'

  let verification: Verification | null = null
  let hypothetical: Verification | null = null
  const hypotheticalTrades = advisor.trades.length ? [] : requestedTrades(reading.requested, investor.portfolio, u)
  const cfg = { universe: u, objectives: ws.objectives, twin: ws.twin }
  if (hypotheticalTrades.length) {
    hypothetical = verify(
      { id: `${result.id}_asked`, attempt: 1, agent: 'Investor', action: 'AS_ASKED', summary: result.question, rationale: '', trades: hypotheticalTrades, addresses: objective, triggeredBy: 'investor_request', contextSource: 'Investor request', contextTrust: 'trusted' },
      investor,
      policy,
      objective,
      cfg,
    )
  }
  let cohort: CohortResult | null = null
  const checks: Check[] = []

  if (advisor.trades.length) {
    const p: Proposal = {
      id: result.id,
      attempt: 1,
      agent: 'AI advisor',
      action: 'RECOMMENDATION',
      summary: advisor.answer.slice(0, 120),
      rationale: advisor.answer,
      trades: advisor.trades,
      addresses: objective,
      triggeredBy: 'investor_request',
      contextSource,
      contextTrust: untrusted ? 'untrusted' : 'trusted',
    }
    verification = verify(p, investor, policy, objective, cfg)
    checks.push(...verification.checks)
    cohort = similarInvestors(investor, advisor.trades, u)
  }

  // Answers the question asked: based on what the answer actually recommends, not on its own label.
  const askedTickers = known.map((a) => a.ticker)
  let focus: Omit<Check, 'mode'>
  if (!askedTickers.length) {
    focus = { id: 'focus', label: 'Answers the question asked', status: 'pass', observed: reading.request_type === 'advice' ? 'General question' : 'Open request', limit: 'On topic', detail: 'No specific known asset was asked about.' }
  } else if (!recommendsBuying.length) {
    const avoided = askedTickers.filter((t) => textAvoid.includes(t))
    focus = { id: 'focus', label: 'Answers the question asked', status: 'pass', observed: `About ${askedTickers.join(', ')}`, limit: 'On topic', detail: avoided.length ? `The answer advises against ${avoided.join(', ')}.` : 'The answer does not recommend buying anything.' }
  } else if (recommendsBuying.some((t) => askedTickers.includes(t))) {
    focus = { id: 'focus', label: 'Answers the question asked', status: 'pass', observed: `About ${askedTickers.join(', ')}`, limit: 'On topic', detail: 'The recommendation acts on the asset you asked about.' }
  } else {
    focus = { id: 'focus', label: 'Answers the question asked', status: 'fail', observed: `Asked ${askedTickers.join(', ')} · got ${recommendsBuying.join(', ')}`, limit: 'On topic', detail: `You asked about ${askedTickers.join(', ')}, but the answer recommends ${recommendsBuying.join(', ')} instead.` }
  }
  checks.push(applyMode(focus, policy))

  // Does the written answer match its own trades?
  const issues: { status: 'fail' | 'warn'; text: string }[] = []
  for (const t of textBuys.filter((t) => !tradeBuys.includes(t))) issues.push({ status: 'fail', text: `The text tells you to buy ${t} (“${stances.get(t)?.clause}”), but ${t} is not in its trades.` })
  for (const t of tradeBuys.filter((t) => textAvoid.includes(t))) issues.push({ status: 'fail', text: `Contradiction: the trades buy ${t}, but the text advises against it (“${stances.get(t)?.clause}”).` })
  for (const t of tradeBuys.filter((t) => !stances.has(t))) issues.push({ status: 'warn', text: `The trades buy ${t}, but the text never mentions it, so you wouldn’t know from reading the answer.` })
  const consistency: Omit<Check, 'mode'> = issues.length
    ? { id: 'consistency', label: 'Text matches trades', status: issues.some((i) => i.status === 'fail') ? 'fail' : 'warn', observed: `${issues.length} mismatch${issues.length > 1 ? 'es' : ''}`, limit: 'Text = trades', detail: issues.map((i) => i.text).join(' ') }
    : { id: 'consistency', label: 'Text matches trades', status: 'pass', observed: advisor.trades.length ? 'Consistent' : 'No buy instructions', limit: 'Text = trades', detail: advisor.trades.length ? 'Every asset the text tells you to buy is in the trades, and vice versa.' : 'The text gives no buy instruction and there are no trades.' }
  checks.push(applyMode(consistency, policy))

  let coverage: Omit<Check, 'mode'>
  const askedUnknown = reading.unknown
  if (advisor.invalid?.length) {
    coverage = { id: 'coverage', label: 'Asset coverage', status: 'fail', observed: 'Not executable', limit: 'Valid, self-funded trades', detail: `The AI's trades could not be executed: ${advisor.invalid.join('; ')}` }
  } else if (unverifiableRecs.length) {
    coverage = { id: 'coverage', label: 'Asset coverage', status: 'fail', observed: `Can't verify ${unverifiableRecs.join(', ')}`, limit: 'Verifiable assets only', detail: `The answer recommends ${unverifiableRecs.join(', ')}, which Clario cannot model (not in the verifiable asset list). That part of the answer is unverified.` }
  } else if (askedUnknown.length) {
    coverage = { id: 'coverage', label: 'Asset coverage', status: 'warn', observed: `Can't verify ${askedUnknown.join(', ')}`, limit: 'Verifiable assets only', detail: `You asked about ${askedUnknown.join(', ')}, which Clario cannot model. Only the parts of the answer about known assets were checked.` }
  } else {
    coverage = { id: 'coverage', label: 'Asset coverage', status: 'pass', observed: 'All assets known', limit: 'Verifiable assets only', detail: 'Every asset in the question and the answer can be simulated.' }
  }
  checks.push(applyMode(coverage, policy))

  const personalised = advisor.trades.length > 0 || textBuys.length > 0
  const advice: Omit<Check, 'mode'> = personalised
    ? { id: 'advice', label: 'Advice classification', status: 'warn', observed: 'Personalized recommendation', limit: 'Needs review', detail: 'Specific securities for this investor. Before a firm presents this as a recommendation it needs a suitability record, risk and conflict-of-interest disclosures, and a compliance review.' }
    : { id: 'advice', label: 'Advice classification', status: 'pass', observed: 'General information', limit: 'Needs review', detail: 'No specific purchase is recommended, so this reads as general information.' }
  checks.push(applyMode(advice, policy))

  // Which checks rest on a part of the reading the investor set themselves (all others: rules alone).
  const youFor: Partial<Record<CheckId, boolean>> = {
    intent: reading.sources.objective === 'you',
    focus: reading.sources.assets === 'you',
  }
  for (const c of checks) c.basis = youFor[c.id] ? 'you' : 'rule'

  const active = checks.filter((c) => c.status !== 'off')
  const fails = active.filter((c) => c.status === 'fail')
  const warns = active.filter((c) => c.status === 'warn')
  const blocking = fails.filter((c) => c.mode === 'block')
  const counts = {
    pass: active.length - fails.length - warns.length,
    warn: warns.length,
    fail: fails.length,
    off: checks.length - active.length,
    active: active.length,
    rule: active.filter((c) => c.basis !== 'you').length,
    you: active.filter((c) => c.basis === 'you').length,
  }
  const failShare = active.length ? (fails.length / active.length) * 100 : 0

  let verdict: IntentVerdict
  let verdictReason: string
  const names = (cs: Check[]) => cs.map((c) => c.label.replace(/ \(.*\)$/, '').toLowerCase()).join(', ')
  if (blocking.length || (advisor.trades.length && failShare >= policy.blockFailSharePct)) {
    verdict = 'BLOCKED'
    verdictReason = blocking.length
      ? `A blocking check failed: ${names(blocking)}. Following this answer would go against ${investor.name}’s profile.`
      : `${fails.length} of ${active.length} checks failed (${failShare.toFixed(0)}%, limit ${policy.blockFailSharePct}%). This answer does not fit ${investor.name}’s profile.`
  } else if (!advisor.trades.length && (unverifiableRecs.length || textBuys.length)) {
    verdict = 'UNVERIFIABLE'
    verdictReason = unverifiableRecs.length
      ? `The answer recommends ${unverifiableRecs.join(', ')}, which Clario cannot simulate. Treat this answer as unverified.`
      : `The text recommends buying ${textBuys.join(', ')} but gives no trade Clario can simulate. Treat this answer as unverified.`
  } else if (!advisor.trades.length) {
    verdict = 'NO_ACTION'
    verdictReason = hypothetical
      ? 'The AI recommends no change. Clario simulated what you asked for instead, so you can see whether that advice holds up (below).'
      : 'The AI does not recommend a portfolio change, so there is nothing to simulate. The checks below cover the answer itself.'
  } else if (fails.length || warns.length) {
    verdict = 'CAUTION'
    verdictReason = fails.length ? `${fails.length} check${fails.length > 1 ? 's' : ''} failed: ${names(fails)}. Review before acting.` : `No check failed, but ${warns.length} raised a warning: ${names(warns)}.`
  } else {
    verdict = 'VERIFIED'
    verdictReason = `Every check passed. The answer fits ${investor.name}’s goals, limits and risk profile.`
  }


  // What supports and what argues against the answer.
  const evidence: Evidence[] = []
  for (const c of active) {
    const line = `${c.label}: ${c.observed}${c.limit ? ` (limit ${c.limit})` : ''}`
    if (c.status === 'pass') evidence.push({ kind: 'support', text: line })
    else evidence.push({ kind: c.status === 'fail' ? 'against' : 'caution', text: `${line}. ${c.detail}` })
  }
  if (verification) {
    const v = verification
    const p10b = v.twinBefore.p10.at(-1) ?? 0
    const p10a = v.twinAfter.p10.at(-1) ?? 0
    evidence.push({ kind: p10a >= p10b * 0.98 ? 'support' : 'against', text: `Bad-case outcome at ${investor.retireAge} (1 in 10 scenarios): ${usd(p10b)} → ${usd(p10a)}` })
  }
  if (cohort) {
    evidence.push({
      kind: cohort.declinedPct > 50 ? 'against' : 'support',
      text: `Similar investors (synthetic, n=${cohort.n}): ${cohort.heldOrImprovedPct.toFixed(0)}% held or improved their goal likelihood, ${cohort.declinedPct.toFixed(0)}% declined; median change ${cohort.medianDeltaPts >= 0 ? '+' : ''}${cohort.medianDeltaPts.toFixed(1)} pts`,
    })
  }
  if (hypothetical) {
    const h = hypothetical
    const failed = h.checks.filter((c) => c.status === 'fail')
    const worse = h.deltaPts < -policy.goalWarnPts || failed.length > 0
    const advisedAgainst = !recommendsBuying.length
    evidence.push({
      kind: worse === advisedAgainst ? 'support' : 'against',
      text: `If you did what you asked: goal likelihood ${h.twinBefore.successPct.toFixed(0)}% → ${h.twinAfter.successPct.toFixed(0)}% (${h.deltaPts >= 0 ? '+' : ''}${h.deltaPts.toFixed(1)} pts), ${failed.length} of your limits broken${failed.length ? ` (${failed.map((c) => c.label.replace(/ \(.*\)$/, '').toLowerCase()).join(', ')})` : ''}. ${advisedAgainst ? (worse ? 'This backs the AI’s advice not to.' : 'The simulation does not show clear harm, so the AI may be over-cautious.') : ''}`,
    })
  }
  for (const h of citedHeadlines) evidence.push({ kind: h.verified ? 'support' : 'against', text: `Cites ${h.verified ? 'verified' : 'UNVERIFIED'} news: “${h.title}” (${h.source})` })
  if (rumorTickers.length) evidence.push({ kind: 'against', text: `Recommends buying ${rumorTickers.join(', ')}, the subject of an unverified rumour in today’s feed.` })

  return {
    verdict,
    verdictReason,
    checks,
    counts,
    verification,
    hypothetical,
    hypotheticalTrades,
    cohort,
    evidence,
    reading,
    scan,
    known,
    unknown,
    unverifiableRecs,
    citedHeadlines,
    rumorTickers,
    drift: detectDrift(reading.lean, reading.sources.lean, profile, ws, result.at),
  }
}

/** Turns the investor's explicit request into trades: buys funded from cash first, then pro rata from other holdings. */
export function requestedTrades(requested: RequestedTrade[], portfolio: Portfolio, u: Universe): Trade[] {
  const tot = total(portfolio)
  if (!tot) return []
  const cid = cashId(u)
  const net = new Map<string, number>()
  const hold = { ...portfolio }
  const add = (id: string, amt: number) => {
    net.set(id, (net.get(id) ?? 0) + amt)
    hold[id] = (hold[id] ?? 0) + amt
  }
  for (const r of requested) {
    const a = u.assets.find((x) => x.ticker === r.ticker.toUpperCase())
    if (!a) continue
    const want = r.usd > 0 ? r.usd : (Math.min(100, Math.max(0, r.percent)) / 100) * tot
    if (want <= 0) continue
    if (r.side === 'SELL') {
      const amt = Math.min(want, hold[a.id] ?? 0)
      if (amt <= 0) continue
      add(a.id, -amt)
      if (cid) add(cid, amt)
      continue
    }
    let need = want
    if (cid && a.id !== cid) {
      const fromCash = Math.min(need, hold[cid] ?? 0)
      if (fromCash > 0) add(cid, -fromCash)
      need -= fromCash
    }
    const others = Object.keys(hold).filter((id) => id !== a.id && id !== cid && (hold[id] ?? 0) > 0)
    const pool = others.reduce((s, id) => s + (hold[id] ?? 0), 0)
    const take = Math.min(need, pool)
    for (const id of others) add(id, -take * ((hold[id] ?? 0) / pool))
    add(a.id, want - need + take)
  }
  return [...net].filter(([, v]) => Math.abs(v) > 0.5).map(([asset, amount]) => ({ asset, amount: Math.round(amount) }))
}

/** The portfolio after following the advice (or unchanged). */
export const afterAdvice = (r: AdviceResult, profile: Profile) => applyTrades(profile.investor.portfolio, r.advisor.trades)

// ---------- the feedback loop (portal "Revise answers") ----------

/** One attempt in the portal's feedback loop: the advisor's answer and Clario's feedback on it (if it failed). */
export interface ReviseAttempt {
  advisor: AdvisorReply
  calls: LlmCall[]
  ms: number
  /** Clario's feedback that was sent back after this attempt (absent on the last one). */
  feedback?: ReturnType<typeof adviceFeedback>
}

/** The original result, re-pointed at a later attempt's answer (same question, same reading). */
export const attemptResult = (r: AdviceResult, a: ReviseAttempt, i: number): AdviceResult => (i === 0 ? r : { ...r, id: `${r.id}_v${i + 1}`, advisor: a.advisor, calls: a.calls, ms: a.ms })

/** Whether an assessed answer should go back to the advisor: any failed check means "revise". */
export const needsRevision = (a: Assessment) => a.counts.fail > 0

/**
 * Clario's structured feedback on a failed answer: what failed and the limits a revision must meet.
 * Facts and limits only, computed from the profile. It never suggests an investment.
 */
export function adviceFeedback(a: Assessment, result: AdviceResult, profile: Profile, ws: Workspace, attempt: number, max: number) {
  const u = ws.universe
  const inv = profile.investor
  const p = profile.policy
  const tot = total(inv.portfolio)
  const cid = cashId(u)
  const round = (n: number) => Math.max(0, Math.round(n / 100) * 100)
  const tech = u.assets.reduce((s, x) => s + (inv.portfolio[x.id] ?? 0) * x.techShare, 0)
  const equity = u.assets.reduce((s, x) => s + (x.equity ? (inv.portfolio[x.id] ?? 0) : 0), 0)
  return {
    type: 'CLARIO_FEEDBACK',
    attempt: `${attempt}/${max}`,
    verdict: a.verdict,
    violations: a.checks.filter((c) => c.status === 'fail').map((c) => ({ check: c.id, label: c.label, observed: c.observed, limit: c.limit, why: c.detail })),
    constraints_for_revision: {
      max_single_stock_usd: round((p.maxSingleStockPct / 100) * tot),
      max_additional_tech_exposure_usd: round((p.maxSectorPct / 100) * tot - tech),
      max_deployable_cash_usd: round((cid ? (inv.portfolio[cid] ?? 0) : 0) - p.minCash),
      max_additional_equity_usd: round((p.maxEquityPct / 100) * tot - equity),
      max_total_buys_usd: round((p.anomalyWarnPct / 100) * tot),
      max_volatility_pct: p.maxVolPct,
      max_goal_likelihood_drop_pts: p.materialGoalDropPts,
      only_listed_tickers: true,
      text_must_match_trades: true,
      ignore_unverified_headlines: ws.market.headlines.filter((h) => !h.verified).map((h) => h.id),
    },
    preserve: { question: result.question, objective: a.reading.objective, risk_profile: inv.riskProfile.toLowerCase() },
    note: 'Clario reports violations and limits only. It does not suggest investments.',
  }
}
