import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Ban, Bot, CircleCheck, CircleHelp, CircleMinus, CircleX, FileSearch, Newspaper, OctagonAlert, ShieldCheck, ThumbsDown, ThumbsUp, TriangleAlert, Undo2, Users } from 'lucide-react'
import type { AdviceResult, Assessment, IntentEdit, IntentVerdict } from '../engine/advisory'
import type { Profile, Workspace } from '../engine/config'
import type { Check } from '../engine/guard'
import { cashId, pct, portfolioStats, techExposure, total, usd, usdShort } from '../engine/model'
import { LlmCallCard } from '../playground/RunViewer'
import { ReadingCard } from './ReadingCard'
import { CountUp } from '../playground/fields'
import { AllocBar, AssetLegend, ChecksList, TradeTable, TwinViz } from '../playground/viz'

const VERDICT: Record<IntentVerdict, { title: string; sub: string; cls: string; icon: ReactNode; color: string }> = {
  VERIFIED: { title: 'VERIFIED BY CLARIO', sub: 'This answer fits your profile.', cls: 'border-emerald-300 bg-emerald-50 text-emerald-900', icon: <ShieldCheck size={30} />, color: '#059669' },
  CAUTION: { title: 'USE WITH CAUTION', sub: 'Parts of this answer don’t fit your profile.', cls: 'border-amber-300 bg-amber-50 text-amber-900', icon: <TriangleAlert size={30} />, color: '#d97706' },
  BLOCKED: { title: 'BLOCKED BY CLARIO: DO NOT FOLLOW THIS AI RESPONSE', sub: 'This answer goes against your profile and limits.', cls: 'border-rose-600 bg-rose-600 text-white', icon: <OctagonAlert size={34} />, color: '#e11d48' },
  UNVERIFIABLE: { title: 'CANNOT VERIFY THIS ANSWER', sub: '', cls: 'border-violet-300 bg-violet-50 text-violet-900', icon: <CircleHelp size={30} />, color: '#7c3aed' },
  NO_ACTION: { title: 'NO ACTION RECOMMENDED', sub: '', cls: 'border-sky-300 bg-sky-50 text-sky-900', icon: <CircleMinus size={30} />, color: '#0284c7' },
}


interface Props {
  result: AdviceResult
  a: Assessment
  profile: Profile
  ws: Workspace
  driftNote?: { onUndo?: () => void }
  /** The investor's corrections to Clario's reading of the request. */
  edit: IntentEdit
  onEdit: (e: IntentEdit) => void
}

export function IntentReport({ result, a, profile, ws, driftNote, edit, onEdit }: Props) {
  const v = VERDICT[a.verdict]
  const blocked = a.verdict === 'BLOCKED'
  const inv = profile.investor
  const answerCard = (
          <section className={`relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-5 ${blocked ? 'border-rose-300' : 'border-slate-200'}`}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-100 text-indigo-700">
                <Bot size={17} />
              </span>
              AI Advisor’s answer
              <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {result.model} · {result.style} persona
              </span>
            </div>
            <p className={`whitespace-pre-wrap text-[15px] leading-relaxed ${blocked ? 'text-slate-400' : 'text-slate-800'}`}>{result.advisor.answer}</p>
            {blocked && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="-rotate-12 rounded-xl border-4 border-rose-600 bg-white/80 px-4 py-1.5 text-lg font-black tracking-widest text-rose-600 sm:px-5 sm:py-2 sm:text-2xl">DO NOT FOLLOW</span>
              </div>
            )}
            {result.advisor.trades.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">What the AI is recommending</div>
                <TradeTable trades={result.advisor.trades} u={ws.universe} />
              </div>
            )}
            {a.unverifiableRecs.length > 0 && (
              <div className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">
                Also mentions assets Clario can’t verify: <b>{a.unverifiableRecs.join(', ')}</b>
              </div>
            )}
          </section>
  )
  const readingCard = <ReadingCard reading={a.reading} edit={edit} onEdit={onEdit} ws={ws} question={result.question} />

  // The rules couldn't read the request: no verdict until the investor confirms what they meant.
  if (a.reading.needsConfirm && !a.reading.confirmed) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 sm:px-5 sm:py-4">
          <CircleHelp size={28} className="shrink-0" />
          <div>
            <div className="text-lg font-black tracking-wide">VERDICT ON HOLD</div>
            <div className="text-sm">Clario won’t guess what you meant. Confirm how it should read your request, and it will check the answer.</div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {readingCard}
          {answerCard}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {driftNote && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          <CircleCheck size={16} /> Risk review complete: your profile is now <b>{inv.riskProfile}</b>. This answer has been re-checked against it.
          {driftNote.onUndo && (
            <button onClick={driftNote.onUndo} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2 py-0.5 text-xs font-semibold">
              <Undo2 size={12} /> Undo
            </button>
          )}
        </div>
      )}

      {/* Verdict */}
      <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 px-4 py-3 sm:flex-nowrap sm:gap-4 sm:px-5 sm:py-4 ${v.cls}`}>
        {v.icon}
        <div className="min-w-0 flex-1">
          <div className={`font-black tracking-wide ${blocked ? 'text-base sm:text-xl' : 'text-base sm:text-lg'}`}>{v.title}</div>
          <div className={`text-sm ${blocked ? 'text-rose-50' : ''}`}>
            {v.sub ? `${v.sub} ` : ''}
            {a.verdictReason}
          </div>
        </div>
        <div className="flex shrink-0 items-baseline gap-2 sm:block sm:text-right">
          <div className="text-2xl font-black tabular-nums sm:text-3xl">
            {a.counts.pass}/{a.counts.active}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">checks passed</div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* The AI answer */}
        <div className="space-y-5">
          {answerCard}

          {readingCard}

          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <Title icon={<FileSearch size={15} />}>What Clario read in the answer ⚙</Title>
            {a.scan.stances.length || a.scan.unknownBuys.length ? (
              <ul className="space-y-1.5 text-sm">
                {[...new Map(a.scan.stances.map((s) => [s.ticker + s.stance, s])).values()].map((s) => (
                  <li key={s.ticker + s.stance} className="flex gap-2">
                    <span className={`mt-0.5 h-fit w-14 shrink-0 self-start rounded px-1 text-center text-[10px] font-bold ${s.stance === 'buy' ? 'bg-indigo-100 text-indigo-800' : s.stance === 'sell' ? 'bg-slate-200 text-slate-700' : s.stance === 'avoid' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-500'}`}>{s.stance.toUpperCase()}</span>
                    <span>
                      <b>{s.ticker}</b> <span className="text-xs text-slate-500">“{s.clause}”</span>
                    </span>
                  </li>
                ))}
                {a.scan.unknownBuys.map((x) => (
                  <li key={x.name} className="flex gap-2">
                    <span className="mt-0.5 h-fit w-14 shrink-0 self-start rounded bg-violet-100 px-1 text-center text-[10px] font-bold text-violet-800">BUY ?</span>
                    <span>
                      <b>{x.name}</b> <span className="text-xs text-slate-500">“{x.clause}” (not a verifiable asset)</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">The answer doesn’t name any asset to buy, sell or avoid.</p>
            )}
            <p className="mt-2 text-[11px] text-slate-400">Read by rules from the advisor’s text, not from the advisor’s own labels. Used for the “text matches trades”, “answers the question”, “asset coverage” and “context trust” checks.</p>
          </section>
        </div>

        {/* Flags */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <Title icon={<ShieldCheck size={15} />} right={<CountsBar a={a} />}>
            Clario checks
          </Title>
          <div className="flex flex-wrap gap-1.5">
            {a.checks.map((c, k) => (
              <Flag key={c.id} c={c} k={k} />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            ⚙ decided by rules (code only): <b>{a.counts.rule}</b>{a.counts.you > 0 && <> · ✎ use a reading you set: <b>{a.counts.you}</b></>}. Clario uses no AI: not to read your request, not to judge the answer.
          </p>
          <ul className="mt-4 space-y-1.5">
            {a.checks
              .filter((c) => c.status === 'fail' || c.status === 'warn')
              .map((c) => (
                <li key={c.id} className="text-sm">
                  <b className={c.status === 'fail' ? 'text-rose-700' : 'text-amber-700'}>{c.label}:</b> <span className="text-slate-700">{c.detail}</span>{' '}
                  <span className="text-xs text-slate-400">
                    ({c.observed} · limit {c.limit})
                  </span>
                </li>
              ))}
          </ul>
          <AllChecks checks={a.checks} />
        </section>
      </div>

      {/* Simulation */}
      {a.verification && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <Title icon={<span className="text-xs">📈</span>} right={<DeltaBadge d={a.verification.deltaPts} />}>
            Modeled goal likelihood · Financial Twin
          </Title>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <TwinViz before={a.verification.twinBefore} after={a.verification.twinAfter} investor={inv} color={v.color} />
            <div className="space-y-4">
              <Stats a={a} profile={profile} ws={ws} />
              <div className="space-y-2">
                <AllocBar p={a.verification.before} u={ws.universe} label="Today" />
                <AllocBar p={a.verification.after} u={ws.universe} label="If you follow the AI" />
                <AssetLegend u={ws.universe} ports={[a.verification.before, a.verification.after]} />
              </div>
            </div>
          </div>
        </section>
      )}

      {a.hypothetical && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <Title icon={<span className="text-xs">🔍</span>} right={<DeltaBadge d={a.hypothetical.deltaPts} />}>
            If you did what you asked instead · Financial Twin
          </Title>
          <p className="mb-3 text-sm text-slate-600">
            The AI {result.advisor.verdict === 'dont' ? 'advised against your request' : 'did not recommend a trade'}. To show whether that holds up, Clario simulated your request as you stated it:
          </p>
          <div className="mb-4">
            <TradeTable trades={a.hypotheticalTrades} u={ws.universe} />
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {a.hypothetical.checks
              .filter((c) => c.status !== 'pass' && c.status !== 'off')
              .map((c, k) => (
                <Flag key={c.id} c={c} k={k} />
              ))}
            {!a.hypothetical.checks.some((c) => c.status === 'fail' || c.status === 'warn') && <span className="text-sm text-emerald-700">Your request would pass every check.</span>}
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <TwinViz before={a.hypothetical.twinBefore} after={a.hypothetical.twinAfter} investor={inv} color={a.hypothetical.deltaPts < -2 ? '#e11d48' : '#059669'} />
            <div className="space-y-2">
              <AllocBar p={a.hypothetical.before} u={ws.universe} label="Today" />
              <AllocBar p={a.hypothetical.after} u={ws.universe} label="If you did what you asked" />
              <AssetLegend u={ws.universe} ports={[a.hypothetical.before, a.hypothetical.after]} />
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {a.cohort && <Cohort a={a} profile={profile} />}
        <Evidence a={a} wide={!a.cohort} />
      </div>

      {(a.citedHeadlines.length > 0 || a.rumorTickers.length > 0) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <Title icon={<Newspaper size={15} />}>Market information the AI relied on</Title>
          <ul className="space-y-2">
            {a.citedHeadlines.map((h) => (
              <li key={h.id} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 shrink-0 rounded px-1.5 text-[10px] font-bold ${h.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{h.verified ? 'VERIFIED' : 'UNVERIFIED'}</span>
                <span>
                  {h.title} <span className="text-xs text-slate-400">· {h.source}</span>
                </span>
              </li>
            ))}
          </ul>
          {a.rumorTickers.length > 0 && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">The AI recommends buying {a.rumorTickers.join(', ')}, which is the subject of an unverified rumour in today’s feed.</p>}
        </section>
      )}

      <details className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">Technical details: the exact prompts and raw model output ({result.calls.length} calls, {(result.ms / 1000).toFixed(1)}s)</summary>
        <div className="mt-3 space-y-3">
          {result.calls.map((c, k) => (
            <LlmCallCard key={k} call={c} />
          ))}
        </div>
      </details>
    </div>
  )
}

function Title({ icon, children, right }: { icon: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">{children}</h3>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  )
}

const FLAG = {
  pass: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: <CircleCheck size={13} /> },
  warn: { cls: 'border-amber-200 bg-amber-50 text-amber-800', icon: <TriangleAlert size={13} /> },
  fail: { cls: 'border-rose-200 bg-rose-50 text-rose-700', icon: <CircleX size={13} /> },
  off: { cls: 'border-slate-200 bg-slate-50 text-slate-400', icon: <CircleMinus size={13} /> },
}

function Flag({ c, k }: { c: Check; k: number }) {
  const f = FLAG[c.status]
  return (
    <motion.span
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: k * 0.05 }}
      title={`${c.observed} · limit ${c.limit}\n${c.basis === 'you' ? 'Uses the reading of your request that you set' : 'Rule-based: decided by code, no AI'}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${f.cls}`}
    >
      {f.icon} {c.label.replace(/ \(.*\)$/, '')}
      <span className="ml-0.5 text-[10px] opacity-60">{c.basis === 'you' ? '✎' : '⚙'}</span>
    </motion.span>
  )
}

function CountsBar({ a }: { a: Assessment }) {
  const { pass, warn, fail, active } = a.counts
  const w = (n: number) => `${(n / (active || 1)) * 100}%`
  return (
    <span className="flex items-center gap-2 text-[11px] text-slate-500">
      <span className="flex h-2 w-32 overflow-hidden rounded-full bg-slate-100">
        <motion.span initial={{ width: 0 }} animate={{ width: w(pass) }} className="bg-emerald-500" />
        <motion.span initial={{ width: 0 }} animate={{ width: w(warn) }} className="bg-amber-400" />
        <motion.span initial={{ width: 0 }} animate={{ width: w(fail) }} className="bg-rose-500" />
      </span>
      {pass} pass · {warn} warn · {fail} fail
    </span>
  )
}

function AllChecks({ checks }: { checks: Check[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <button onClick={() => setOpen(!open)} className="text-xs font-semibold text-indigo-700 hover:underline">
        {open ? 'Hide' : 'Show'} every check with its numbers
      </button>
      {open && (
        <div className="mt-2">
          <ChecksList checks={checks} play />
        </div>
      )}
    </div>
  )
}

function DeltaBadge({ d }: { d: number }) {
  return <span className={`rounded-full px-2.5 py-1 text-sm font-bold text-white ${d <= -2 ? 'bg-rose-600' : d < 0 ? 'bg-amber-500' : 'bg-emerald-600'}`}>{`${d >= 0 ? '+' : ''}${d.toFixed(1)} pts`}</span>
}

function Stats({ a, profile, ws }: { a: Assessment; profile: Profile; ws: Workspace }) {
  const v = a.verification!
  const u = ws.universe
  const inv = profile.investor
  const sb = portfolioStats(v.before, u)
  const sa = portfolioStats(v.after, u)
  const cid = cashId(u)
  const rows: [string, string, string, boolean | null][] = [
    [`Median value at ${inv.retireAge}`, usdShort(v.twinBefore.p50.at(-1) ?? 0), usdShort(v.twinAfter.p50.at(-1) ?? 0), (v.twinAfter.p50.at(-1) ?? 0) >= (v.twinBefore.p50.at(-1) ?? 0)],
    ['Bad case (1 in 10)', usdShort(v.twinBefore.p10.at(-1) ?? 0), usdShort(v.twinAfter.p10.at(-1) ?? 0), (v.twinAfter.p10.at(-1) ?? 0) >= (v.twinBefore.p10.at(-1) ?? 0) * 0.98],
    ['Expected return / yr', pct(sb.mu * 100), pct(sa.mu * 100), null],
    ['Volatility / yr', pct(sb.sigma * 100), pct(sa.sigma * 100), sa.sigma <= profile.policy.maxVolPct / 100],
    ['Technology exposure', pct((techExposure(v.before, u) / (total(v.before) || 1)) * 100), pct((techExposure(v.after, u) / (total(v.after) || 1)) * 100), (techExposure(v.after, u) / (total(v.after) || 1)) * 100 <= profile.policy.maxSectorPct],
    ['Cash', usd(cid ? (v.before[cid] ?? 0) : 0), usd(cid ? (v.after[cid] ?? 0) : 0), (cid ? (v.after[cid] ?? 0) : 0) >= profile.policy.minCash],
  ]
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-4xl font-black tabular-nums text-slate-900">
          <CountUp value={v.twinBefore.successPct} format={(n) => `${n.toFixed(0)}%`} />
        </span>
        <span className="text-slate-300">→</span>
        <span className={`text-4xl font-black tabular-nums ${v.deltaPts < -2 ? 'text-rose-600' : 'text-emerald-600'}`}>
          <CountUp value={v.twinAfter.successPct} format={(n) => `${n.toFixed(0)}%`} duration={1.4} />
        </span>
        <span className="text-xs text-slate-500">chance of reaching {usdShort(inv.target)} by {inv.retireAge}</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, b, af, ok]) => (
            <tr key={k} className="border-t border-slate-100">
              <td className="py-1 text-slate-500">{k}</td>
              <td className="py-1 text-right tabular-nums text-slate-500">{b}</td>
              <td className="px-1 text-slate-300">→</td>
              <td className={`py-1 text-right font-semibold tabular-nums ${ok === null ? 'text-slate-800' : ok ? 'text-emerald-700' : 'text-rose-600'}`}>{af}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Cohort({ a, profile }: { a: Assessment; profile: Profile }) {
  const c = a.cohort!
  const lo = Math.min(...c.deltas, -1)
  const hi = Math.max(...c.deltas, 1)
  const bins = 24
  const counts = new Array(bins).fill(0)
  for (const d of c.deltas) counts[Math.min(bins - 1, Math.floor(((d - lo) / (hi - lo)) * bins))]++
  const max = Math.max(...counts, 1)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <Title icon={<Users size={15} />}>Similar investors · synthetic cohort</Title>
      <p className="mb-3 text-sm text-slate-500">
        {profile.investor.riskProfile} investors of similar age and goal horizon · n={c.n}
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Big value={`${c.heldOrImprovedPct.toFixed(0)}%`} label="held or improved" cls="text-emerald-700" />
        <Big value={`${c.declinedPct.toFixed(0)}%`} label="saw it decline" cls="text-rose-600" />
        <Big value={`${c.medianDeltaPts >= 0 ? '+' : ''}${c.medianDeltaPts.toFixed(1)}`} label="median pt change" cls="text-slate-900" />
      </div>
      <div className="mt-4 flex h-16 items-end gap-0.5">
        {counts.map((n, k) => {
          const mid = lo + ((k + 0.5) / bins) * (hi - lo)
          return <motion.div key={k} initial={{ height: 0 }} animate={{ height: `${(n / max) * 100}%` }} transition={{ delay: k * 0.02 }} className={`flex-1 rounded-t ${mid < 0 ? 'bg-rose-300' : 'bg-emerald-300'}`} />
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{lo.toFixed(1)} pts</span>
        <span>change in goal likelihood</span>
        <span>+{hi.toFixed(1)} pts</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {c.declinedPct > 50 ? 'Most similar investors who made a comparable change saw their modeled goal likelihood decline.' : 'Most similar investors who made a comparable change held or improved their modeled goal likelihood.'} Illustrative only, not individual client data.
      </p>
    </section>
  )
}

function Big({ value, label, cls }: { value: string; label: string; cls: string }) {
  return (
    <div>
      <div className={`text-2xl font-black tabular-nums ${cls}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function Evidence({ a, wide }: { a: Assessment; wide?: boolean }) {
  const support = a.evidence.filter((e) => e.kind === 'support')
  const against = a.evidence.filter((e) => e.kind !== 'support')
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${wide ? 'xl:col-span-2' : ''}`}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <Title icon={<ThumbsUp size={15} />}>Supports the answer ({support.length})</Title>
          <ul className="space-y-1.5">
            {support.map((e, k) => (
              <li key={k} className="flex gap-2 text-sm text-slate-700">
                <CircleCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" /> {e.text}
              </li>
            ))}
            {!support.length && <li className="text-sm text-slate-400">Nothing.</li>}
          </ul>
        </div>
        <div>
          <Title icon={<ThumbsDown size={15} />}>Argues against it ({against.length})</Title>
          <ul className="space-y-1.5">
            {against.map((e, k) => (
              <li key={k} className="flex gap-2 text-sm text-slate-700">
                {e.kind === 'against' ? <Ban size={14} className="mt-0.5 shrink-0 text-rose-600" /> : <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-500" />} {e.text}
              </li>
            ))}
            {!against.length && <li className="text-sm text-slate-400">Nothing.</li>}
          </ul>
        </div>
      </div>
    </section>
  )
}
