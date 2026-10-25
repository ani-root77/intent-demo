import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { SCENARIOS, SCENARIO_ORDER, type Flow, type ScenarioId, type Step } from '../engine/scenarios'
import { DECISION } from './theme'

export function caption(s: Step, flow: Flow): string {
  switch (s.kind) {
    case 'intent':
      return flow.scenario.intent.kind === 'request' ? 'Investor states her intent' : 'Investor sets a standing mandate'
    case 'parse':
      return 'Clario locks the intent as hard constraints'
    case 'context':
      return 'Untrusted content reaches the agent'
    case 'propose':
      return s.i === 0 ? 'AI agent proposes an action' : `AI agent revises its proposal (v${s.i + 1})`
    case 'verify':
      return `Clario independently verifies v${s.i + 1}: ${DECISION[flow.verifications[s.i].decision].label}`
    case 'feedback':
      return 'Structured feedback loops back to the agent'
    case 'outcome':
      return flow.final === 'ALLOW' ? 'Investor sees the impact and gives final approval' : flow.final === 'BLOCK' ? 'Blocked and explained. Nothing executed' : 'Escalated to a human. Never auto-approved'
  }
}

function segColor(s: Step, flow: Flow) {
  if (s.kind === 'verify') return DECISION[flow.verifications[s.i].decision].hex
  if (s.kind === 'outcome') return DECISION[flow.final].hex
  if (s.kind === 'feedback') return '#d97706'
  if (s.kind === 'context') return '#e11d48'
  return '#4f46e5'
}

interface Props {
  scenarioId: ScenarioId
  onScenario: (id: ScenarioId) => void
  flow: Flow
  index: number
  onIndex: (i: number) => void
  playing: boolean
  onPlay: (p: boolean) => void
}

export function ScenarioBar({ scenarioId, onScenario, flow, index, onIndex, playing, onPlay }: Props) {
  const n = flow.steps.length
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {SCENARIO_ORDER.map((id, k) => (
            <button
              key={id}
              onClick={() => onScenario(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${id === scenarioId ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="mr-1 opacity-60">{k + 1}</span>
              {SCENARIOS[id].label}
            </button>
          ))}
        </div>

        <div className="min-w-[240px] flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Step {index + 1} of {n}
          </div>
          <div className="text-[15px] font-semibold text-slate-900">{caption(flow.steps[index], flow)}</div>
        </div>

        <div className="flex items-center gap-1.5">
          <IconBtn title="Restart (R)" onClick={() => onIndex(0)}>
            <RotateCcw size={16} />
          </IconBtn>
          <IconBtn title="Back (←)" onClick={() => onIndex(Math.max(0, index - 1))} disabled={index === 0}>
            <ChevronLeft size={18} />
          </IconBtn>
          <IconBtn title={playing ? 'Pause' : 'Autoplay'} onClick={() => onPlay(!playing)}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </IconBtn>
          <button
            onClick={() => onIndex(Math.min(n - 1, index + 1))}
            disabled={index === n - 1}
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex gap-1">
        {flow.steps.map((s, k) => (
          <button
            key={k}
            title={caption(s, flow)}
            onClick={() => onIndex(k)}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{ background: k <= index ? segColor(s, flow) : '#e2e8f0' }}
          />
        ))}
      </div>
    </div>
  )
}

function IconBtn({ children, title, onClick, disabled }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button title={title} onClick={onClick} disabled={disabled} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40">
      {children}
    </button>
  )
}
