import { useId, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import type { Check, Decision, Meter, Verification } from '../engine/guard'
import { assetOf, pct, total, usd, usdShort, type Investor, type Portfolio, type Universe } from '../engine/model'
import type { TwinResult } from '../engine/twin'
import { DECISION, DecisionPill, StatusIcon, STATUS_TEXT } from '../ui/theme'
import { CountUp } from './fields'

const STATUS_HEX = { pass: '#059669', warn: '#d97706', fail: '#e11d48', off: '#cbd5e1' } as const
const MODE_STYLE = { block: 'text-rose-600/70', revise: 'text-amber-600/80', off: 'text-slate-400' } as const

const fmtUnit = (n: number, unit: Meter['unit']) => (unit === '$' ? usdShort(n) : unit === 'pts' ? `${n.toFixed(1)} pts` : pct(n))

/** One check with an animated meter: the bar grows from the "before" value to the proposal's value. */
export function CheckRow({ c, k, play }: { c: Check; k: number; play: boolean }) {
  const m = c.meter
  const delay = play ? 0.1 + k * 0.18 : 0
  const scale = m ? Math.max(m.limit * 1.5, m.value * 1.08, (m.before ?? 0) * 1.08, m.warn ?? 0, 1e-9) : 1
  const x = (n: number) => `${Math.min(100, Math.max(0, (n / scale) * 100))}%`
  return (
    <motion.li initial={play ? { opacity: 0, x: -12 } : false} animate={{ opacity: 1, x: 0 }} transition={{ delay, duration: 0.25 }} className={`py-2 ${c.status === 'off' ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2">
        <motion.span initial={play ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ delay: delay + 0.45, type: 'spring', stiffness: 400 }} className="pt-0.5">
          <StatusIcon s={c.status} size={17} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-slate-800">{c.label}</span>
            <span title="What happens if this check fails (set per profile)" className={`rounded bg-slate-50 px-1 py-px text-[9px] font-semibold tracking-wide ${MODE_STYLE[c.mode]}`}>{c.mode === 'off' ? 'check off' : `if it fails: ${c.mode}`}</span>
          </div>
          <div className="text-xs text-slate-500">{c.detail}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-sm font-semibold tabular-nums ${STATUS_TEXT[c.status]}`}>{c.observed}</div>
          <div className="text-[11px] text-slate-400">{c.limit}</div>
        </div>
      </div>
      {m && c.status !== 'off' && (
        <div className="relative mt-1.5 ml-6 h-2.5 rounded-full bg-slate-100">
          {/* allowed zone */}
          <div className="absolute inset-y-0 rounded-full bg-emerald-100" style={m.kind === 'max' ? { left: 0, width: x(m.limit) } : { left: x(m.limit), right: 0 }} />
          {m.warn !== undefined && <div className="absolute inset-y-0 bg-amber-100" style={{ left: x(m.warn), width: `calc(${x(m.limit)} - ${x(m.warn)})` }} />}
          <motion.div
            className="absolute inset-y-0.5 left-0 rounded-full"
            style={{ background: STATUS_HEX[c.status] }}
            initial={play ? { width: x(m.before ?? 0) } : false}
            animate={{ width: x(m.value) }}
            transition={{ delay: delay + 0.1, duration: 0.6, ease: 'easeOut' }}
          />
          {m.before !== undefined && <div title={`before: ${fmtUnit(m.before, m.unit)}`} className="absolute -top-0.5 h-3.5 w-0.5 rounded bg-slate-400" style={{ left: x(m.before) }} />}
          <div title={`limit: ${fmtUnit(m.limit, m.unit)}`} className="absolute -top-1 h-4.5 w-0.5 bg-slate-800" style={{ left: x(m.limit) }} />
        </div>
      )}
    </motion.li>
  )
}

export function ChecksList({ checks, play }: { checks: Check[]; play: boolean }) {
  return (
    <ul className="divide-y divide-slate-100">
      {checks.map((c, k) => (
        <CheckRow key={c.id} c={c} k={k} play={play} />
      ))}
    </ul>
  )
}

export function DecisionBanner({ decision, reason, delay = 0 }: { decision: Decision; reason: string; delay?: number }) {
  const d = DECISION[decision]
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay, duration: 0.3 }} className={`flex items-center gap-3 rounded-xl border p-3 ${d.soft} ${d.border}`}>
      <DecisionPill d={decision} size="lg" />
      <span className={`text-sm font-medium ${d.text}`}>{reason}</span>
    </motion.div>
  )
}

/** Stacked allocation bar that animates between portfolios. */
export function AllocBar({ p, u, label }: { p: Portfolio; u: Universe; label: string }) {
  const tot = total(p) || 1
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums">{usd(total(p))}</span>
      </div>
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
        {u.assets.map((a) => (
          <motion.div key={a.id} title={`${a.ticker} ${usd(p[a.id] ?? 0)} (${pct(((p[a.id] ?? 0) / tot) * 100)})`} animate={{ width: `${((p[a.id] ?? 0) / tot) * 100}%` }} transition={{ duration: 0.6 }} style={{ background: a.color }} />
        ))}
      </div>
    </div>
  )
}

export function AssetLegend({ u, ports }: { u: Universe; ports: Portfolio[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
      {u.assets
        .filter((a) => ports.some((p) => p[a.id]))
        .map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ background: a.color }} />
            {a.ticker}
          </span>
        ))}
    </div>
  )
}

export function TradeTable({ trades, u }: { trades: { asset: string; amount: number }[]; u: Universe }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      {trades.map((t) => {
        const a = assetOf(u, t.asset)
        return (
          <div key={t.asset} className="flex items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-sm last:border-0">
            <span className={`w-11 rounded px-1.5 py-0.5 text-center text-[10px] font-bold ${t.amount > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{t.amount > 0 ? 'BUY' : 'SELL'}</span>
            <span className="w-12 font-mono font-semibold">{a?.ticker ?? t.asset}</span>
            <span className="min-w-0 flex-1 truncate text-slate-500">{a?.name}</span>
            <span className="font-semibold tabular-nums">{usd(Math.abs(t.amount))}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Animated Financial Twin: sample market paths draw in, then the 10–90% band and median,
 * then the goal-likelihood counters. Both portfolios use the same simulated markets.
 */
export function TwinViz({ before, after, investor, color = '#4f46e5', play = true }: { before: TwinResult; after?: TwinResult; investor: Investor; color?: string; play?: boolean }) {
  const [replay, setReplay] = useState(0)
  const [showB, setShowB] = useState(true)
  const [showA, setShowA] = useState(true)
  const clip = useId()
  const W = 600
  const H = 250
  const P = { l: 52, r: 12, t: 12, b: 24 }
  const ages = before.ages
  const yMax = Math.max(investor.target * 1.25, ...before.p90, ...(after?.p90 ?? [])) || 1
  const sx = (k: number) => P.l + (k / Math.max(1, ages.length - 1)) * (W - P.l - P.r)
  const sy = (v: number) => H - P.b - (Math.max(0, v) / yMax) * (H - P.t - P.b)
  const line = (vals: number[]) => vals.map((v, k) => `${k ? 'L' : 'M'}${sx(k).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')
  const band = (lo: number[], hi: number[]) => `${line(hi)} ${lo.map((_, k) => `L${sx(lo.length - 1 - k).toFixed(1)},${sy(lo[lo.length - 1 - k]).toFixed(1)}`).join(' ')} Z`
  const ticks = useMemo(() => [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax), [yMax])
  const runs = [showB && { t: before, c: '#64748b', key: 'b' }, showA && after && { t: after, c: color, key: 'a' }].filter(Boolean) as { t: TwinResult; c: string; key: string }[]
  const pathDur = play ? 0.9 : 0
  const bandDelay = play ? 1.3 : 0

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end gap-4">
        <div>
          <div className="text-[11px] text-slate-500">Goal likelihood {after ? 'before → after' : ''}</div>
          <div className="text-2xl font-extrabold tabular-nums text-slate-900">
            <CountUp key={`b${replay}`} value={before.successPct} format={(n) => `${n.toFixed(0)}%`} />
            {after && (
              <>
                <span className="mx-1.5 text-slate-300">→</span>
                <span style={{ color }}>
                  <CountUp key={`a${replay}`} value={after.successPct} format={(n) => `${n.toFixed(0)}%`} duration={1.6} />
                </span>
              </>
            )}
          </div>
        </div>
        <div className="text-[11px] leading-tight text-slate-500">
          share of {before.paths.toLocaleString()} simulated markets (seed {before.seed})
          <br />
          ending ≥ {usdShort(investor.target)} at age {investor.retireAge}
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          <label className="flex items-center gap-1 text-slate-500">
            <input type="checkbox" checked={showB} onChange={(e) => setShowB(e.target.checked)} /> before
          </label>
          {after && (
            <label className="flex items-center gap-1 text-slate-500">
              <input type="checkbox" checked={showA} onChange={(e) => setShowA(e.target.checked)} /> after
            </label>
          )}
          <button onClick={() => setReplay((r) => r + 1)} title="Replay animation" className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50">
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      <svg key={replay} viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <clipPath id={clip}>
            <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} />
          </clipPath>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={sy(v)} y2={sy(v)} stroke="#f1f5f9" />
            <text x={P.l - 6} y={sy(v) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
              {usdShort(v)}
            </text>
          </g>
        ))}
        {ages.map((a, k) =>
          k % Math.max(1, Math.round(ages.length / 6)) === 0 || k === ages.length - 1 ? (
            <text key={a} x={sx(k)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {a}
            </text>
          ) : null,
        )}
        <g clipPath={`url(#${clip})`}>
          {runs.map(({ t, c, key }) =>
            t.samples.map((s, k) => (
              <motion.path
                key={`${key}${k}`}
                d={line(s)}
                fill="none"
                stroke={c}
                strokeWidth={1}
                strokeOpacity={t.sampleHits[k] ? 0.35 : 0.18}
                initial={play ? { pathLength: 0 } : false}
                animate={{ pathLength: 1 }}
                transition={{ duration: pathDur, delay: play ? (k / Math.max(1, t.samples.length)) * 0.5 + (key === 'a' ? 0.3 : 0) : 0 }}
              />
            )),
          )}
          {runs.map(({ t, c, key }) => (
            <motion.g key={`band${key}`} initial={play ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: bandDelay, duration: 0.5 }}>
              <path d={band(t.p10, t.p90)} fill={c} fillOpacity={0.12} />
              <path d={line(t.p50)} fill="none" stroke={c} strokeWidth={2.5} />
              <path d={line(t.p10)} fill="none" stroke={c} strokeWidth={1} strokeDasharray="3 3" />
            </motion.g>
          ))}
        </g>
        <line x1={P.l} x2={W - P.r} y1={sy(investor.target)} y2={sy(investor.target)} stroke="#0f172a" strokeDasharray="5 4" />
        <text x={W - P.r - 4} y={sy(investor.target) - 4} textAnchor="end" fontSize="10" fontWeight="700" fill="#0f172a">
          goal {usdShort(investor.target)}
        </text>
      </svg>

      <FinalHistogram key={`h${replay}`} runs={runs} target={investor.target} play={play} />
      <p className="mt-1 text-[11px] text-slate-400">Thin lines: individual simulated paths (brighter = reached the goal). Band: 10th–90th percentile. Thick line: median. Dashed: bad case (10th percentile).</p>
    </div>
  )
}

function FinalHistogram({ runs, target, play }: { runs: { t: TwinResult; c: string; key: string }[]; target: number; play: boolean }) {
  if (!runs.length) return null
  const W = 600
  const H = 70
  const lo = Math.min(...runs.map((r) => r.t.hist.edges[0]))
  const hi = Math.max(...runs.map((r) => r.t.hist.edges[r.t.hist.edges.length - 1]))
  const sx = (v: number) => ((v - lo) / (hi - lo || 1)) * W
  const cMax = Math.max(...runs.flatMap((r) => r.t.hist.counts), 1)
  return (
    <div className="mt-2">
      <div className="text-[11px] text-slate-500">Distribution of the final value</div>
      <svg viewBox={`0 0 ${W} ${H + 12}`} className="w-full">
        {runs.map(({ t, c, key }) =>
          t.hist.counts.map((n, k) => {
            const x0 = sx(t.hist.edges[k])
            const x1 = sx(t.hist.edges[k + 1])
            const h = (n / cMax) * H
            return (
              <motion.rect
                key={`${key}${k}`}
                x={x0}
                width={Math.max(0.5, x1 - x0 - 1)}
                fill={c}
                fillOpacity={0.45}
                initial={play ? { y: H, height: 0 } : false}
                animate={{ y: H - h, height: h }}
                transition={{ delay: play ? 1.2 + k * 0.02 : 0, duration: 0.4 }}
              />
            )
          }),
        )}
        {target >= lo && target <= hi && <line x1={sx(target)} x2={sx(target)} y1={0} y2={H} stroke="#0f172a" strokeDasharray="4 3" />}
        <text x={0} y={H + 11} fontSize="10" fill="#94a3b8">
          {usdShort(lo)}
        </text>
        <text x={W} y={H + 11} fontSize="10" fill="#94a3b8" textAnchor="end">
          {usdShort(hi)}
        </text>
      </svg>
    </div>
  )
}

/** Everything Clario computed for one proposal: decision, checks, twin, allocation. */
export function VerificationView({ v, u, investor, play }: { v: Verification; u: Universe; investor: Investor; play: boolean }) {
  const color = DECISION[v.decision].hex
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <ChecksList checks={v.checks} play={play} />
        <DecisionBanner decision={v.decision} reason={v.reason} delay={play ? 0.2 + v.checks.length * 0.18 : 0} />
      </div>
      <div className="space-y-4">
        <TwinViz before={v.twinBefore} after={v.twinAfter} investor={investor} color={color} play={play} />
        <div className="space-y-2">
          <AllocBar p={v.before} u={u} label="Today" />
          <AllocBar p={v.after} u={u} label="If approved" />
          <AssetLegend u={u} ports={[v.before, v.after]} />
        </div>
      </div>
    </div>
  )
}
