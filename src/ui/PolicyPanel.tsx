import { Lock, RotateCcw } from 'lucide-react'
import { ASSETS, ASSET_ORDER, total, usd, usdShort, type Investor, type Policy } from '../engine/model'
import { Card, SectionTitle } from './theme'

type NumKey = { [K in keyof Policy]: Policy[K] extends number ? K : never }[keyof Policy]

const FIELDS: { key: NumKey; label: string; unit: '%' | '$' | 'pts' | 'x'; step: number; min: number; max: number }[] = [
  { key: 'maxSingleStockPct', label: 'Max single stock', unit: '%', step: 1, min: 1, max: 100 },
  { key: 'maxSectorPct', label: 'Max sector (tech)', unit: '%', step: 1, min: 5, max: 100 },
  { key: 'minCash', label: 'Min cash buffer', unit: '$', step: 5000, min: 0, max: 100000 },
  { key: 'maxEquityPct', label: 'Max equity (moderate)', unit: '%', step: 5, min: 20, max: 100 },
  { key: 'maxVolPct', label: 'Max volatility', unit: '%', step: 0.5, min: 5, max: 40 },
  { key: 'materialGoalDropPts', label: 'Material goal drop', unit: 'pts', step: 1, min: 1, max: 50 },
  { key: 'maxAttempts', label: 'Max agent attempts', unit: 'x', step: 1, min: 1, max: 5 },
]

export function PolicyPanel({ investor, policy, onChange, onReset }: { investor: Investor; policy: Policy; onChange: (p: Policy) => void; onReset: () => void }) {
  const tot = total(investor.portfolio)
  return (
    <div className="scroll-thin flex h-full flex-col gap-4 overflow-y-auto">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-slate-600 to-slate-900 text-lg font-bold text-white">M</div>
          <div>
            <div className="font-bold">
              {investor.name}, {investor.age}
            </div>
            <div className="text-xs text-slate-500">Fictional demo investor</div>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <Item k="Portfolio" v={usd(tot)} />
          <Item k="Goal" v={`${usdShort(investor.target)} by ${investor.retireAge}`} />
          <Item k="Risk profile" v={investor.riskProfile} />
          <Item k="Saves" v={`${usd(investor.monthlyContribution)}/mo`} />
        </dl>
        <div className="mt-3 space-y-1">
          {ASSET_ORDER.filter((id) => investor.portfolio[id]).map((id) => {
            const val = investor.portfolio[id] ?? 0
            return (
              <div key={id} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: ASSETS[id].color }} />
                <span className="min-w-0 flex-1 truncate text-slate-600">{ASSETS[id].name}</span>
                <span className="font-semibold tabular-nums">{usdShort(val)}</span>
                <span className="w-9 text-right text-slate-400 tabular-nums">{Math.round((val / tot) * 100)}%</span>
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle
          right={
            <button onClick={onReset} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900">
              <RotateCcw size={11} /> Reset
            </button>
          }
        >
          Hard constraints
        </SectionTitle>
        <div className="mb-3 flex gap-2 rounded-lg bg-teal-50 p-2 text-[11px] leading-snug text-teal-800">
          <Lock size={13} className="mt-px shrink-0" />
          <span>Owned by the investor and kept outside the agent. The agent can read them but not change them. Edit one and watch the decision recompute.</span>
        </div>
        <div className="space-y-1.5">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-600">{f.label}</span>
              <span className="flex items-center gap-1">
                {f.unit === '$' && <span className="text-xs text-slate-400">$</span>}
                <input
                  type="number"
                  value={policy[f.key]}
                  step={f.step}
                  min={f.min}
                  max={f.max}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) onChange({ ...policy, [f.key]: Math.min(f.max, Math.max(f.min, n)) })
                  }}
                  className={`${f.unit === '$' ? 'w-20' : 'w-14'} rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-right font-semibold tabular-nums focus:border-indigo-400 focus:outline-none`}
                />
                <span className="w-6 text-xs text-slate-400">{f.unit === '$' ? '' : f.unit}</span>
              </span>
            </label>
          ))}
        </div>
      </Card>
    </div>
  )
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-slate-400">{k}</dt>
      <dd className="font-semibold text-slate-800">{v}</dd>
    </div>
  )
}
