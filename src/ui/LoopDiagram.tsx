import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Ban, Bot, Hourglass, Lock, ShieldCheck, Siren, TriangleAlert, User, UserCheck } from 'lucide-react'
import type { Flow } from '../engine/scenarios'
import { DECISION, DecisionPill } from './theme'

type EdgeId = 'request' | 'lock' | 'context' | 'proposal' | 'feedback' | 'decision'
type NodeId = 'investor' | 'agent' | 'intent' | 'outcome' | 'context'

const H = 262
const CY = 152
const NH = 90

/** The Generate -> Verify -> Revise -> Verify loop, animated for the current step. */
export function LoopDiagram({ flow, index, agent }: { flow: Flow; index: number; agent: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(1100)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const nw = Math.max(150, Math.min(240, W * 0.2))
  const x = [0.11, 0.37, 0.63, 0.89].map((f) => f * W)
  const top = CY - NH / 2
  const bottom = CY + NH / 2

  const step = flow.steps[index]
  let vIdx = -1
  flow.steps.slice(0, index + 1).forEach((s) => {
    if (s.kind === 'verify') vIdx = s.i
  })
  const lastV = vIdx >= 0 ? flow.verifications[vIdx] : null
  const attempt = step.kind === 'propose' || step.kind === 'verify' || step.kind === 'feedback' ? step.i + 1 : Math.max(1, vIdx + 1)

  const active: EdgeId[] = []
  let hot: NodeId = 'investor'
  switch (step.kind) {
    case 'intent':
      active.push('request')
      hot = 'investor'
      break
    case 'parse':
      active.push('lock')
      hot = 'intent'
      break
    case 'context':
      active.push('context')
      hot = 'context'
      break
    case 'propose':
      active.push('proposal')
      hot = 'agent'
      break
    case 'verify':
      hot = 'intent'
      break
    case 'feedback':
      active.push('feedback')
      hot = 'agent'
      break
    case 'outcome':
      active.push('decision')
      hot = 'outcome'
      break
  }

  const outcomeColor = DECISION[flow.final].hex
  const ctxTop = 58
  const ctxH = 38
  const edges: { id: EdgeId; d: string; color: string; label: string; lx: number; ly: number; show: boolean }[] = [
    { id: 'request', d: `M ${x[0] + nw / 2} ${CY} L ${x[1] - nw / 2 - 4} ${CY}`, color: '#4f46e5', label: 'request', lx: (x[0] + x[1]) / 2, ly: CY - 10, show: true },
    { id: 'lock', d: `M ${x[0]} ${top} C ${x[0]} 6, ${x[2]} 6, ${x[2]} ${top - 4}`, color: '#0d9488', label: 'intent + hard constraints (locked, agent can’t edit)', lx: (x[0] + x[2]) / 2, ly: 24, show: true },
    { id: 'context', d: `M ${x[1]} ${ctxTop + ctxH} L ${x[1]} ${top - 4}`, color: '#e11d48', label: '', lx: 0, ly: 0, show: !!flow.scenario.injected },
    { id: 'proposal', d: `M ${x[1] + nw / 2} ${CY} L ${x[2] - nw / 2 - 4} ${CY}`, color: '#4f46e5', label: `proposal v${attempt}`, lx: (x[1] + x[2]) / 2, ly: CY - 10, show: true },
    { id: 'feedback', d: `M ${x[2]} ${bottom} C ${x[2]} ${H + 8}, ${x[1]} ${H + 8}, ${x[1]} ${bottom + 4}`, color: '#d97706', label: 'REVISE · structured feedback', lx: (x[1] + x[2]) / 2, ly: H - 22, show: true },
    { id: 'decision', d: `M ${x[2] + nw / 2} ${CY} L ${x[3] - nw / 2 - 4} ${CY}`, color: outcomeColor, label: 'decision', lx: (x[2] + x[3]) / 2, ly: CY - 10, show: true },
  ]

  const intentChips: { label: string; on: boolean }[] = [
    { label: 'Intent lock', on: step.kind === 'parse' },
    { label: 'Policy engine', on: step.kind === 'verify' },
    { label: 'Financial Twin', on: step.kind === 'verify' },
    { label: 'AgentGuard', on: step.kind === 'verify' || step.kind === 'feedback' || step.kind === 'outcome' },
  ]

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: H }}>
      {/* The INTENT layer band */}
      <div
        className="absolute rounded-2xl border border-dashed border-emerald-400/70 bg-emerald-400/5"
        style={{ left: x[2] - nw / 2 - 18, width: nw + 36, top: 44, height: H - 64 }}
      >
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
          independent layer
        </span>
      </div>

      <svg width={W} height={H} className="pointer-events-none absolute inset-0 overflow-visible">
        <defs>
          {edges.map((e) => (
            <marker key={e.id} id={`m-${e.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={e.color} />
            </marker>
          ))}
          <marker id="m-off" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
          </marker>
        </defs>
        {edges
          .filter((e) => e.show)
          .map((e) => {
            const on = active.includes(e.id)
            return (
              <g key={e.id}>
                <path d={e.d} fill="none" stroke={on ? e.color : '#cbd5e1'} strokeWidth={on ? 2.6 : 1.6} className={on ? 'dash-flow' : ''} markerEnd={`url(#m-${on ? e.id : 'off'})`} />
                {on && (
                  <circle key={`${index}-${e.id}`} r={5.5} fill={e.color}>
                    <animateMotion dur="1.3s" repeatCount="indefinite" path={e.d} />
                  </circle>
                )}
                {e.label && (
                  <text
                    x={e.lx}
                    y={e.ly}
                    textAnchor="middle"
                    fontSize={11.5}
                    fontWeight={on ? 700 : 500}
                    fill={on ? e.color : '#94a3b8'}
                    style={{ paintOrder: 'stroke', stroke: '#f8fafc', strokeWidth: 5 }}
                  >
                    {e.label}
                  </text>
                )}
              </g>
            )
          })}
      </svg>

      {flow.scenario.injected && (
        <div
          className={`absolute flex items-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold transition-all ${
            hot === 'context' ? 'border-rose-400 bg-rose-600 text-white shadow-lg shadow-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
          style={{ left: x[1] - nw / 2, width: nw, top: ctxTop, height: ctxH }}
        >
          <TriangleAlert size={14} className="shrink-0" />
          <span className="truncate">Untrusted “URGENT” alert</span>
        </div>
      )}

      <Node cx={x[0]} w={nw} hot={hot === 'investor'}>
        <NodeHead icon={<User size={16} />} title="Investor" tone="bg-slate-800" />
        <p className="mt-1 text-xs text-slate-500">Maya · Moderate risk</p>
        <p className="text-[11px] text-slate-400">Final approval authority</p>
      </Node>

      <Node cx={x[1]} w={nw} hot={hot === 'agent'}>
        <div className="flex items-center justify-between gap-1">
          <NodeHead icon={<Bot size={16} />} title="AI Agent" tone="bg-indigo-600" />
          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">v{attempt}</span>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">{agent}</p>
        <p className="text-[11px] font-medium text-indigo-500">External · proposes only</p>
      </Node>

      <Node cx={x[2]} w={nw} hot={hot === 'intent'} dark>
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500 text-slate-950">
            <ShieldCheck size={16} />
          </span>
          <span className="font-extrabold tracking-wide">INTENT</span>
          {step.kind === 'verify' && <span className="ml-auto h-2 w-2 animate-ping rounded-full bg-emerald-400" />}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {intentChips.map((c) => (
            <span key={c.label} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${c.on ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-slate-300'}`}>
              {c.label === 'Intent lock' && <Lock size={9} className="mr-0.5 inline -translate-y-px" />}
              {c.label}
            </span>
          ))}
        </div>
      </Node>

      <Node cx={x[3]} w={nw} hot={hot === 'outcome'}>
        <OutcomeBody flow={flow} terminal={step.kind === 'outcome'} last={lastV?.decision ?? null} />
      </Node>
    </div>
  )
}

function Node({ cx, w, hot, dark, children }: { cx: number; w: number; hot: boolean; dark?: boolean; children: ReactNode }) {
  return (
    <div
      className={`absolute rounded-xl border p-2.5 transition-[transform,box-shadow] duration-300 ${
        dark ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-200 bg-white'
      } ${hot ? 'z-10 scale-[1.04] shadow-xl ring-4 ring-indigo-300/60' : 'shadow-sm'}`}
      style={{ left: cx - w / 2, width: w, top: CY - NH / 2, height: NH }}
    >
      {children}
    </div>
  )
}

function NodeHead({ icon, title, tone }: { icon: ReactNode; title: string; tone: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`grid h-7 w-7 place-items-center rounded-lg text-white ${tone}`}>{icon}</span>
      <span className="font-bold text-slate-900">{title}</span>
    </div>
  )
}

function OutcomeBody({ flow, terminal, last }: { flow: Flow; terminal: boolean; last: string | null }) {
  if (terminal) {
    const d = flow.final
    const icon = d === 'ALLOW' ? <UserCheck size={16} /> : d === 'BLOCK' ? <Ban size={16} /> : <Siren size={16} />
    const text = d === 'ALLOW' ? 'Investor approves' : d === 'BLOCK' ? 'Nothing executed' : 'Advisor decides'
    return (
      <>
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: DECISION[d].hex }}>
            {icon}
          </span>
          <DecisionPill d={d} size="sm" />
        </div>
        <p className="mt-1.5 text-sm font-semibold text-slate-800">{text}</p>
        <p className="text-[11px] text-slate-400">{DECISION[d].next}</p>
      </>
    )
  }
  return (
    <>
      <NodeHead icon={<Hourglass size={16} />} title="Outcome" tone="bg-slate-400" />
      {last === 'REVISE' ? (
        <p className="mt-1.5 text-xs text-amber-700">
          Last: <b>REVISE</b>. Nothing reaches the investor yet
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500">Waiting on verification</p>
      )}
    </>
  )
}
