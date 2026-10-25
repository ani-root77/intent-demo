import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Plug } from 'lucide-react'
import { DEFAULT_POLICY, MAYA, type Policy } from './engine/model'
import { buildFlow, SCENARIOS, SCENARIO_ORDER, type ScenarioId } from './engine/scenarios'
import { AuditTrail } from './ui/AuditTrail'
import { Feed, type Resolution } from './ui/Feed'
import { Playground } from './playground/Playground'
import { useWorkspace } from './playground/useWorkspace'
import { isTeam } from './api'
import { Login } from './portal/Login'
import { Portal } from './portal/Portal'
import { HowItWorks } from './ui/HowItWorks'
import { LoopDiagram } from './ui/LoopDiagram'
import { PolicyPanel } from './ui/PolicyPanel'
import { ScenarioBar } from './ui/ScenarioBar'
import { TwinPanel } from './ui/TwinPanel'
import { Card } from './ui/theme'

const AGENTS = ['Nova Advisor Agent · Vendor A', 'BrokerPilot · Vendor B', 'In-house Research Agent']

export default function App() {
  const [view, setView] = useState<'portal' | 'playground' | 'demo' | 'how'>('portal')
  const { ws, update, updateLocal, replace, state } = useWorkspace()
  const [profileId, setProfileId] = useState('')
  const [signedIn, setSignedIn] = useState<string | null>(() => {
    try {
      return localStorage.getItem('intent-signed-in')
    } catch {
      return null
    }
  })
  const signIn = (id: string | null) => {
    setSignedIn(id)
    if (id) setProfileId(id)
    try {
      if (id) localStorage.setItem('intent-signed-in', id)
      else localStorage.removeItem('intent-signed-in')
    } catch {
      /* ignore */
    }
  }
  const [scenarioId, setScenarioId] = useState<ScenarioId>('drift')
  const [rawIndex, setIndex] = useState(0)
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY)
  const [agent, setAgent] = useState(AGENTS[0])
  const [resolution, setResolution] = useState<Resolution>(null)
  const [playing, setPlaying] = useState(false)

  const flow = useMemo(() => buildFlow(SCENARIOS[scenarioId], MAYA, policy, agent), [scenarioId, policy, agent])
  const lastStep = flow.steps.length - 1
  const index = Math.min(rawIndex, lastStep)

  const goScenario = (id: ScenarioId) => {
    setScenarioId(id)
    setIndex(0)
    setResolution(null)
    setPlaying(false)
  }
  const goIndex = (i: number) => {
    setIndex(i)
    if (i < lastStep) setResolution(null)
  }
  const changePolicy = (p: Policy) => {
    setPolicy(p)
    setResolution(null)
  }

  useEffect(() => {
    if (!playing) return
    if (index >= lastStep) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setIndex(index + 1), 3000)
    return () => clearTimeout(t)
  }, [playing, index, lastStep])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== 'demo') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault()
        setIndex((i) => Math.min(lastStep, Math.min(i, lastStep) + 1))
      } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        setIndex((i) => Math.max(0, Math.min(i, lastStep) - 1))
        setResolution(null)
      } else if (e.key === 'r' || e.key === 'R') {
        setIndex(0)
        setResolution(null)
      } else if (['1', '2', '3'].includes(e.key)) {
        goScenario(SCENARIO_ORDER[Number(e.key) - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, lastStep])

  // The Clario lab is for the team only; everyone else only ever sees the portal.
  const team = isTeam()
  if (view === 'portal' || !team) {
    if (!signedIn || !ws.profiles.some((p) => p.id === signedIn)) return <Login ws={ws} onLogin={signIn} />
    return <Portal ws={ws} update={updateLocal} profileId={profileId || signedIn} onProfile={signIn} onOpenLab={team ? () => setView('playground') : undefined} onLogout={() => signIn(null)} />
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            <div>
              <div className="text-lg font-extrabold leading-none tracking-[0.22em]">CLARIO</div>
              <div className="mt-0.5 text-[11px] text-slate-400">Trust layer for autonomous investing</div>
            </div>
          </div>
          <button onClick={() => setView('portal')} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10">
            <ArrowLeft size={13} /> Back to portal
          </button>
          <nav className="flex rounded-lg bg-white/5 p-1 text-sm">
            {(
              [
                ['playground', 'Playground'],
                ['demo', 'Guided demo'],
                ['how', 'How it works'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} className={`rounded-md px-3 py-1 font-semibold ${view === id ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </nav>
          <div className={`ml-auto items-center gap-2 text-xs ${view === 'demo' ? 'flex' : 'hidden'}`}>
            <Plug size={14} className="text-indigo-300" />
            <span className="text-slate-400">Connected agent</span>
            <select value={agent} onChange={(e) => setAgent(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
              {AGENTS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">{view === 'playground' ? 'Proof of concept · simulated portfolios · no trades executed' : 'Concept demo · mocked agent · simulated data'}</span>
        </div>
      </header>

      {view === 'playground' ? (
        <Playground ws={ws} update={update} replace={replace} state={state} profileId={profileId} setProfileId={setProfileId} />
      ) : view === 'demo' ? (
        <main className="mx-auto max-w-[1680px] space-y-4 p-4">
          <ScenarioBar scenarioId={scenarioId} onScenario={goScenario} flow={flow} index={index} onIndex={goIndex} playing={playing} onPlay={setPlaying} />

          <Card className="overflow-hidden bg-slate-50 px-4 pt-3">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="font-bold text-slate-900">{flow.scenario.title}</h2>
              <p className="text-sm text-slate-500">{flow.scenario.tagline}</p>
            </div>
            <LoopDiagram flow={flow} index={index} agent={agent} />
          </Card>

          <div className="grid gap-4 lg:h-[max(500px,calc(100vh_-_460px))] lg:grid-cols-[280px_minmax(0,1fr)_370px]">
            <PolicyPanel investor={MAYA} policy={policy} onChange={changePolicy} onReset={() => changePolicy(DEFAULT_POLICY)} />
            <div className="min-h-[480px] lg:min-h-0">
              <Feed flow={flow} index={index} investor={MAYA} policy={policy} agent={agent} resolution={resolution} onResolve={setResolution} />
            </div>
            <TwinPanel flow={flow} index={index} investor={MAYA} />
          </div>

          <AuditTrail flow={flow} index={index} agent={agent} resolution={resolution} />
        </main>
      ) : (
        <HowItWorks />
      )}

      <footer className="mx-auto max-w-[1680px] px-4 pb-6 text-center text-[11px] text-slate-400">
        Hackathon concept demo. Fictional investor, fictional tickers, simulated outcomes. Not financial advice, not an official product of any firm, and no real trades are executed.
        {view === 'demo' && <span className="ml-2 font-mono">← → step · 1 2 3 scenario · R restart</span>}
      </footer>
    </div>
  )
}
