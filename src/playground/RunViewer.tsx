import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Bot, Brain, ChevronLeft, ChevronRight, CircleHelp, CornerDownLeft, FileWarning, Flag, Lock, Pause, Play, ShieldCheck, TriangleAlert, User } from 'lucide-react'
import type { Workspace } from '../engine/config'
import type { LiveRun, LlmCall, RunEvent } from '../engine/timeline'
import { Json } from '../ui/Json'
import { DECISION, DecisionPill } from '../ui/theme'
import { Pipeline } from './Pipeline'
import { DecisionBanner, TradeTable, VerificationView } from './viz'

const META: Record<RunEvent['t'], { label: string; icon: ReactNode; tone: string }> = {
  intent: { label: 'Investor speaks', icon: <User size={14} />, tone: 'bg-slate-800' },
  parse: { label: 'Rules read the goal', icon: <Brain size={14} />, tone: 'bg-teal-600' },
  unclear: { label: 'Intent unclear', icon: <CircleHelp size={14} />, tone: 'bg-amber-500' },
  lock: { label: 'Intent locked', icon: <Lock size={14} />, tone: 'bg-teal-600' },
  context: { label: 'Untrusted input', icon: <TriangleAlert size={14} />, tone: 'bg-rose-600' },
  propose: { label: 'Agent proposes', icon: <Bot size={14} />, tone: 'bg-indigo-600' },
  reject: { label: 'Validator rejects', icon: <FileWarning size={14} />, tone: 'bg-rose-500' },
  verify: { label: 'Clario verifies', icon: <ShieldCheck size={14} />, tone: 'bg-slate-900' },
  feedback: { label: 'Feedback to agent', icon: <CornerDownLeft size={14} />, tone: 'bg-amber-500' },
  outcome: { label: 'Outcome', icon: <Flag size={14} />, tone: 'bg-emerald-600' },
}

/** Dwell time per event at 1x speed, so animations can finish. */
const DWELL: Record<RunEvent['t'], number> = { intent: 1600, parse: 2200, unclear: 2500, lock: 2200, context: 2000, propose: 2600, reject: 2400, verify: 4200, feedback: 2400, outcome: 3000 }

export function RunViewer({ run, ws }: { run: LiveRun; ws: Workspace }) {
  const n = run.events.length
  const [idx, setIdx] = useState(0)
  const [follow, setFollow] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  // While streaming, follow the newest event. Afterwards the user can replay.
  useEffect(() => {
    if (follow) setIdx(n - 1)
  }, [n, follow])
  useEffect(() => {
    setFollow(true)
    setPlaying(false)
  }, [run.id])

  useEffect(() => {
    if (!playing) return
    if (idx >= n - 1) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setIdx((i) => i + 1), DWELL[run.events[idx].t] / speed)
    return () => clearTimeout(t)
  }, [playing, idx, n, speed, run.events])

  const go = (i: number) => {
    setFollow(false)
    setIdx(Math.max(0, Math.min(n - 1, i)))
  }
  const profile = ws.profiles.find((p) => p.id === run.profileId) ?? ws.profiles[0]
  const e = run.events[Math.min(idx, n - 1)]

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 pt-2">
        <Pipeline run={run} idx={Math.min(idx, n - 1)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => go(idx - 1)} disabled={idx === 0} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-40">
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => {
            if (!playing && idx >= n - 1) setIdx(0)
            setFollow(false)
            setPlaying(!playing)
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Pause' : idx >= n - 1 ? 'Replay' : 'Play'}
        </button>
        <button onClick={() => go(idx + 1)} disabled={idx >= n - 1} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-40">
          <ChevronRight size={16} />
        </button>
        <select value={speed} onChange={(ev) => setSpeed(Number(ev.target.value))} className="rounded-md border border-slate-200 bg-white px-1 py-1 text-xs">
          {[0.5, 1, 1.5, 2, 3].map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
        <input type="range" min={0} max={Math.max(0, n - 1)} value={Math.min(idx, n - 1)} onChange={(ev) => go(Number(ev.target.value))} className="min-w-[120px] flex-1 accent-indigo-600" />
        <span className="text-xs tabular-nums text-slate-500">
          step {Math.min(idx, n - 1) + 1}/{n} {run.done ? `· ${(run.totalMs / 1000).toFixed(1)}s total` : '· live'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[210px_minmax(0,1fr)]">
        <ol className="space-y-1">
          {run.events.map((x, k) => (
            <li key={k}>
              <button onClick={() => go(k)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs ${k === idx ? 'bg-indigo-50 font-semibold text-indigo-900 ring-1 ring-indigo-200' : k < idx ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-400 hover:bg-slate-50'}`}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-white ${META[x.t].tone}`}>{META[x.t].icon}</span>
                <span className="min-w-0 flex-1 truncate">{eventTitle(x, run)}</span>
                {x.t === 'verify' && <DecisionPill d={run.verifications[x.v].decision} size="sm" />}
              </button>
            </li>
          ))}
          {!run.done && (
            <li className="flex items-center gap-2 px-2 py-1 text-xs text-slate-400">
              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="h-2 w-2 rounded-full bg-indigo-500" />
              {run.pending === 'agent' ? 'Agent is thinking…' : 'Working…'}
            </li>
          )}
        </ol>

        <AnimatePresence mode="wait">
          <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
            {e && <EventDetail e={e} run={run} ws={ws} profileId={profile.id} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function eventTitle(e: RunEvent, run: LiveRun) {
  switch (e.t) {
    case 'parse':
      return `Rules → ${e.objective}`
    case 'propose':
      return `Agent proposal (attempt ${e.attempt})`
    case 'verify':
      return `Verify v${run.verifications[e.v].proposal.attempt}`
    case 'outcome':
      return `Outcome: ${DECISION[e.decision].label}`
    default:
      return META[e.t].label
  }
}

function Title({ kind, children, sub }: { kind: RunEvent['t']; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{META[kind].label}</div>
      <div className="text-[15px] font-semibold text-slate-900">{children}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

function EventDetail({ e, run, ws, profileId }: { e: RunEvent; run: LiveRun; ws: Workspace; profileId: string }) {
  const profile = ws.profiles.find((p) => p.id === profileId) ?? ws.profiles[0]
  switch (e.t) {
    case 'intent':
      return (
        <>
          <Title kind={e.t} sub={e.kind === 'request' ? 'A one-off request to the agent.' : 'A standing mandate the agent acts under.'}>{profile.investor.name} tells the agent</Title>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-block rounded-2xl rounded-tl-sm bg-slate-900 px-4 py-2.5 text-lg font-medium text-white">
            “{e.text}”
          </motion.div>
        </>
      )
    case 'parse':
      return (
        <>
          <Title kind={e.t} sub="Clario reads the request with fixed rules: no AI. If no rule tells the goal, the investor picks it.">
            Read as <code className="rounded bg-teal-50 px-1.5 text-teal-700">{e.objective}</code>
          </Title>
          <ul className="space-y-1 text-sm text-slate-600">
            {e.evidence.length ? e.evidence.map((x) => <li key={x}>⚙ {x}</li>) : <li>No rule matched.</li>}
          </ul>
        </>
      )
    case 'unclear':
      return (
        <>
          <Title kind={e.t} sub="Nothing is sent to the agent. The investor rephrases or picks an objective.">Clario could not map this to exactly one objective</Title>
          <p className="text-sm text-amber-800">“{e.restated}”</p>
        </>
      )
    case 'lock':
      return (
        <>
          <Title kind={e.t} sub="The objective comes from Clario’s rules (or the investor’s pick). Goal, risk profile and limits come from the profile in code. The object is frozen and fingerprinted.">The intent is locked</Title>
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            <Json value={e.intent} />
          </motion.div>
        </>
      )
    case 'context':
      return (
        <>
          <Title kind={e.t} sub="The server records where every input came from. Anything not from the investor is untrusted, whatever the agent claims.">Untrusted content enters the agent’s inputs</Title>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <div className="text-[11px] font-semibold text-rose-600">{e.source}</div>
            <div className="mt-1 font-mono text-sm font-semibold text-rose-900">{e.text}</div>
          </div>
        </>
      )
    case 'propose': {
      const call = run.calls[e.call]
      const o = (call.output ?? {}) as Record<string, unknown>
      const trades = Array.isArray(o.trades) ? (o.trades as { ticker: string; side: string; usd: number }[]) : []
      return (
        <>
          <Title kind={e.t} sub={`${run.agentName} · style “${run.style}” · ${call.model} · ${call.ms} ms`}>{String(o.summary ?? 'Proposal')}</Title>
          {typeof o.rationale === 'string' && <p className="mb-2 text-sm text-slate-600">{o.rationale}</p>}
          <TradeTable
            u={ws.universe}
            trades={trades.map((t) => ({ asset: ws.universe.assets.find((a) => a.ticker === String(t.ticker).toUpperCase())?.id ?? String(t.ticker), amount: (t.side === 'SELL' ? -1 : 1) * Number(t.usd) }))}
          />
          <div className="mt-3">
            <LlmCallCard call={call} />
          </div>
        </>
      )
    }
    case 'reject':
      return (
        <>
          <Title kind={e.t} sub="Malformed proposals never reach the checks and don’t count as an attempt. The errors go back to the agent to fix.">The validator rejected the agent’s output</Title>
          <ul className="space-y-1">
            {e.errors.map((x, k) => (
              <motion.li key={k} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.1 }} className="flex items-start gap-2 text-sm text-rose-800">
                <Ban size={14} className="mt-0.5 shrink-0" /> {x}
              </motion.li>
            ))}
          </ul>
        </>
      )
    case 'verify': {
      const v = run.verifications[e.v]
      return (
        <>
          <Title kind={e.t} sub="Deterministic. No AI in this step. Same proposal + same settings = same result.">
            Verification of v{v.proposal.attempt}: {v.proposal.summary}
          </Title>
          <VerificationView v={v} u={ws.universe} investor={profile.investor} play />
        </>
      )
    }
    case 'feedback':
      return (
        <>
          <Title kind={e.t} sub="What failed and which limits a revision must meet. Clario never picks the investment.">Structured feedback goes back to the agent</Title>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Json value={e.feedback} />
          </motion.div>
        </>
      )
    case 'outcome': {
      const v = run.verifications.at(-1)
      return (
        <>
          <Title kind={e.t} sub={`${run.verifications.length} verified attempt${run.verifications.length === 1 ? '' : 's'} · ${run.calls.length} LLM call${run.calls.length === 1 ? '' : 's'} · ${(run.totalMs / 1000).toFixed(1)}s`}>Final decision</Title>
          <DecisionBanner decision={e.decision} reason={v?.reason ?? 'The agent never produced a usable proposal, so a human has to decide.'} />
          {e.decision === 'ALLOW' && <p className="mt-2 text-xs text-slate-500">Passing Clario doesn’t execute anything. The investor still approves.</p>}
        </>
      )
    }
  }
}

export function LlmCallCard({ call }: { call: LlmCall }) {
  const [tab, setTab] = useState<'output' | 'prompt' | 'system' | 'raw'>('output')
  return (
    <div className="overflow-hidden rounded-xl border border-violet-200">
      <div className="flex flex-wrap items-center gap-1 border-b border-violet-100 bg-violet-50 px-2 py-1.5">
        <span className="mr-1 text-[11px] font-bold text-violet-700">
          {call.role === 'parser' ? 'Parser' : 'Agent'} LLM call · {call.model} · T={call.temperature} · {call.ms} ms
        </span>
        {(['output', 'prompt', 'system', 'raw'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${tab === t ? 'bg-violet-600 text-white' : 'text-violet-700 hover:bg-violet-100'}`}>
            {t}
          </button>
        ))}
      </div>
      {call.rejected && <div className="border-b border-rose-100 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">Rejected: {call.rejected.join('; ')}</div>}
      <div className="max-h-72 overflow-auto">
        {tab === 'output' ? (
          <Json value={call.output} />
        ) : (
          <pre className="whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed text-slate-700">{tab === 'prompt' ? call.prompt : tab === 'system' ? call.system : call.raw}</pre>
        )}
      </div>
    </div>
  )
}
