// The AI agent: a real Gemini call standing in for any third-party investment agent.
// It sees what a normal agent would see (the request, the portfolio, its inputs, and Clario's
// feedback). It does not see or control the locked intent, the policy store or the verifier.

import type { AgentSettings, EngineConfig } from '../src/engine/config'
import { total, usd, type Investor, type Policy } from '../src/engine/model'
import { generateJson, type LlmCall } from './gemini'
import { fill } from './intent'
import type { ContextItem } from './sessions'

export interface AgentInput {
  name: string
  stylePrompt: string
  settings: AgentSettings
  cfg: EngineConfig
  investor: Investor
  policy: Policy
  kind: 'request' | 'mandate'
  context: ContextItem[]
  feedback?: unknown
  repairErrors?: string[]
}

export async function agentPropose(a: AgentInput): Promise<LlmCall> {
  const inv = a.investor
  const assets = a.cfg.universe.assets
  const schema = {
    type: 'OBJECT',
    properties: {
      action: { type: 'STRING', enum: ['BUY', 'SELL', 'REBALANCE'] },
      summary: { type: 'STRING', description: 'One line, e.g. "Buy $15,000 of XYZ".' },
      rationale: { type: 'STRING', description: 'Two or three sentences explaining the action.' },
      addresses: { type: 'STRING', enum: a.cfg.objectives.map((o) => o.id) },
      trades: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            ticker: { type: 'STRING', enum: assets.map((x) => x.ticker) },
            side: { type: 'STRING', enum: ['BUY', 'SELL'] },
            usd: { type: 'NUMBER' },
          },
          required: ['ticker', 'side', 'usd'],
          propertyOrdering: ['ticker', 'side', 'usd'],
        },
      },
    },
    required: ['action', 'summary', 'rationale', 'addresses', 'trades'],
    propertyOrdering: ['action', 'summary', 'rationale', 'addresses', 'trades'],
  }

  const p = a.policy
  const limits = a.settings.agentSeesLimits
    ? `- The investor's limits: single stock ≤ ${p.maxSingleStockPct}%, technology ≤ ${p.maxSectorPct}%, cash ≥ ${usd(p.minCash)}, equity ≤ ${p.maxEquityPct}%, volatility ≤ ${p.maxVolPct}%.`
    : ''
  const system = fill(a.settings.agentSystemPrompt, {
    agent: a.name,
    investor: inv.name,
    style: a.stylePrompt,
    objectives: a.cfg.objectives.map((o) => `${o.id} (${o.label})`).join(', '),
    limits,
  })

  const tot = total(inv.portfolio) || 1
  const holdings = assets.filter((x) => inv.portfolio[x.id]).map((x) => `- ${x.ticker}: ${usd(inv.portfolio[x.id] ?? 0)} (${(((inv.portfolio[x.id] ?? 0) / tot) * 100).toFixed(1)}%)`)
  const universe = assets.map((x) => `- ${x.ticker}: ${x.name} (${x.kind}, ~${Math.round(x.techShare * 100)}% technology)`)
  const [instruction, ...inputs] = a.context

  const parts = [
    `Investor: ${inv.name}, age ${inv.age}, risk profile ${inv.riskProfile}, goal ${usd(inv.target)} by age ${inv.retireAge}, saves ${usd(inv.monthlyContribution)}/month.`,
    `Current portfolio (total ${usd(tot)}):\n${holdings.join('\n') || '- (empty)'}`,
    `Tradable instruments:\n${universe.join('\n')}`,
    `${a.kind === 'request' ? 'Investor request' : 'Standing mandate from the investor'}:\n"${instruction.text}"`,
    ...inputs.map((c) => `Incoming information (${c.source}):\n${c.text}`),
  ]
  if (a.feedback) parts.push(`Feedback from Clario on your previous proposal:\n${JSON.stringify(a.feedback, null, 2)}`)
  if (a.repairErrors?.length) parts.push(`Your last output was rejected as malformed. Fix these problems:\n- ${a.repairErrors.join('\n- ')}`)

  return generateJson('agent', a.settings.model, system, parts.join('\n\n'), schema, a.settings.agentTemperature)
}
