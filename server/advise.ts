// AI Advisory: one atomic question → the AI advisor's answer. This is the only AI call in the flow.
// Clario's reading of the request and its whole assessment (checks, simulation, verdict) are computed
// in code by src/engine/rules.ts and src/engine/advisory.ts, with no AI.

import type { AdviceResult, AdvisorReply, AdvisorVerdict } from '../src/engine/advisory'
import type { Profile, Workspace } from '../src/engine/config'
import { total, usd } from '../src/engine/model'
import { validateTrades } from '../src/engine/validate'
import { GeminiError, generateJson, PUBLIC_FALLBACKS, type LlmCall } from './gemini'
import { fill } from './intent'

const VERDICTS: AdvisorVerdict[] = ['do_it', 'do_partially', 'dont', 'not_applicable']
const strs = (v: unknown, max = 10) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 60)).filter(Boolean).slice(0, max) : [])

/** `revision`: Clario's feedback on a previous answer to the same question (the feedback loop). */
async function askAdvisor(question: string, ws: Workspace, profile: Profile, calls: LlmCall[], revision?: { previous: string; feedback: unknown }, fallbacks = PUBLIC_FALLBACKS): Promise<AdvisorReply> {
  const inv = profile.investor
  const assets = ws.universe.assets
  const style = ws.agent.styles.find((s) => s.id === ws.portal.advisorStyleId) ?? ws.agent.styles[0]
  const schema = {
    type: 'OBJECT',
    properties: {
      answer: { type: 'STRING' },
      verdict: { type: 'STRING', enum: VERDICTS },
      trades: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { ticker: { type: 'STRING', enum: assets.map((a) => a.ticker) }, side: { type: 'STRING', enum: ['BUY', 'SELL'] }, usd: { type: 'NUMBER' } },
          required: ['ticker', 'side', 'usd'],
          propertyOrdering: ['ticker', 'side', 'usd'],
        },
      },
      other_assets: { type: 'ARRAY', items: { type: 'STRING' } },
      cited_headlines: { type: 'ARRAY', items: { type: 'INTEGER' } },
    },
    required: ['answer', 'verdict', 'trades', 'other_assets', 'cited_headlines'],
    propertyOrdering: ['answer', 'verdict', 'trades', 'other_assets', 'cited_headlines'],
  }
  const p = profile.policy
  const limits = ws.agent.agentSeesLimits
    ? `- The client's limits: single stock ≤ ${p.maxSingleStockPct}%, technology ≤ ${p.maxSectorPct}%, cash ≥ ${usd(p.minCash)}, equity ≤ ${p.maxEquityPct}%, volatility ≤ ${p.maxVolPct}%.`
    : ''
  const system = fill(ws.portal.advisorSystemPrompt, { investor: inv.name, style: style?.prompt ?? '', objectives: ws.objectives.map((o) => o.label).join(', '), limits })

  const tot = total(inv.portfolio) || 1
  const m = ws.market
  const prompt = [
    `Client: ${inv.name}, age ${inv.age}, risk profile ${inv.riskProfile}, goal ${usd(inv.target)} by age ${inv.retireAge}, saves ${usd(inv.monthlyContribution)}/month. Stated preference: "${inv.preference || 'none'}".`,
    `Portfolio (total ${usd(tot)}):\n${assets.filter((a) => inv.portfolio[a.id]).map((a) => `- ${a.ticker}: ${usd(inv.portfolio[a.id] ?? 0)} (${(((inv.portfolio[a.id] ?? 0) / tot) * 100).toFixed(1)}%)`).join('\n') || '- (empty)'}`,
    `Instruments you can trade (illustrative prices, today's move):\n${assets.map((a) => `- ${a.ticker}: ${a.name} · ${a.kind}${a.sector ? ` · ${a.sector}` : ''} · $${a.price} (${(a.dayChangePct ?? 0) >= 0 ? '+' : ''}${a.dayChangePct}%)`).join('\n')}`,
    `Market today (${m.asOf}, mood: ${m.mood}): ${m.summary}\n${[...m.indices, ...m.other].map((q) => `- ${q.name} ${q.level} (${q.changePct >= 0 ? '+' : ''}${q.changePct}%)`).join('\n')}`,
    `Headlines:\n${m.headlines.map((h) => `[${h.id}] ${h.title} (${h.source}, ${h.time})`).join('\n')}`,
    `Client's question:\n"${question}"`,
    ...(revision
      ? [
          `Your previous answer to this question was rejected by Clario, an independent trust layer:\n<<<\n${revision.previous}\n>>>`,
          `Clario's feedback (what failed, and the limits a revision must meet):\n${JSON.stringify(revision.feedback, null, 2)}`,
          'Revise your answer to the same question so that it meets every constraint above. Keep the trades consistent with what your text says. Only use listed tickers. Do not rely on unverified headlines. Clario does not suggest investments: you choose them.',
        ]
      : []),
  ].join('\n\n')

  let repairErrors: string[] | undefined
  let last: { answer: string; verdict: AdvisorVerdict; other: string[]; cited: number[]; errors: string[] } | null = null
  for (let r = 0; r <= ws.agent.maxRepairs; r++) {
    const call = await generateJson('agent', ws.agent.model, system, repairErrors ? `${prompt}\n\nYour last "trades" could not be executed. Fix these problems and answer again:\n- ${repairErrors.join('\n- ')}` : prompt, schema, ws.agent.agentTemperature, fallbacks)
    calls.push(call)
    const o = (call.output ?? {}) as Record<string, unknown>
    if (typeof o.answer !== 'string') {
      call.rejected = ['No answer text.']
      repairErrors = ['"answer" is required.']
      continue
    }
    const base = {
      answer: o.answer.trim().slice(0, 3000),
      verdict: VERDICTS.includes(o.verdict as AdvisorVerdict) ? (o.verdict as AdvisorVerdict) : 'not_applicable',
      other: strs(o.other_assets),
      cited: Array.isArray(o.cited_headlines) ? o.cited_headlines.filter((x): x is number => typeof x === 'number').slice(0, 10) : [],
    }
    const v = validateTrades(ws.universe, inv.portfolio, o.trades, { allowEmpty: true })
    if (v.ok) return { answer: base.answer, verdict: base.verdict, trades: v.trades, other_assets: base.other, cited_headlines: base.cited }
    call.rejected = v.errors
    repairErrors = v.errors
    last = { ...base, errors: v.errors }
  }
  if (!last) throw new GeminiError('The AI advisor did not return an answer.')
  // Keep the answer but mark its trades as not executable.
  return { answer: last.answer, verdict: last.verdict, trades: [], other_assets: last.other, cited_headlines: last.cited, invalid: last.errors }
}

/** One turn of the feedback loop: the advisor revises its answer to the same question using Clario's feedback. */
export async function reviseAdvice(ws: Workspace, profileId: string, question: string, previous: string, feedback: unknown, fallbacks = PUBLIC_FALLBACKS): Promise<{ advisor: AdvisorReply; calls: LlmCall[]; ms: number }> {
  const t0 = Date.now()
  const profile = ws.profiles.find((p) => p.id === profileId)
  if (!profile) throw new GeminiError(`Unknown profile "${profileId}"`, 400)
  const calls: LlmCall[] = []
  const advisor = await askAdvisor(question, ws, profile, calls, { previous, feedback }, fallbacks)
  return { advisor, calls, ms: Date.now() - t0 }
}

export async function advise(ws: Workspace, profileId: string, question: string, fallbacks = PUBLIC_FALLBACKS): Promise<AdviceResult> {
  const t0 = Date.now()
  const profile = ws.profiles.find((p) => p.id === profileId)
  if (!profile) throw new GeminiError(`Unknown profile "${profileId}"`, 400)
  const advisorCalls: LlmCall[] = []
  const advisor = await askAdvisor(question, ws, profile, advisorCalls, undefined, fallbacks)
  const style = ws.agent.styles.find((s) => s.id === ws.portal.advisorStyleId)
  return {
    id: `adv_${t0.toString(36)}`,
    at: new Date(t0).toISOString(),
    question,
    profileId,
    advisor,
    calls: advisorCalls,
    model: ws.agent.model,
    style: style?.label ?? '',
    ms: Date.now() - t0,
  }
}
