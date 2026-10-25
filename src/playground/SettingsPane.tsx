import { useEffect, useRef, useState } from 'react'
import { Download, Plus, RotateCcw, Trash2, Upload } from 'lucide-react'
import { DEFAULT_AGENT, DEFAULT_MARKET, DEFAULT_PORTAL, DEFAULT_WORKSPACE, newId, type Headline, type MarketQuote, type MarketSnapshot, type Workspace } from '../engine/config'
import type { Asset, AssetKind } from '../engine/model'
import { DEFAULT_RULES, type RuleLexicon } from '../engine/rules'
import { METRICS, RISK_LEANS, requirementOf, type Objective, type ObjectiveMetric } from '../engine/objectives'
import { Btn, NumField, Panel, Segmented, Select, TextField, Toggle } from './fields'

type Tab = 'assets' | 'market' | 'objectives' | 'simulation' | 'agent' | 'portal' | 'rules' | 'data'

/** Comma-separated list input that keeps the user's typing until blur. */
function ListInput({ value, onChange, className, rows }: { value: string[]; onChange: (v: string[]) => void; className?: string; rows?: number }) {
  const [draft, setDraft] = useState(value.join(', '))
  useEffect(() => setDraft(value.join(', ')), [value])
  const commit = () => onChange(draft.split(',').map((s) => s.trim()).filter(Boolean))
  return rows ? (
    <textarea value={draft} rows={rows} onChange={(e) => setDraft(e.target.value)} onBlur={commit} className={className} />
  ) : (
    <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} className={className} />
  )
}

const RULE_LISTS: { key: Exclude<keyof RuleLexicon, 'riskWords' | 'metricWords' | 'bigPercent'>; label: string; hint: string }[] = [
  { key: 'buyWords', label: 'Buy words', hint: 'A sentence with one of these recommends buying the assets in it.' },
  { key: 'sellWords', label: 'Sell words', hint: 'A sentence with one of these recommends selling.' },
  { key: 'negations', label: 'Negations', hint: 'A clause with one of these means “avoid” for the assets in it.' },
  { key: 'intoWords', label: 'Direction words', hint: '“cash into QQQ”: assets after the word are bought, before it are sold.' },
  { key: 'recommendCues', label: 'Recommendation cues', hint: 'A sentence only counts as a recommendation if it has one of these (or starts with a buy/sell verb).' },
  { key: 'positiveIdioms', label: 'Positive idioms', hint: 'Look negative but aren’t (“cannot miss”); they cancel a negation.' },
  { key: 'assetLeadWords', label: 'Asset lead words', hint: 'A capitalised name right after one of these is read as an asset (“invest in SpaceX”).' },
  { key: 'generalWords', label: 'General-goal words', hint: 'A request with one of these (and no specific goal) maps to the objective with no direction, e.g. long-term growth.' },
  { key: 'increaseWords', label: 'Increase words', hint: 'Direction for objectives.' },
  { key: 'decreaseWords', label: 'Decrease words', hint: 'Direction for objectives.' },
  { key: 'adviceStarters', label: 'Advice starters', hint: 'A request starting with one of these is a request for advice.' },
  { key: 'stopWords', label: 'Never asset names', hint: 'Capitalised words that are never treated as asset names.' },
]

function RulesView({ ws, update }: Pick<Props, 'ws' | 'update'>) {
  const r = ws.rules
  const set = (patch: Partial<RuleLexicon>) => update((w) => ({ ...w, rules: { ...w.rules, ...patch } }))
  const cls = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs'
  return (
    <div className="space-y-4">
      <Panel
        title="Clario’s rule-based reader (no AI)"
        right={
          <Btn onClick={() => set(DEFAULT_RULES)}>
            <RotateCcw size={12} /> Defaults
          </Btn>
        }
      >
        <p className="text-sm text-slate-600">
          These keyword lists drive Clario’s deterministic reading of the investor’s request and of the AI’s written answer. They cross-check the AI reader (the rules win on disagreement) and decide the “text matches trades”, “answers the question”, “asset coverage” and context-trust checks. Asset names come from the Assets tab, including “Also called”. Comma separated.
        </p>
        <div className="mt-3">
          <NumField label="A buy of at least this share of the portfolio in a volatile asset reads as very aggressive" suffix="%" step={5} value={r.bigPercent} onChange={(bigPercent) => set({ bigPercent })} />
        </div>
      </Panel>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Risk words (most extreme level found wins)">
          {(Object.keys(r.riskWords) as (keyof RuleLexicon['riskWords'])[]).map((k) => (
            <label key={k} className="mb-2 block text-sm">
              <span className="text-slate-600">{k.replace('_', ' ')}</span>
              <ListInput rows={2} value={r.riskWords[k]} onChange={(v) => set({ riskWords: { ...r.riskWords, [k]: v } })} className={cls} />
            </label>
          ))}
        </Panel>
        <Panel title="Objective words (which metric a request is about)">
          {(Object.keys(r.metricWords) as (keyof RuleLexicon['metricWords'])[]).map((k) => (
            <label key={k} className="mb-2 block text-sm">
              <span className="text-slate-600">{k}</span>
              <ListInput rows={2} value={r.metricWords[k]} onChange={(v) => set({ metricWords: { ...r.metricWords, [k]: v } })} className={cls} />
            </label>
          ))}
        </Panel>
      </div>
      <Panel title="Sentence words">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {RULE_LISTS.map((f) => (
            <label key={f.key} className="block text-sm" title={f.hint}>
              <span className="text-slate-600">{f.label}</span> <span className="text-[11px] text-slate-400">{f.hint}</span>
              <ListInput rows={2} value={r[f.key]} onChange={(v) => set({ [f.key]: v } as Partial<RuleLexicon>)} className={cls} />
            </label>
          ))}
        </div>
      </Panel>
    </div>
  )
}

interface Props {
  ws: Workspace
  update: (fn: (w: Workspace) => Workspace) => void
  replace: (raw: unknown) => void
}

export function SettingsPane({ ws, update, replace }: Props) {
  const [tab, setTab] = useState<Tab>('assets')
  return (
    <div className="space-y-4">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'assets', label: 'Assets' },
          { value: 'market', label: 'Market today' },
          { value: 'objectives', label: 'Objectives' },
          { value: 'simulation', label: 'Market & simulation' },
          { value: 'agent', label: 'Agent' },
          { value: 'portal', label: 'AI advisory' },
          { value: 'rules', label: 'Clario rules' },
          { value: 'data', label: 'Import / export' },
        ]}
      />
      {tab === 'assets' && <Assets ws={ws} update={update} />}
      {tab === 'objectives' && <Objectives ws={ws} update={update} />}
      {tab === 'simulation' && <Simulation ws={ws} update={update} />}
      {tab === 'agent' && <AgentSettingsView ws={ws} update={update} />}
      {tab === 'market' && <MarketView ws={ws} update={update} />}
      {tab === 'portal' && <PortalView ws={ws} update={update} />}
      {tab === 'rules' && <RulesView ws={ws} update={update} />}
      {tab === 'data' && <Data ws={ws} replace={replace} />}
    </div>
  )
}

const KIND_OPTS: { value: AssetKind; label: string }[] = [
  { value: 'fund', label: 'Fund' },
  { value: 'stock', label: 'Single stock' },
  { value: 'bond', label: 'Bond' },
  { value: 'cash', label: 'Cash' },
]

function H({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <th title={title} className="px-1.5 py-1 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
      {children}
    </th>
  )
}

function Assets({ ws, update }: Pick<Props, 'ws' | 'update'>) {
  const setAsset = (id: string, patch: Partial<Asset>) => update((w) => ({ ...w, universe: { ...w.universe, assets: w.universe.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)) } }))
  const add = () =>
    update((w) => ({
      ...w,
      universe: { ...w.universe, assets: [...w.universe.assets, { id: newId('asset'), name: 'New asset', ticker: `NEW${w.universe.assets.length + 1}`, kind: 'fund', equity: true, techShare: 0.2, mu: 0.07, sigma: 0.18, beta: 1, color: '#a855f7' }] },
    }))
  const remove = (id: string) => update((w) => ({ ...w, universe: { ...w.universe, assets: w.universe.assets.filter((a) => a.id !== id) } }))
  return (
    <Panel
      title="Tradable assets"
      right={
        <span className="flex gap-1.5">
          <Btn onClick={add} tone="primary">
            <Plus size={13} /> Add asset
          </Btn>
          <Btn onClick={() => update((w) => ({ ...w, universe: DEFAULT_WORKSPACE.universe }))}>
            <RotateCcw size={12} /> Defaults
          </Btn>
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1440px] text-sm">
          <thead>
            <tr>
              <H>Color</H>
              <H>Ticker</H>
              <H>Name</H>
              <H>Kind</H>
              <H title="Counts toward equity limits (funds only; stocks always count)">Equity</H>
              <H title="Share of the holding that looks through to technology">Tech %</H>
              <H title="Expected annual return">Return %</H>
              <H title="Annual volatility">Vol %</H>
              <H title="Sensitivity to the shared market factor">Beta</H>
              <H title="Annual chance of a sudden crash (single-stock tail risk)">Crash %/yr</H>
              <H title="Size of that crash">Crash loss %</H>
              <H title="Illustrative last price (portal display)">Price $</H>
              <H title="Today's move, shown in the portal and given to the AI advisor">Today %</H>
              <H title="Display sector">Sector</H>
              <H title="Other names Clario's rule-based reader recognises (comma separated)">Also called</H>
              <H> </H>
            </tr>
          </thead>
          <tbody>
            {ws.universe.assets.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-1.5 py-1">
                  <input type="color" value={a.color} onChange={(e) => setAsset(a.id, { color: e.target.value })} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent" />
                </td>
                <td className="px-1.5 py-1">
                  <input value={a.ticker} onChange={(e) => setAsset(a.id, { ticker: e.target.value })} className="w-16 rounded border border-slate-200 bg-slate-50 px-1 font-mono text-xs font-semibold uppercase" />
                </td>
                <td className="px-1.5 py-1">
                  <input value={a.name} onChange={(e) => setAsset(a.id, { name: e.target.value })} className="w-full min-w-[160px] rounded border border-slate-200 bg-slate-50 px-1 text-xs" />
                </td>
                <td className="px-1.5 py-1">
                  <Select value={a.kind} options={KIND_OPTS} onChange={(kind) => setAsset(a.id, { kind })} className="text-xs" />
                </td>
                <td className="px-1.5 py-1 text-center">
                  <input type="checkbox" disabled={a.kind !== 'fund'} checked={a.equity} onChange={(e) => setAsset(a.id, { equity: e.target.checked })} />
                </td>
                <td className="px-1.5 py-1">
                  <NumField value={a.techShare} scale={100} step={5} onChange={(techShare) => setAsset(a.id, { techShare })} width="w-16" />
                </td>
                <td className="px-1.5 py-1">
                  <NumField value={a.mu} scale={100} step={0.5} onChange={(mu) => setAsset(a.id, { mu })} width="w-16" />
                </td>
                <td className="px-1.5 py-1">
                  <NumField value={a.sigma} scale={100} step={1} onChange={(sigma) => setAsset(a.id, { sigma })} width="w-16" />
                </td>
                <td className="px-1.5 py-1">
                  <NumField value={a.beta} step={0.05} onChange={(beta) => setAsset(a.id, { beta })} width="w-16" />
                </td>
                <td className="px-1.5 py-1">
                  <NumField value={a.tailProb ?? 0} scale={100} step={1} onChange={(tailProb) => setAsset(a.id, { tailProb, tailLoss: a.tailLoss ?? 0.5 })} width="w-16" />
                </td>
                <td className="px-1.5 py-1">
                  <NumField value={a.tailLoss ?? 0} scale={100} step={5} onChange={(tailLoss) => setAsset(a.id, { tailLoss })} width="w-16" />
                </td>
                <td className="px-1.5 py-1">
                  <NumField value={a.price ?? 0} step={1} onChange={(price) => setAsset(a.id, { price })} width="w-20" />
                </td>
                <td className="px-1.5 py-1">
                  <NumField value={a.dayChangePct ?? 0} step={0.1} onChange={(dayChangePct) => setAsset(a.id, { dayChangePct })} width="w-16" />
                </td>
                <td className="px-1.5 py-1">
                  <input value={a.sector ?? ''} onChange={(e) => setAsset(a.id, { sector: e.target.value })} className="w-24 rounded border border-slate-200 bg-slate-50 px-1 text-xs" />
                </td>
                <td className="px-1.5 py-1">
                  <ListInput value={a.aliases ?? []} onChange={(aliases) => setAsset(a.id, { aliases })} className="w-44 rounded border border-slate-200 bg-slate-50 px-1 text-xs" />
                </td>
                <td className="px-1.5 py-1">
                  <button onClick={() => remove(a.id)} disabled={ws.universe.assets.length < 2} title="Remove asset" className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        The first asset of kind <b>Cash</b> is the cash reserve. Removing an asset also removes it from every profile’s holdings. Volatility is split into a market part (beta × market volatility) and an asset-specific part.
      </p>
    </Panel>
  )
}

const METRIC_OPTS = (Object.keys(METRICS) as ObjectiveMetric[]).map((m) => ({ value: m, label: METRICS[m].label }))

function Objectives({ ws, update }: Pick<Props, 'ws' | 'update'>) {
  const setObj = (k: number, patch: Partial<Objective>) => update((w) => ({ ...w, objectives: w.objectives.map((o, i) => (i === k ? { ...o, ...patch } : o)) }))
  return (
    <Panel
      title="Objectives a request can be locked to"
      right={
        <span className="flex gap-1.5">
          <Btn tone="primary" onClick={() => update((w) => ({ ...w, objectives: [...w.objectives, { id: newId('objective'), label: 'New objective', matches: '', metric: 'none', direction: 'up', lean: 'neutral' }] }))}>
            <Plus size={13} /> Add objective
          </Btn>
          <Btn onClick={() => update((w) => ({ ...w, objectives: DEFAULT_WORKSPACE.objectives }))}>
            <RotateCcw size={12} /> Defaults
          </Btn>
        </span>
      }
    >
      <div className="space-y-3">
        {ws.objectives.map((o, k) => (
          <div key={k} className="rounded-xl border border-slate-200 p-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_minmax(0,1fr)_auto]">
              <TextField label="Id (what the LLM returns)" value={o.id} onChange={(id) => setObj(k, { id })} />
              <TextField label="Label" value={o.label} onChange={(label) => setObj(k, { label })} />
              <div className="flex items-end">
                <button onClick={() => update((w) => ({ ...w, objectives: w.objectives.filter((_, i) => i !== k) }))} disabled={ws.objectives.length < 2} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div className="mt-2">
              <TextField label="What requests it covers (for people and the advisor; Clario matches with its rule words)" value={o.matches} rows={2} onChange={(matches) => setObj(k, { matches })} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              A proposal serves it only if
              <Select value={o.metric} options={METRIC_OPTS} onChange={(metric) => setObj(k, { metric })} />
              {o.metric !== 'none' && (
                <>
                  goes
                  <Segmented value={o.direction} options={[{ value: 'up', label: 'up' }, { value: 'down', label: 'down' }]} onChange={(direction) => setObj(k, { direction })} />
                </>
              )}
              <span className="text-xs text-slate-400">→ {requirementOf(o)}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              Risk lean (for intent-drift detection)
              <Select value={o.lean} options={RISK_LEANS.map((l) => ({ value: l, label: l.replace('_', ' ') }))} onChange={(lean) => setObj(k, { lean })} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function Simulation({ ws, update }: Pick<Props, 'ws' | 'update'>) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Panel title="Market model">
        <NumField label="Market factor volatility" suffix="%" scale={100} step={1} value={ws.universe.marketVol} onChange={(marketVol) => update((w) => ({ ...w, universe: { ...w.universe, marketVol } }))} hint="Shared market shock that hits every asset in proportion to its beta." />
        <p className="mt-2 text-[11px] text-slate-500">Each year every asset gets: drift + beta × market shock + its own shock, plus a possible crash. The portfolio is rebalanced to its weights each year, and contributions are added at year end.</p>
      </Panel>
      <Panel title="Financial Twin (Monte Carlo)" right={<Btn onClick={() => update((w) => ({ ...w, twin: DEFAULT_WORKSPACE.twin }))}><RotateCcw size={12} /> Defaults</Btn>}>
        <NumField label="Simulated paths" step={500} value={ws.twin.paths} onChange={(paths) => update((w) => ({ ...w, twin: { ...w.twin, paths } }))} hint="More paths = smoother estimate, slower. 100–20,000." />
        <NumField label="Random seed" step={1} value={ws.twin.seed} onChange={(seed) => update((w) => ({ ...w, twin: { ...w.twin, seed } }))} hint="Before and after portfolios always share the same seed, so the difference comes from the portfolio." />
        <NumField label="Paths drawn in the animation" step={10} value={ws.twin.samplePaths} onChange={(samplePaths) => update((w) => ({ ...w, twin: { ...w.twin, samplePaths } }))} />
        <p className="mt-2 text-[11px] text-slate-500">Change the seed to see how much the goal likelihood moves from luck alone. Horizon, target and contributions come from each profile.</p>
      </Panel>
    </div>
  )
}

function AgentSettingsView({ ws, update }: Pick<Props, 'ws' | 'update'>) {
  const a = ws.agent
  const set = (patch: Partial<typeof a>) => update((w) => ({ ...w, agent: { ...w.agent, ...patch } }))
  const [models, setModels] = useState<string[]>([])
  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((d) => setModels(d.models ?? []))
      .catch(() => setModels([]))
  }, [])
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel title="Model" right={<Btn onClick={() => set(DEFAULT_AGENT)}><RotateCcw size={12} /> Defaults</Btn>}>
        <label className="flex items-center justify-between gap-2 py-0.5 text-sm">
          <span className="text-slate-600">Agent / advisor model (being checked)</span>
          <span>
            <input list="gemini-models" value={a.model} onChange={(e) => set({ model: e.target.value })} className="w-56 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs" />
            <datalist id="gemini-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </span>
        </label>
        <NumField label="Agent temperature" step={0.1} value={a.agentTemperature} onChange={(agentTemperature) => set({ agentTemperature })} hint="Higher = more varied proposals." />
        <NumField label="Repairs for malformed output" step={1} value={a.maxRepairs} onChange={(maxRepairs) => set({ maxRepairs })} hint="How many times the agent may fix a malformed proposal. These never count as attempts." />
        <Toggle label="Agent is told the limits up front" value={a.agentSeesLimits} onChange={(agentSeesLimits) => set({ agentSeesLimits })} hint="Off: the agent only learns the limits from Clario's feedback." />
        <p className="mt-2 text-[11px] text-slate-500">{models.length ? `${models.length} models available to your key.` : 'Model list unavailable (no key, or offline). You can still type a model id.'}</p>
      </Panel>

      <Panel
        title="Agent styles"
        right={
          <Btn tone="primary" onClick={() => set({ styles: [...a.styles, { id: newId('style'), label: 'New style', prompt: '' }] })}>
            <Plus size={13} /> Add style
          </Btn>
        }
      >
        <div className="space-y-2">
          {a.styles.map((s, k) => (
            <div key={s.id} className="rounded-lg border border-slate-200 p-2">
              <div className="flex items-center gap-2">
                <input value={s.label} onChange={(e) => set({ styles: a.styles.map((x, i) => (i === k ? { ...x, label: e.target.value } : x)) })} className="flex-1 rounded border border-slate-200 bg-slate-50 px-1.5 text-sm font-semibold" />
                <button onClick={() => set({ styles: a.styles.filter((_, i) => i !== k) })} disabled={a.styles.length < 2} className="rounded p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30">
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea value={s.prompt} rows={2} onChange={(e) => set({ styles: a.styles.map((x, i) => (i === k ? { ...x, prompt: e.target.value } : x)) })} className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs" />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Agent system prompt" right={<Btn onClick={() => set({ agentSystemPrompt: DEFAULT_AGENT.agentSystemPrompt })}><RotateCcw size={12} /> Default</Btn>}>
        <TextField value={a.agentSystemPrompt} rows={12} mono onChange={(agentSystemPrompt) => set({ agentSystemPrompt })} />
        <p className="mt-1 text-[11px] text-slate-500">
          Placeholders: <code>{'{agent}'}</code> <code>{'{investor}'}</code> <code>{'{style}'}</code> <code>{'{objectives}'}</code> <code>{'{limits}'}</code>. The JSON output format is enforced separately.
        </p>
      </Panel>

    </div>
  )
}

const MOODS: { value: MarketSnapshot['mood']; label: string }[] = [
  { value: 'calm', label: 'Calm' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'volatile', label: 'Volatile' },
  { value: 'selloff', label: 'Sell-off' },
  { value: 'rally', label: 'Rally' },
]

function QuotesEditor({ title, list, onChange }: { title: string; list: MarketQuote[]; onChange: (l: MarketQuote[]) => void }) {
  return (
    <Panel
      title={title}
      right={
        <Btn onClick={() => onChange([...list, { name: 'New', level: 100, changePct: 0 }])}>
          <Plus size={13} /> Add
        </Btn>
      }
    >
      {list.map((q, k) => (
        <div key={k} className="flex items-center gap-2 py-0.5">
          <input value={q.name} onChange={(e) => onChange(list.map((x, i) => (i === k ? { ...x, name: e.target.value } : x)))} className="min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 px-1.5 text-sm" />
          <NumField value={q.level} step={1} onChange={(level) => onChange(list.map((x, i) => (i === k ? { ...x, level } : x)))} width="w-24" />
          <NumField value={q.changePct} step={0.1} suffix="%" onChange={(changePct) => onChange(list.map((x, i) => (i === k ? { ...x, changePct } : x)))} width="w-16" />
          <button onClick={() => onChange(list.filter((_, i) => i !== k))} className="rounded p-1 text-slate-400 hover:text-rose-600">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </Panel>
  )
}

function MarketView({ ws, update }: Pick<Props, 'ws' | 'update'>) {
  const m = ws.market
  const set = (patch: Partial<MarketSnapshot>) => update((w) => ({ ...w, market: { ...w.market, ...patch } }))
  const setH = (k: number, patch: Partial<Headline>) => set({ headlines: m.headlines.map((h, i) => (i === k ? { ...h, ...patch } : h)) })
  return (
    <div className="space-y-4">
      <Panel
        title="Market snapshot (simulated)"
        right={
          <Btn onClick={() => set(DEFAULT_MARKET)}>
            <RotateCcw size={12} /> Defaults
          </Btn>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_160px_minmax(0,1fr)]">
          <TextField label="As of" value={m.asOf} onChange={(asOf) => set({ asOf })} />
          <label className="block space-y-1 text-sm">
            <span className="text-slate-600">Mood</span>
            <Select value={m.mood} options={MOODS} onChange={(mood) => set({ mood })} className="w-full" />
          </label>
          <TextField label="Summary (given to the AI advisor)" value={m.summary} onChange={(summary) => set({ summary })} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Today’s move per asset is set in the Assets tab. Everything here is shown on the portal and passed to the AI advisor as “current market conditions”.</p>
      </Panel>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <QuotesEditor title="Indices" list={m.indices} onChange={(indices) => set({ indices })} />
        <QuotesEditor title="Other markets" list={m.other} onChange={(other) => set({ other })} />
      </div>
      <Panel
        title="Headlines"
        right={
          <Btn tone="primary" onClick={() => set({ headlines: [...m.headlines, { id: 0, source: 'Newswire', title: 'New headline', time: '', verified: true, sentiment: 'neutral', tickers: [] }] })}>
            <Plus size={13} /> Add headline
          </Btn>
        }
      >
        <div className="space-y-2">
          {m.headlines.map((h, k) => (
            <div key={k} className={`rounded-xl border p-2.5 ${h.verified ? 'border-slate-200' : 'border-rose-200 bg-rose-50/40'}`}>
              <div className="flex items-center gap-2">
                <span className="w-6 text-xs font-bold text-slate-400">[{h.id || '+'}]</span>
                <input value={h.title} onChange={(e) => setH(k, { title: e.target.value })} className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-sm" />
                <button onClick={() => set({ headlines: m.headlines.filter((_, i) => i !== k) })} className="rounded p-1 text-slate-400 hover:text-rose-600">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-8 text-xs">
                <input value={h.source} onChange={(e) => setH(k, { source: e.target.value })} className="w-48 rounded border border-slate-200 bg-white px-1.5 py-0.5" placeholder="Source" />
                <input value={h.time} onChange={(e) => setH(k, { time: e.target.value })} className="w-32 rounded border border-slate-200 bg-white px-1.5 py-0.5" placeholder="Time" />
                <input value={h.tickers.join(', ')} onChange={(e) => setH(k, { tickers: e.target.value.split(',').map((t) => t.trim()) })} className="w-40 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono" placeholder="Tickers, comma separated" />
                <Select
                  value={h.sentiment}
                  options={[
                    { value: 'positive', label: 'Positive' },
                    { value: 'neutral', label: 'Neutral' },
                    { value: 'negative', label: 'Negative' },
                  ]}
                  onChange={(sentiment) => setH(k, { sentiment })}
                  className="text-xs"
                />
                <Segmented
                  size="xs"
                  value={h.verified ? 'v' : 'u'}
                  options={[
                    { value: 'v', label: 'Verified', tone: 'text-emerald-700' },
                    { value: 'u', label: 'Unverified', tone: 'text-rose-700' },
                  ]}
                  onChange={(x) => setH(k, { verified: x === 'v' })}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Unverified items (rumours, social posts) count as untrusted context: if the AI cites one, or recommends buying a ticker it mentions, the context-trust check flags it.</p>
      </Panel>
    </div>
  )
}

function PortalView({ ws, update }: Pick<Props, 'ws' | 'update'>) {
  const p = ws.portal
  const set = (patch: Partial<typeof p>) => update((w) => ({ ...w, portal: { ...w.portal, ...patch } }))
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel
        title="AI advisor"
        right={
          <Btn onClick={() => set(DEFAULT_PORTAL)}>
            <RotateCcw size={12} /> Defaults
          </Btn>
        }
      >
        <label className="flex items-center justify-between gap-2 py-0.5 text-sm">
          <span className="text-slate-600">Advisor persona</span>
          <Select value={p.advisorStyleId} options={ws.agent.styles.map((s) => ({ value: s.id, label: s.label }))} onChange={(advisorStyleId) => set({ advisorStyleId })} />
        </label>
        <NumField
          label="Intent-drift sensitivity (risk levels apart)"
          step={1}
          value={p.driftLevels}
          onChange={(driftLevels) => set({ driftLevels })}
          hint="1 = flag any difference between the request's risk and the profile; 2 = flag only big jumps (e.g. Moderate to Very aggressive)."
        />
        <p className="mt-2 text-[11px] text-slate-500">
          The model and temperature come from Agent. Risk levels: very cautious, cautious, moderate, higher-risk, very high-risk. Profiles map to cautious (Conservative), moderate, and higher-risk (Aggressive).
        </p>
      </Panel>
      <Panel title="How Clario decides “blocked”">
        <p className="text-sm text-slate-600">
          Per profile (Customer profiles → limits and decision rules): an answer is <b>blocked</b> if any check set to <i>Block</i> fails, or if at least the profile’s “block when this share fails” percentage of active checks fail. Otherwise it is <b>use with caution</b> if anything failed or warned, or <b>verified</b> if everything passed.
        </p>
      </Panel>
      <Panel
        title="Advisor system prompt"
        right={
          <Btn onClick={() => set({ advisorSystemPrompt: DEFAULT_PORTAL.advisorSystemPrompt })}>
            <RotateCcw size={12} /> Default
          </Btn>
        }
      >
        <TextField value={p.advisorSystemPrompt} rows={12} mono onChange={(advisorSystemPrompt) => set({ advisorSystemPrompt })} />
        <p className="mt-1 text-[11px] text-slate-500">
          Placeholders: <code>{'{investor}'}</code> <code>{'{style}'}</code> <code>{'{objectives}'}</code> <code>{'{limits}'}</code>.
        </p>
      </Panel>
    </div>
  )
}

function Data({ ws, replace }: { ws: Workspace; replace: (raw: unknown) => void }) {
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const exportWs = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(ws, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'intent-workspace.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Panel title="Workspace data">
      <p className="mb-3 text-sm text-slate-600">
        Everything you configure (profiles, assets, objectives, simulation and agent settings) is one workspace, saved in your browser (and, when running locally, also in <code>data/workspace.json</code> on the server). Export it to share or back it up.
      </p>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={exportWs}>
          <Download size={13} /> Export JSON
        </Btn>
        <Btn onClick={() => file.current?.click()}>
          <Upload size={13} /> Import JSON
        </Btn>
        <Btn
          tone="danger"
          onClick={() => {
            if (confirm('Reset all profiles and settings to the defaults?')) {
              replace(DEFAULT_WORKSPACE)
              setMsg('Reset to defaults.')
            }
          }}
        >
          <RotateCcw size={13} /> Reset everything
        </Btn>
        <input
          ref={file}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              replace(JSON.parse(await f.text()))
              setMsg(`Imported ${f.name}.`)
            } catch {
              setMsg('That file is not valid JSON.')
            }
            e.target.value = ''
          }}
        />
      </div>
      {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
    </Panel>
  )
}
