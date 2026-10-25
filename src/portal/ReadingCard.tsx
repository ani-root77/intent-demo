import { useState } from 'react'
import { CircleCheck, FileSearch, Pencil, Plus, X } from 'lucide-react'
import type { IntentEdit, Reading, RequestType, RequestedTrade, Source } from '../engine/advisory'
import type { Workspace } from '../engine/config'
import { RISK_LEANS, type RiskLean } from '../engine/objectives'

const RISK_TEXT: Record<RiskLean, string> = { very_conservative: 'Very cautious', conservative: 'Cautious', moderate: 'Moderate', aggressive: 'Higher risk', very_aggressive: 'Very high risk', neutral: 'No risk signal' }
const TYPES: { v: RequestType; label: string }[] = [
  { v: 'suggestion', label: 'Suggestion' },
  { v: 'advice', label: 'Advice' },
  { v: 'other', label: 'Other' },
]

function SourceTag({ s }: { s: Source }) {
  if (s === 'you') return <span className="rounded bg-indigo-50 px-1.5 text-[10px] font-bold text-indigo-700">✎ set by you</span>
  if (s === 'rules') return <span className="rounded bg-emerald-50 px-1.5 text-[10px] font-bold text-emerald-700">⚙ rules</span>
  return <span className="rounded bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">no rule matched</span>
}

function Row({ label, source, children }: { label: string; source: Source; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-slate-100 py-2.5 first:border-0 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex items-center gap-2 sm:w-44 sm:shrink-0">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <SourceTag s={source} />
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

const chip = (on: boolean) => `rounded-lg border px-2.5 py-1 text-sm font-semibold transition-colors ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`
const select = 'max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800'

/**
 * How Clario read the request. The reading comes from fixed rules (no AI); the investor can correct any field,
 * and the verdict recalculates at once. When the rules can't read the request, the verdict waits for confirmation.
 */
export function ReadingCard({ reading, edit, onEdit, ws, question }: { reading: Reading; edit: IntentEdit; onEdit: (e: IntentEdit) => void; ws: Workspace; question: string }) {
  const set = (patch: IntentEdit) => onEdit({ ...edit, ...patch, confirmed: true })
  const gated = reading.needsConfirm && !reading.confirmed
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<RequestedTrade>({ ticker: ws.universe.assets[0]!.ticker, side: 'BUY', usd: 0, percent: 10 })
  const tickers = reading.known.map((a) => a.ticker)
  const addable = ws.universe.assets.filter((a) => !tickers.includes(a.ticker))
  const fmt = (r: RequestedTrade) => `${r.side} ${r.usd ? `$${r.usd.toLocaleString()}` : `${r.percent}%`} ${r.ticker}`

  return (
    <section className={`rounded-2xl border-2 bg-white p-4 sm:p-5 ${gated ? 'border-amber-300' : 'border-slate-200'}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <FileSearch size={15} className="text-slate-400" />
        <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">How Clario read your request</h3>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">No AI · fixed rules</span>
      </div>
      <p className="mb-2 text-sm text-slate-600">
        “<i>{question}</i>”
      </p>
      {gated ? (
        <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Clario’s rules couldn’t tell what this request is about. Instead of guessing, it asks you: set the fields below and press <b>Confirm</b> to see the verdict.
        </div>
      ) : (
        <p className="mb-2 text-xs text-slate-500">Looks wrong? Change any field and Clario re-checks the answer instantly.</p>
      )}

      <Row label="Request type" source={reading.sources.type}>
        {TYPES.map((x) => (
          <button key={x.v} onClick={() => set({ request_type: x.v })} className={chip(reading.request_type === x.v)}>
            {x.label}
          </button>
        ))}
      </Row>
      <Row label="Goal" source={reading.sources.objective}>
        <select value={reading.objective} onChange={(e) => set({ objective: e.target.value })} className={select}>
          <option value="unclear">No single goal</option>
          {ws.objectives.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Risk implied" source={reading.sources.lean}>
        <select value={reading.lean} onChange={(e) => set({ lean: e.target.value as RiskLean })} className={select}>
          {RISK_LEANS.map((l) => (
            <option key={l} value={l}>
              {RISK_TEXT[l]}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Assets" source={reading.sources.assets}>
        {reading.known.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-800">
            {a.ticker}
            <button aria-label={`Remove ${a.ticker}`} onClick={() => set({ assets: tickers.filter((t) => t !== a.ticker) })} className="text-emerald-600 hover:text-emerald-900">
              <X size={13} />
            </button>
          </span>
        ))}
        {reading.unknown.map((u) => (
          <span key={u} title="Not in the verifiable asset list" className="rounded-lg bg-violet-50 px-2 py-1 text-sm font-semibold text-violet-800">
            {u} · can’t verify
          </span>
        ))}
        <select
          value=""
          onChange={(e) => e.target.value && set({ assets: [...tickers, e.target.value] })}
          className="max-w-full rounded-lg border border-dashed border-slate-300 bg-white px-2 py-1 text-sm text-slate-500"
        >
          <option value="">+ Add asset</option>
          {addable.map((a) => (
            <option key={a.id} value={a.ticker}>
              {a.ticker} · {a.name}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Explicit action" source={reading.sources.requested}>
        {reading.requested.map((r, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-mono text-sm font-semibold text-slate-800">
            {fmt(r)}
            <button aria-label="Remove action" onClick={() => set({ requested: reading.requested.filter((_, k) => k !== i) })} className="text-slate-500 hover:text-slate-900">
              <X size={13} />
            </button>
          </span>
        ))}
        {!reading.requested.length && !adding && <span className="text-sm text-slate-400">None</span>}
        {adding ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <select value={draft.side} onChange={(e) => setDraft({ ...draft, side: e.target.value as 'BUY' | 'SELL' })} className={select}>
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
            </select>
            <input
              type="number"
              min={0}
              value={draft.usd || draft.percent}
              onChange={(e) => {
                const n = Math.max(0, Number(e.target.value) || 0)
                setDraft(draft.usd ? { ...draft, usd: n } : { ...draft, percent: n })
              }}
              className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
            />
            <select
              value={draft.usd ? 'usd' : 'pct'}
              onChange={(e) => {
                const v = draft.usd || draft.percent
                setDraft(e.target.value === 'usd' ? { ...draft, usd: v, percent: 0 } : { ...draft, percent: v, usd: 0 })
              }}
              className={select}
            >
              <option value="pct">% of portfolio</option>
              <option value="usd">$</option>
            </select>
            <select value={draft.ticker} onChange={(e) => setDraft({ ...draft, ticker: e.target.value })} className={select}>
              {ws.universe.assets.map((a) => (
                <option key={a.id} value={a.ticker}>
                  {a.ticker}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                set({ requested: [...reading.requested, draft] })
                setAdding(false)
              }}
              className="rounded-lg bg-slate-900 px-2.5 py-1 text-sm font-semibold text-white"
            >
              Add
            </button>
            <button onClick={() => setAdding(false)} className="text-sm text-slate-500">
              Cancel
            </button>
          </span>
        ) : (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1 text-sm text-slate-500 hover:bg-slate-50">
            <Plus size={13} /> Add
          </button>
        )}
      </Row>

      {reading.rules.evidence.length > 0 && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">⚙ Rule matches: {reading.rules.evidence.join(' · ')}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {gated ? (
          <button onClick={() => onEdit({ ...edit, confirmed: true })} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <CircleCheck size={15} /> Confirm and check the answer
          </button>
        ) : (
          Object.keys(edit).some((k) => k !== 'confirmed') && (
            <button onClick={() => onEdit({})} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <Pencil size={12} /> Reset to the rules’ reading
            </button>
          )
        )}
        <span className="text-[11px] text-slate-400">Clario never uses AI to read your request. Your corrections are the final word on what you meant.</span>
      </div>
    </section>
  )
}
