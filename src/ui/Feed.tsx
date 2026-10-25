import { useEffect, useRef, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Ban, Bot, Check, CornerDownLeft, Lock, ShieldCheck, Siren, TriangleAlert, User, UserCheck } from 'lucide-react'
import { structuredIntent, type Flow, type Step } from '../engine/scenarios'
import type { Verification } from '../engine/guard'
import { ASSETS, ASSET_ORDER, pct, techExposure, total, usd, usdShort, type AssetId, type Investor, type Policy, type Portfolio } from '../engine/model'
import { Json } from './Json'
import { DECISION, DecisionPill, STATUS_TEXT, StatusIcon } from './theme'

export type Resolution = null | 'approved' | 'declined' | 'escalated' | 'notified'

interface Props {
  flow: Flow
  index: number
  investor: Investor
  policy: Policy
  agent: string
  resolution: Resolution
  onResolve: (r: Resolution) => void
}

/** The story so far: one card per step, newest highlighted. */
export function Feed(props: Props) {
  const { flow, index } = props
  const boxRef = useRef<HTMLDivElement>(null)
  const lastRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = boxRef.current
    const last = lastRef.current
    if (box && last) box.scrollTo({ top: Math.max(0, last.offsetTop - 12), behavior: 'smooth' })
  }, [index, flow])

  return (
    <div ref={boxRef} className="scroll-thin relative h-full space-y-3 overflow-y-auto pr-1 pb-24">
      {flow.steps.slice(0, index + 1).map((s, k) => (
        <div key={`${flow.scenario.id}-${k}`} ref={k === index ? lastRef : undefined}>
          <StepCard step={s} latest={k === index} {...props} />
        </div>
      ))}
    </div>
  )
}

function StepCard({ step, latest, flow, investor, policy, agent, resolution, onResolve }: Props & { step: Step; latest: boolean }) {
  const sc = flow.scenario
  switch (step.kind) {
    case 'intent':
      return (
        <Shell latest={latest} who="Investor · Maya" title={sc.intent.kind === 'request' ? 'States her intent to her AI agent' : 'Gives her AI agent a standing mandate'} icon={<User size={18} />} tone="bg-slate-800">
          <div className="inline-block rounded-2xl rounded-tl-sm bg-slate-900 px-4 py-2.5 text-lg font-medium text-white">“{sc.intent.text}”</div>
          <p className="mt-2 text-xs text-slate-500">
            {sc.intent.kind === 'request'
              ? 'The request goes to her AI agent. The same intent is locked inside Clario as the reference every proposal is checked against.'
              : 'The agent runs the portfolio on its own under this mandate. Clario keeps the mandate as the reference.'}
          </p>
        </Shell>
      )
    case 'parse':
      return (
        <Shell latest={latest} who="Clario · Intent lock" title="The intent becomes structured constraints and is locked" icon={<Lock size={18} />} tone="bg-teal-600">
          <p className="mb-2 text-sm text-slate-600">
            Maya said a few words. Clario merges them with her profile, so proposals are checked against her <b>whole plan</b> and not only the literal request.
          </p>
          <Json value={structuredIntent(sc, investor, policy)} />
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <Lock size={12} /> The agent can read these limits. Only the investor can change them.
          </p>
        </Shell>
      )
    case 'context':
      return (
        <Shell latest={latest} who="Agent context · untrusted source" title="Untrusted content gets into the agent’s inputs" icon={<TriangleAlert size={18} />} tone="bg-rose-600">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <div className="text-[11px] font-semibold text-rose-600">{sc.injected?.source}</div>
            <div className="mt-1 font-mono text-sm font-semibold text-rose-900">{sc.injected?.text}</div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            A controlled demo input. Autonomous agents read news, feeds and emails, and any of those can be used to push them into a bad action.
          </p>
        </Shell>
      )
    case 'propose':
      return <ProposalCard v={flow.verifications[step.i]} agent={agent} latest={latest} />
    case 'verify':
      return <VerifyCard v={flow.verifications[step.i]} latest={latest} />
    case 'feedback':
      return (
        <Shell latest={latest} who="Clario → AI Agent" title="Structured feedback, not a new investment" icon={<CornerDownLeft size={18} />} tone="bg-amber-500">
          <p className="mb-2 text-sm text-slate-600">
            Clario says what failed and which limits a new proposal has to meet. <b>It does not pick the investment.</b> The agent has to come up with the revision itself.
          </p>
          <Json value={flow.feedback[step.i]} />
        </Shell>
      )
    case 'outcome':
      if (step.decision === 'ALLOW') return <AllowCard flow={flow} investor={investor} latest={latest} resolution={resolution} onResolve={onResolve} />
      if (step.decision === 'BLOCK') return <BlockCard flow={flow} investor={investor} latest={latest} resolution={resolution} onResolve={onResolve} />
      return <EscalateCard flow={flow} latest={latest} resolution={resolution} onResolve={onResolve} />
  }
}

function Shell({ who, title, icon, tone, latest, children }: { who: string; title: ReactNode; icon: ReactNode; tone: string; latest: boolean; children: ReactNode }) {
  return (
    <motion.div
      initial={latest ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`flex gap-3 transition-opacity ${latest ? '' : 'opacity-60 hover:opacity-100'}`}
    >
      <div className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm ${tone}`}>{icon}</div>
      <div className={`min-w-0 flex-1 rounded-2xl border bg-white p-4 shadow-sm ${latest ? 'border-indigo-200 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{who}</div>
        <div className="mt-0.5 mb-2 text-[15px] font-semibold text-slate-900">{title}</div>
        {children}
      </div>
    </motion.div>
  )
}

function ProposalCard({ v, agent, latest }: { v: Verification; agent: string; latest: boolean }) {
  const p = v.proposal
  return (
    <Shell latest={latest} who={`AI Agent · ${agent} · mocked`} title={<>Proposal v{p.attempt}: {p.summary}</>} icon={<Bot size={18} />} tone="bg-indigo-600">
      {p.attempt > 1 && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          <CornerDownLeft size={12} /> Revised by the agent after Clario feedback
        </div>
      )}
      <p className="text-sm text-slate-600">{p.rationale}</p>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
        {p.trades.map((t) => (
          <div key={t.asset} className="flex items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-sm last:border-0">
            <span className={`w-11 rounded px-1.5 py-0.5 text-center text-[10px] font-bold ${t.amount > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
              {t.amount > 0 ? 'BUY' : 'SELL'}
            </span>
            <span className="w-12 font-mono font-semibold">{ASSETS[t.asset].ticker}</span>
            <span className="min-w-0 flex-1 truncate text-slate-500">{ASSETS[t.asset].name}</span>
            <span className="font-semibold tabular-nums">{usd(Math.abs(t.amount))}</span>
          </div>
        ))}
      </div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-slate-500 hover:text-slate-800">Payload sent to Clario · POST /v1/verify</summary>
        <Json
          className="mt-2"
          value={{
            proposal_id: p.id,
            agent: p.agent,
            action: p.action,
            trades: p.trades.map((t) => ({ ticker: ASSETS[t.asset].ticker, side: t.amount > 0 ? 'BUY' : 'SELL', usd: Math.abs(t.amount) })),
            rationale: p.rationale,
            context_source: p.contextSource,
          }}
        />
      </details>
    </Shell>
  )
}

function VerifyCard({ v, latest }: { v: Verification; latest: boolean }) {
  const d = DECISION[v.decision]
  const delay = (k: number) => (latest ? 0.15 + k * 0.14 : 0)
  return (
    <Shell
      latest={latest}
      who="Clario · Policy engine + Financial Twin + AgentGuard"
      title={
        <span className="flex flex-wrap items-center gap-2">
          Independent verification of v{v.proposal.attempt}
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">deterministic · no AI in this step</span>
        </span>
      }
      icon={<ShieldCheck size={18} />}
      tone="bg-slate-900"
    >
      <ul className="divide-y divide-slate-100">
        {v.checks.map((c, k) => (
          <motion.li
            key={c.id}
            initial={latest ? { opacity: 0, x: -10 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay(k), duration: 0.25 }}
            className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-3 py-2"
          >
            <span className="pt-0.5">
              <StatusIcon s={c.status} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-800">{c.label}</div>
              <div className="text-xs text-slate-500">{c.detail}</div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-semibold tabular-nums ${STATUS_TEXT[c.status]}`}>{c.observed}</div>
              <div className="text-[11px] text-slate-400">{c.limit}</div>
            </div>
          </motion.li>
        ))}
      </ul>
      <motion.div
        initial={latest ? { opacity: 0, scale: 0.96 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay(v.checks.length), duration: 0.3 }}
        className={`mt-3 flex items-center gap-3 rounded-xl border p-3 ${d.soft} ${d.border}`}
      >
        <DecisionPill d={v.decision} size="lg" />
        <span className={`text-sm font-medium ${d.text}`}>{v.reason}</span>
      </motion.div>
    </Shell>
  )
}

const last = (a: number[]) => a[a.length - 1]

function Kpi({ label, before, after, good }: { label: string; before: string; after: string; good: boolean | null }) {
  const color = good === null ? 'text-slate-900' : good ? 'text-emerald-700' : 'text-rose-600'
  return (
    <div className="rounded-xl border border-slate-200 p-2.5">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-xs text-slate-400 tabular-nums">{before} →</span>
        <span className={`text-lg font-bold tabular-nums ${color}`}>{after}</span>
      </div>
    </div>
  )
}

function AllocBar({ p, label }: { p: Portfolio; label: string }) {
  const tot = total(p)
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span className="font-medium text-slate-700">{label}</span>
        <span>Tech {pct((techExposure(p) / tot) * 100)}</span>
      </div>
      <div className="flex h-3.5 overflow-hidden rounded-full bg-slate-100">
        {ASSET_ORDER.filter((id) => p[id]).map((id) => (
          <div key={id} title={`${ASSETS[id].ticker} ${usd(p[id] ?? 0)}`} style={{ width: `${((p[id] ?? 0) / tot) * 100}%`, background: ASSETS[id].color }} />
        ))}
      </div>
    </div>
  )
}

function Legend({ ports }: { ports: Portfolio[] }) {
  const ids = ASSET_ORDER.filter((id) => ports.some((p) => p[id]))
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
      {ids.map((id: AssetId) => (
        <span key={id} className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: ASSETS[id].color }} />
          {ASSETS[id].ticker}
        </span>
      ))}
    </div>
  )
}

type OutcomeProps = { flow: Flow; latest: boolean; resolution: Resolution; onResolve: (r: Resolution) => void }

function Done({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white">
      <Check size={16} className="text-emerald-400" /> {children}
    </motion.div>
  )
}

function AllowCard({ flow, investor, latest, resolution, onResolve }: OutcomeProps & { investor: Investor }) {
  const v = flow.verifications[flow.verifications.length - 1]
  const rejected = flow.verifications.find((x) => x.decision !== 'ALLOW')
  const b = v.twinBefore
  const a = v.twinAfter
  return (
    <Shell latest={latest} who="Investor dashboard · what Maya sees" title="What happens to Maya’s money if she approves" icon={<UserCheck size={18} />} tone="bg-emerald-600">
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Modeled goal likelihood" before={pct(b.successPct, 0)} after={pct(a.successPct, 0)} good={v.deltaPts > -2} />
        <Kpi label={`Median value at ${investor.retireAge}`} before={usdShort(last(b.p50))} after={usdShort(last(a.p50))} good={null} />
        <Kpi label="Bad case (1 in 10 scenarios)" before={usdShort(last(b.p10))} after={usdShort(last(a.p10))} good={last(a.p10) >= last(b.p10) * 0.98} />
      </div>
      <div className="mt-3 space-y-2">
        <AllocBar p={v.before} label="Today" />
        <AllocBar p={v.after} label={`After approving v${v.proposal.attempt}`} />
        <Legend ports={[v.before, v.after]} />
      </div>
      {rejected && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <b>What Clario stopped:</b> the first proposal ({rejected.proposal.summary}) would have moved her goal likelihood to{' '}
          <b>{pct(rejected.twinAfter.successPct, 0)}</b> and her bad-case outcome to <b>{usdShort(last(rejected.twinAfter.p10))}</b> (today: {usdShort(last(b.p10))}). Tech exposure would have hit{' '}
          <b>{pct((techExposure(rejected.after) / total(rejected.after)) * 100)}</b>.
        </div>
      )}
      {resolution === 'approved' ? (
        <Done>Approved by Maya. Simulated only, no real trade executed. Logged to the audit trail.</Done>
      ) : resolution === 'declined' ? (
        <Done>Declined by Maya. Nothing executed. The investor always keeps the final say.</Done>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => onResolve('approved')} className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700">
            Approve (simulated)
          </button>
          <button onClick={() => onResolve('declined')} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">
            Decline
          </button>
          <span className="text-xs text-slate-400">Passing Clario doesn’t execute anything. Maya approves.</span>
        </div>
      )}
    </Shell>
  )
}

function BlockCard({ flow, investor, latest, resolution, onResolve }: OutcomeProps & { investor: Investor }) {
  const v = flow.verifications[flow.verifications.length - 1]
  const failed = v.checks.filter((c) => c.status === 'fail')
  const traded = v.proposal.trades.reduce((s, t) => s + Math.max(0, t.amount), 0)
  const fromContext = failed.some((c) => c.id === 'context')
  return (
    <Shell latest={latest} who="Clario · AgentGuard" title="Blocked. Nothing was executed." icon={<Ban size={18} />} tone="bg-rose-600">
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Goal likelihood if executed" before={pct(v.twinBefore.successPct, 0)} after={pct(v.twinAfter.successPct, 0)} good={false} />
        <Kpi label={`Bad case at ${investor.retireAge}`} before={usdShort(last(v.twinBefore.p10))} after={usdShort(last(v.twinAfter.p10))} good={false} />
        <Kpi label="Size of the move" before="typical < 5%" after={pct((traded / total(v.before)) * 100, 0)} good={false} />
      </div>
      <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
        {failed.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <StatusIcon s="fail" size={15} />
            <span className="text-slate-700">{c.label}</span>
            <span className="ml-auto text-xs font-semibold text-rose-600 tabular-nums">{c.observed}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Message to Maya</div>
        <p className="mt-1 text-sm text-slate-700">
          “Your agent proposed: <b>{v.proposal.summary}</b>.{fromContext ? ' It was reacting to an unverified “urgent” alert, not to anything you asked for.' : ''} That
          doesn’t fit your moderate-risk plan or your retirement goal, so Clario blocked it. Your portfolio is unchanged.”
        </p>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Clario doesn’t claim to catch every manipulation. It blocked this because the action breaks Maya’s policy and goal, whatever the cause.
      </p>
      {resolution === 'notified' ? (
        <Done>Maya notified. Incident logged to the audit trail.</Done>
      ) : (
        <button onClick={() => onResolve('notified')} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800">
          Notify Maya (simulated)
        </button>
      )}
    </Shell>
  )
}

function EscalateCard({ flow, latest, resolution, onResolve }: OutcomeProps) {
  const v = flow.verifications[flow.verifications.length - 1]
  return (
    <Shell latest={latest} who="Clario · AgentGuard" title="Escalated to a human. Never approved automatically." icon={<Siren size={18} />} tone="bg-violet-600">
      <div className="overflow-hidden rounded-xl border border-slate-200">
        {flow.verifications.map((x) => (
          <div key={x.proposal.id} className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-0">
            <span className="w-7 font-mono text-xs font-bold text-slate-400">v{x.proposal.attempt}</span>
            <span className="min-w-0 flex-1 truncate">{x.proposal.summary}</span>
            <span className="hidden text-xs text-rose-600 md:inline">
              {x.checks.filter((c) => c.status === 'fail').map((c) => c.label.split(' (')[0]).join(', ')}
            </span>
            <DecisionPill d={x.decision} size="sm" />
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-violet-800">{v.reason}</p>
      <p className="mt-1 text-xs text-slate-500">
        A packet goes to Maya’s advisor with the locked intent, every attempt, the remaining violations and the Twin comparison. An unclear authorization never quietly turns into an approval.
      </p>
      {resolution === 'escalated' ? (
        <Done>Sent to the advisor review queue (simulated).</Done>
      ) : (
        <button onClick={() => onResolve('escalated')} className="mt-3 rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700">
          Send to advisor queue (simulated)
        </button>
      )}
    </Shell>
  )
}
