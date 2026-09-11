import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Flow } from '../engine/scenarios'
import { ASSETS, ASSET_ORDER, MARKET_VOL, pct, usd, usdShort, type Investor } from '../engine/model'
import { runTwin, TWIN_SETTINGS } from '../engine/twin'
import { Card, DECISION, SectionTitle } from './theme'

const last = (a: number[]) => a[a.length - 1]
const money = (n: number) => `$${(n / 1e6).toFixed(2)}M`

export function TwinPanel({ flow, index, investor }: { flow: Flow; index: number; investor: Investor }) {
  let vIdx = -1
  flow.steps.slice(0, index + 1).forEach((s) => {
    if (s.kind === 'verify') vIdx = s.i
  })
  const v = vIdx >= 0 ? flow.verifications[vIdx] : null
  const base = v ? v.twinBefore : runTwin(investor.portfolio, investor)
  const prop = v ? v.twinAfter : null
  const color = v ? DECISION[v.decision].hex : '#4f46e5'

  const data = base.ages.map((age, k) => ({
    age,
    base: [base.p10[k], base.p90[k]],
    base50: base.p50[k],
    prop: prop ? [prop.p10[k], prop.p90[k]] : undefined,
    prop50: prop ? prop.p50[k] : undefined,
  }))

  return (
    <Card className="scroll-thin flex h-full flex-col overflow-y-auto p-4">
      <SectionTitle right={<span className="text-[10px] font-semibold text-slate-400">{TWIN_SETTINGS.paths.toLocaleString()} seeded scenarios</span>}>Financial Twin</SectionTitle>

      <div className="grid grid-cols-2 gap-2">
        <Big label="Current plan" value={pct(base.successPct, 0)} color="#334155" />
        <Big
          label={v ? `With proposal v${v.proposal.attempt}` : 'With proposal'}
          value={prop ? pct(prop.successPct, 0) : '—'}
          color={color}
          delta={v ? `${v.deltaPts >= 0 ? '+' : ''}${v.deltaPts.toFixed(1)} pts` : 'waiting for a proposal'}
        />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
        Modeled likelihood of reaching <b>{usd(investor.target)}</b> by age {investor.retireAge}. A scenario-based estimate, not a prediction.
      </p>

      <div className="mt-3 h-52 min-h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="age" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} interval={4} />
            <YAxis tickFormatter={(n: number) => `$${(n / 1e6).toFixed(1)}M`} tick={{ fontSize: 11, fill: '#64748b' }} width={46} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(value) => (Array.isArray(value) ? `${money(Number(value[0]))} – ${money(Number(value[1]))}` : money(Number(value)))}
              labelFormatter={(l) => `Age ${l}`}
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
            />
            <Area dataKey="base" name="Current · 10th–90th pct" stroke="none" fill="#94a3b8" fillOpacity={0.28} isAnimationActive={false} />
            <Line dataKey="base50" name="Current · median" stroke="#475569" strokeWidth={2} dot={false} isAnimationActive={false} />
            {prop && <Area dataKey="prop" name="Proposal · 10th–90th pct" stroke="none" fill={color} fillOpacity={0.2} />}
            {prop && <Line dataKey="prop50" name="Proposal · median" stroke={color} strokeWidth={2.5} dot={false} />}
            <ReferenceLine y={investor.target} stroke="#0f172a" strokeDasharray="4 4" label={{ value: `Goal ${usdShort(investor.target)}`, position: 'insideTopLeft', fontSize: 11, fill: '#0f172a' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-slate-400/50" /> Current plan
        </span>
        {prop && (
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm" style={{ background: color, opacity: 0.5 }} /> Proposal
          </span>
        )}
        <span>Band = 10th–90th percentile · line = median</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-xs">
        <Cell head>At age {investor.retireAge}</Cell>
        <Cell head>Current</Cell>
        <Cell head>Proposal</Cell>
        <Cell>Median</Cell>
        <Cell>{usdShort(last(base.p50))}</Cell>
        <Cell>{prop ? usdShort(last(prop.p50)) : '—'}</Cell>
        <Cell>Bad case (P10)</Cell>
        <Cell>{usdShort(last(base.p10))}</Cell>
        <Cell strong={!!prop && last(prop.p10) < last(base.p10) * 0.97}>{prop ? usdShort(last(prop.p10)) : '—'}</Cell>
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer font-semibold text-slate-600 hover:text-slate-900">Transparent assumptions</summary>
        <table className="mt-2 w-full">
          <thead className="text-left text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-1">Asset</th>
              <th>Return</th>
              <th>Vol</th>
              <th>Tail risk</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-slate-600">
            {ASSET_ORDER.map((id) => {
              const a = ASSETS[id]
              return (
                <tr key={id} className="border-t border-slate-100">
                  <td className="py-1 font-mono font-semibold">{a.ticker}</td>
                  <td>{pct(a.mu * 100)}</td>
                  <td>{pct(a.sigma * 100, 0)}</td>
                  <td>{a.tailProb ? `${pct(a.tailProb * 100, 0)}/yr of −${pct((a.tailLoss ?? 0) * 100, 0)}` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-slate-500">
          <li>
            Contributions {usd(investor.monthlyContribution)}/month, horizon {investor.retireAge - investor.age} years, annual rebalance.
          </li>
          <li>One-factor market model (market vol {pct(MARKET_VOL * 100, 0)}) plus asset-specific risk.</li>
          <li>Single stocks carry a sudden-drawdown tail event. That is the concentration risk.</li>
          <li>Seed {TWIN_SETTINGS.seed}: current and proposed portfolios run through the same simulated markets, so any gap comes from the portfolio and not from luck.</li>
          <li>All numbers are illustrative demo assumptions, not forecasts.</li>
        </ul>
      </details>
    </Card>
  )
}

function Big({ label, value, color, delta }: { label: string; value: string; color: string; delta?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="text-3xl font-extrabold tabular-nums tracking-tight" style={{ color }}>
        {value}
      </div>
      {delta && <div className="text-[11px] font-semibold text-slate-500">{delta}</div>}
    </div>
  )
}

function Cell({ children, head, strong }: { children: React.ReactNode; head?: boolean; strong?: boolean }) {
  return <div className={`bg-white px-2 py-1.5 tabular-nums ${head ? 'font-semibold text-slate-400' : 'text-slate-700'} ${strong ? 'font-bold text-rose-600' : ''}`}>{children}</div>
}
