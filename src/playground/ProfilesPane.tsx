import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Copy, Plus, Trash2, UserRound } from 'lucide-react'
import { DEFAULT_POLICY, equityValue, portfolioStats, techExposure, total, usdShort, pct, type CheckId, type CheckMode, type Policy } from '../engine/model'
import { newId, type Profile, type Workspace } from '../engine/config'
import { runTwin } from '../engine/twin'
import { AllocBar, AssetLegend } from './viz'
import { Btn, CountUp, NumField, Panel, Segmented, TextField, Toggle } from './fields'

type NumKey = { [K in keyof Policy]: Policy[K] extends number ? K : never }[keyof Policy]

const LIMITS: { key: NumKey; label: string; prefix?: string; suffix?: string; step: number; hint: string }[] = [
  { key: 'maxSingleStockPct', label: 'Max single stock', suffix: '%', step: 1, hint: 'Largest single-stock position as a share of the portfolio.' },
  { key: 'maxSectorPct', label: 'Max technology (look-through)', suffix: '%', step: 1, hint: 'Technology exposure including the tech share inside funds.' },
  { key: 'minCash', label: 'Min cash buffer', prefix: '$', step: 5000, hint: 'Cash must stay at or above this.' },
  { key: 'maxEquityPct', label: 'Max equity', suffix: '%', step: 5, hint: 'Share of the portfolio in equity assets.' },
  { key: 'maxVolPct', label: 'Max modeled volatility', suffix: '%', step: 0.5, hint: 'Annual volatility from the one-factor model.' },
  { key: 'materialGoalDropPts', label: 'Goal drop that fails', suffix: 'pts', step: 1, hint: 'Fail when goal likelihood drops by at least this many points.' },
  { key: 'goalWarnPts', label: 'Goal drop that warns', suffix: 'pts', step: 0.5, hint: 'Warn when it drops by more than this.' },
  { key: 'anomalyWarnPct', label: 'Trade size that warns', suffix: '%', step: 1, hint: 'Buys larger than this share of the portfolio warn.' },
  { key: 'anomalyBlockPct', label: 'Trade size that fails', suffix: '%', step: 1, hint: 'Buys larger than this share fail the anomaly check.' },
  { key: 'maxAttempts', label: 'Max agent attempts', suffix: '×', step: 1, hint: 'After this many verified attempts, escalate to a human.' },
  { key: 'blockFailSharePct', label: 'Portal: block when this share fails', suffix: '%', step: 5, hint: 'In AI Advisory, show BLOCKED BY CLARIO when at least this share of active checks fail.' },
]

const CHECKS: { id: CheckId; label: string }[] = [
  { id: 'intent', label: 'Intent alignment' },
  { id: 'position', label: 'Single-stock limit' },
  { id: 'sector', label: 'Sector concentration' },
  { id: 'cash', label: 'Cash buffer' },
  { id: 'risk', label: 'Risk profile' },
  { id: 'goal', label: 'Goal impact' },
  { id: 'anomaly', label: 'Anomaly (trade size)' },
  { id: 'context', label: 'Context trust' },
  { id: 'focus', label: 'Answers the question (portal)' },
  { id: 'coverage', label: 'Asset coverage (portal)' },
  { id: 'consistency', label: 'Text matches trades (portal)' },
  { id: 'advice', label: 'Advice classification (portal)' },
]

const MODE_OPTS: { value: CheckMode; label: string; tone: string }[] = [
  { value: 'block', label: 'Block', tone: 'text-rose-700' },
  { value: 'revise', label: 'Revise', tone: 'text-amber-700' },
  { value: 'off', label: 'Off', tone: 'text-slate-500' },
]

interface Props {
  ws: Workspace
  update: (fn: (w: Workspace) => Workspace) => void
  selectedId: string
  onSelect: (id: string) => void
}

export function ProfilesPane({ ws, update, selectedId, onSelect }: Props) {
  const profile = ws.profiles.find((p) => p.id === selectedId) ?? ws.profiles[0]
  const setProfile = (fn: (p: Profile) => Profile) => update((w) => ({ ...w, profiles: w.profiles.map((p) => (p.id === profile.id ? fn(p) : p)) }))
  const setInv = (patch: Partial<Profile['investor']>) => setProfile((p) => ({ ...p, investor: { ...p.investor, ...patch } }))
  const setPol = (patch: Partial<Policy>) => setProfile((p) => ({ ...p, policy: { ...p.policy, ...patch } }))

  const add = () => {
    const id = newId('profile')
    const cash = ws.universe.assets.find((a) => a.kind === 'cash')
    update((w) => ({
      ...w,
      profiles: [...w.profiles, { id, notes: '', history: [], policy: DEFAULT_POLICY, investor: { name: 'New investor', age: 40, retireAge: 65, target: 1_000_000, monthlyContribution: 1_000, riskProfile: 'Moderate', preference: '', portfolio: cash ? { [cash.id]: 100_000 } : {} } }],
    }))
    onSelect(id)
  }
  const duplicate = () => {
    const id = newId('profile')
    update((w) => ({ ...w, profiles: [...w.profiles, { ...structuredClone(profile), id, investor: { ...structuredClone(profile.investor), name: `${profile.investor.name} (copy)` } }] }))
    onSelect(id)
  }
  const remove = () => {
    if (ws.profiles.length < 2) return
    const rest = ws.profiles.filter((p) => p.id !== profile.id)
    update((w) => ({ ...w, profiles: w.profiles.filter((p) => p.id !== profile.id) }))
    onSelect(rest[0].id)
  }

  const inv = profile.investor
  const u = ws.universe
  const stats = useMemo(() => {
    const tot = total(inv.portfolio) || 1
    const s = portfolioStats(inv.portfolio, u)
    return {
      tot: total(inv.portfolio),
      tech: (techExposure(inv.portfolio, u) / tot) * 100,
      equity: (equityValue(inv.portfolio, u) / tot) * 100,
      vol: s.sigma * 100,
      ret: s.mu * 100,
      goal: runTwin(inv.portfolio, inv, u, ws.twin).successPct,
    }
  }, [inv, u, ws.twin])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Btn tone="primary" onClick={add}>
            <Plus size={13} /> New
          </Btn>
          <Btn onClick={duplicate}>
            <Copy size={13} /> Duplicate
          </Btn>
          <Btn tone="danger" onClick={remove} disabled={ws.profiles.length < 2}>
            <Trash2 size={13} /> Delete
          </Btn>
        </div>
        {ws.profiles.map((p) => (
          <motion.button
            layout
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left ${p.id === profile.id ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-600 to-slate-900 text-sm font-bold text-white">{p.investor.name.slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">
                {p.investor.name}, {p.investor.age}
              </span>
              <span className="block truncate text-[11px] text-slate-500">
                {p.investor.riskProfile} · {usdShort(total(p.investor.portfolio))} · goal {usdShort(p.investor.target)}
              </span>
            </span>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title={<span className="inline-flex items-center gap-1.5"><UserRound size={13} /> Investor</span>}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <TextField label="Name" value={inv.name} onChange={(name) => setInv({ name })} />
            <label className="block space-y-1 text-sm">
              <span className="text-slate-600">Risk profile label</span>
              <input list="risk-labels" value={inv.riskProfile} onChange={(e) => setInv({ riskProfile: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm" />
              <datalist id="risk-labels">
                <option value="Conservative" />
                <option value="Moderate" />
                <option value="Aggressive" />
              </datalist>
            </label>
          </div>
          <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
            <NumField label="Age" value={inv.age} onChange={(age) => setInv({ age })} width="w-16" />
            <NumField label="Retirement age" value={inv.retireAge} onChange={(retireAge) => setInv({ retireAge })} width="w-16" />
            <NumField label="Goal" prefix="$" value={inv.target} step={50000} onChange={(target) => setInv({ target })} width="w-28" />
            <NumField label="Saves per month" prefix="$" value={inv.monthlyContribution} step={250} onChange={(monthlyContribution) => setInv({ monthlyContribution })} width="w-24" />
          </div>
          <div className="mt-2 space-y-2">
            <TextField label="Stated preference" value={inv.preference} onChange={(preference) => setInv({ preference })} />
            <TextField label="Notes" value={profile.notes} rows={2} onChange={(notes) => setProfile((p) => ({ ...p, notes }))} />
          </div>
        </Panel>

        <Panel title="Holdings" right={<span className="text-xs font-semibold tabular-nums text-slate-700">{usdShort(stats.tot)}</span>}>
          <div className="space-y-0.5">
            {u.assets.map((a) => (
              <NumField
                key={a.id}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
                    <span className="font-mono text-xs font-semibold">{a.ticker}</span>
                    <span className="truncate text-xs text-slate-500">{a.name}</span>
                  </span>
                }
                prefix="$"
                step={5000}
                value={inv.portfolio[a.id] ?? 0}
                onChange={(v) => setInv({ portfolio: { ...inv.portfolio, [a.id]: Math.max(0, v) } })}
                width="w-28"
              />
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <AllocBar p={inv.portfolio} u={u} label="Allocation" />
            <AssetLegend u={u} ports={[inv.portfolio]} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Goal likelihood" value={<CountUp value={stats.goal} format={(n) => `${n.toFixed(0)}%`} />} />
            <Stat label="Technology" value={pct(stats.tech)} warn={stats.tech > profile.policy.maxSectorPct} />
            <Stat label="Equity" value={pct(stats.equity, 0)} warn={stats.equity > profile.policy.maxEquityPct} />
            <Stat label="Volatility" value={pct(stats.vol)} warn={stats.vol > profile.policy.maxVolPct} />
            <Stat label="Exp. return" value={pct(stats.ret)} />
            <Stat label="Cash" value={usdShort(inv.portfolio[u.assets.find((a) => a.kind === 'cash')?.id ?? ''] ?? 0)} warn={(inv.portfolio[u.assets.find((a) => a.kind === 'cash')?.id ?? ''] ?? 0) < profile.policy.minCash} />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Red means today’s portfolio already breaks a limit, so almost any proposal will fail that check.</p>
        </Panel>

        <Panel title="Hard limits (owned by the investor)">
          {LIMITS.map((f) => (
            <NumField key={f.key} label={f.label} hint={f.hint} prefix={f.prefix} suffix={f.suffix} step={f.step} value={profile.policy[f.key]} onChange={(v) => setPol({ [f.key]: v } as Partial<Policy>)} />
          ))}
          <div className="mt-2 border-t border-slate-100 pt-2">
            <Toggle
              label="Untrusted input + aligned proposal = warning only"
              hint="If off, any proposal made while untrusted content was in the agent's inputs fails the context check."
              value={profile.policy.untrustedAlignedWarns}
              onChange={(untrustedAlignedWarns) => setPol({ untrustedAlignedWarns })}
            />
          </div>
        </Panel>

        <Panel title="Decision rules: what a failed check does">
          <div className="space-y-1.5">
            {CHECKS.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-600">{c.label}</span>
                <Segmented size="xs" value={profile.policy.checkModes[c.id]} options={MODE_OPTS} onChange={(m) => setPol({ checkModes: { ...profile.policy.checkModes, [c.id]: m } })} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-snug text-slate-500">
            <b>Block</b>: any failure stops the proposal outright. <b>Revise</b>: failures go back to the agent as feedback, until the attempt limit, then a human reviews. <b>Off</b>: the check is skipped.
          </p>
        </Panel>
      </div>
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${warn ? 'border-rose-200 bg-rose-50' : 'border-slate-200'}`}>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${warn ? 'text-rose-700' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}
