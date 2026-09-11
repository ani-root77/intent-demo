import { ArrowRight, Bot, Building2, CircleCheck, CircleX, ShieldCheck, User, UserCog } from 'lucide-react'
import { Json } from './Json'
import { Card, DECISION, DecisionPill, SectionTitle } from './theme'
import type { Decision } from '../engine/guard'

const DUTIES = [
  ['AI Agent', 'Yes', 'Reasoning, research, proposals, revisions', 'Final authorization, hard policy enforcement'],
  ['Intent Parser', 'Optional', 'Turns natural language into structured intent', 'Overriding hard constraints'],
  ['Financial Twin', 'Mostly no', 'Simulation and quantitative comparison', 'Investment recommendations'],
  ['Policy / Risk Engine', 'No', 'Hard constraints and risk checks', 'Creative recommendations'],
  ['AgentGuard', 'No (deterministic)', 'The final verification decision', 'Inventing replacement investments'],
  ['Investor', 'Human', 'Final approval', '—'],
]

const COMPARE = [
  ['AI advisor', 'What should I invest in?', 'The AI is still the main decision-maker'],
  ['Fraud detector', 'Is this transaction suspicious?', 'Doesn’t know this investor’s goals'],
  ['AI self-checker', 'Does the AI think its answer is OK?', 'The AI is still judging itself'],
  ['INTENT', 'Is this action faithful to the investor’s intent, constraints and long-term goal?', 'Independent verification and authorization'],
]

const PRINCIPLES = [
  'AI proposes. It never authorizes itself.',
  'Hard investor constraints live outside the AI agent.',
  'The verifier never invents the replacement investment.',
  'Failed proposals loop back to the AI agent.',
  'Every revised proposal is re-verified independently.',
  'The investor has the final approval.',
  'Simulation assumptions are transparent.',
  'An unclear authorization never quietly becomes an approval.',
  'Decisions are explainable and auditable.',
  'Autonomy is made trustworthy, not removed.',
]

const NOT = ['A robo-advisor', 'A financial chatbot', 'A stock picker', 'A second AI critiquing the first', 'A replacement for the advisor', 'A guarantee of returns']

const REQUEST = {
  investor_id: 'inv_maya_demo',
  proposal: {
    proposal_id: 'prop_7f3a',
    agent: 'any-vendor-agent',
    trades: [{ ticker: 'NVAI', side: 'BUY', usd: 35000 }, { ticker: 'CASH', side: 'SELL', usd: 35000 }],
    rationale: 'Maximize AI exposure per dollar',
    context_sources: ['investor_request'],
  },
}

const RESPONSE = {
  decision: 'REVISE',
  checks: { position: 'fail', sector: 'fail', cash: 'fail', risk: 'fail', goal: 'fail', intent: 'pass', anomaly: 'warn', context: 'pass' },
  twin: { goal_likelihood_before: 0.75, goal_likelihood_after: 0.66 },
  constraints_for_revision: { max_single_stock_usd: 15000, max_deployable_cash_usd: 25000 },
  audit_id: 'aud_91c2e0',
}

export function HowItWorks() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 pb-16">
      <section className="rounded-3xl bg-slate-950 px-8 py-10 text-white">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">Core thesis</div>
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight md:text-4xl">
          AI can make the decision. <span className="text-emerald-400">It should never be the judge of its own decision.</span>
        </h1>
        <p className="mt-4 max-w-3xl text-slate-300">
          INTENT is an independent trust layer for autonomous investing. It checks every AI-generated financial action against the investor’s intent, hard constraints, risk profile
          and modeled long-term outcome before anything can go ahead.
        </p>
      </section>

      <Card className="p-6">
        <SectionTitle>Bring any agent. The protection stays the same.</SectionTitle>
        <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1.3fr_auto_1fr]">
          <div className="space-y-2">
            {['Vendor A · LLM agent', 'Vendor B · robo-agent', 'In-house research agent'].map((a) => (
              <div key={a} className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800">
                <Bot size={16} /> {a}
              </div>
            ))}
            <p className="text-center text-[11px] text-slate-400">Not built by us. Swappable.</p>
          </div>
          <ArrowRight className="mx-auto hidden text-slate-300 md:block" />
          <div className="rounded-2xl bg-slate-900 p-4 text-white ring-4 ring-emerald-400/30">
            <div className="flex items-center gap-2 font-extrabold tracking-wide">
              <ShieldCheck className="text-emerald-400" /> INTENT
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {['Intent lock', 'Policy / risk engine', 'Financial Twin', 'AgentGuard'].map((c) => (
                <div key={c} className="rounded-lg bg-white/10 px-2 py-1.5 font-semibold">
                  {c}
                </div>
              ))}
            </div>
            <div className="mt-3 font-mono text-[11px] text-emerald-300">POST /v1/verify → ALLOW | REVISE | BLOCK | HUMAN_REVIEW</div>
          </div>
          <ArrowRight className="mx-auto hidden text-slate-300 md:block" />
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium">
              <User size={16} /> Investor approves
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium">
              <UserCog size={16} /> Advisor reviews
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium">
              <Building2 size={16} /> Firm audit / compliance
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Most AI-investing ideas ship the agent and its safety check as one product, so the AI ends up grading its own homework. INTENT is <b>only</b> the verification layer.
          Any agent can plug into it, and the investor’s protection doesn’t depend on which agent they use.
        </p>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <SectionTitle>Agent → INTENT (request)</SectionTitle>
          <Json value={REQUEST} />
        </Card>
        <Card className="p-6">
          <SectionTitle>INTENT → Agent (response)</SectionTitle>
          <Json value={RESPONSE} />
        </Card>
      </div>

      <Card className="p-6">
        <SectionTitle>Separation of duties</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-2">Component</th>
                <th>AI?</th>
                <th>Owns</th>
                <th>Does not own</th>
              </tr>
            </thead>
            <tbody>
              {DUTIES.map(([c, ai, owns, not]) => (
                <tr key={c} className="border-t border-slate-100">
                  <td className="py-2 font-semibold">{c}</td>
                  <td className="text-slate-600">{ai}</td>
                  <td className="text-slate-600">{owns}</td>
                  <td className="text-slate-500">{not}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <SectionTitle>How INTENT differs</SectionTitle>
          <div className="space-y-2">
            {COMPARE.map(([a, q, d]) => (
              <div key={a} className={`rounded-xl border p-3 text-sm ${a === 'INTENT' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {a === 'INTENT' ? <CircleCheck size={16} className="text-emerald-600" /> : <CircleX size={16} className="text-slate-400" />}
                  {a}
                </div>
                <div className="mt-1 text-slate-600">“{q}”</div>
                <div className="text-xs text-slate-500">{d}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <SectionTitle>Four decisions</SectionTitle>
          <div className="space-y-2">
            {(Object.keys(DECISION) as Decision[]).map((d) => (
              <div key={d} className={`flex items-center gap-3 rounded-xl border p-3 ${DECISION[d].border} ${DECISION[d].soft}`}>
                <div className="w-32">
                  <DecisionPill d={d} size="sm" />
                </div>
                <div className="text-sm">
                  <div className="font-semibold text-slate-800">{DECISION[d].blurb}</div>
                  <div className="text-xs text-slate-500">{DECISION[d].next}</div>
                </div>
              </div>
            ))}
          </div>
          <SectionTitle>
            <span className="mt-5 block">What INTENT is not</span>
          </SectionTitle>
          <div className="flex flex-wrap gap-2">
            {NOT.map((n) => (
              <span key={n} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 line-through decoration-rose-400">
                {n}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <SectionTitle>Non-negotiable principles</SectionTitle>
        <ol className="grid gap-2 text-sm md:grid-cols-2">
          {PRINCIPLES.map((p, k) => (
            <li key={p} className="flex gap-3 rounded-xl bg-slate-50 p-3">
              <span className="font-mono font-bold text-emerald-600">{String(k + 1).padStart(2, '0')}</span>
              <span className="text-slate-700">{p}</span>
            </li>
          ))}
        </ol>
      </Card>
    </main>
  )
}
