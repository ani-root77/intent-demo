import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, Bot, Loader2, RefreshCw, Send, ShieldCheck, ShieldOff, Sparkles, X } from 'lucide-react'
import { accessRole, apiHeaders } from '../api'
import { FullscreenButton, useFullscreen } from '../fullscreen'
import { adviceFeedback, assess, attemptResult, needsRevision, readingOf, type AdviceResult, type IntentEdit, type ReviseAttempt } from '../engine/advisory'
import { RISK_PRESETS, type Profile, type RiskLevel, type Workspace } from '../engine/config'
import { usdShort } from '../engine/model'
import { DriftPanel } from './DriftPanel'
import { IntentReport } from './IntentReport'
import { RevisionChain, type LoopState } from './RevisionChain'

const EXAMPLES = ['Increase my AI exposure', 'Should I invest in SpaceX?', 'Should I buy more NVDA today?', 'Put 40% of my portfolio into Bitcoin', 'Make my portfolio safer']

interface Props {
  ws: Workspace
  update: (fn: (w: Workspace) => Workspace) => void
  profile: Profile
  onClose: () => void
}

function readToggle(key: string, def: boolean) {
  try {
    const v = localStorage.getItem(key)
    return v === null ? def : v === 'on'
  } catch {
    return def
  }
}
function writeToggle(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    /* ignore */
  }
}

export function AdvisoryOverlay({ ws, update, profile, onClose }: Props) {
  const [question, setQuestion] = useState('')
  const [intentOn, setIntentOn] = useState(() => readToggle('intent-toggle', true))
  // the feedback loop: when on, failed answers go back to the advisor with Clario's feedback
  const [reviseOn, setReviseOn] = useState(() => readToggle('clario-revise', false))
  const [loops, setLoops] = useState<Record<string, LoopState>>({})
  const [picked, setPicked] = useState<number | null>(null)
  // the investor's corrections to Clario's reading of each question (the final word on what they meant)
  const [edits, setEdits] = useState<Record<string, IntentEdit>>({})
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AdviceResult | null>(null)
  const [drift, setDrift] = useState<Record<string, 'accepted' | 'declined'>>({})
  const [undo, setUndo] = useState<Profile | null>(null)

  const [presenting] = useFullscreen()
  useEffect(() => writeToggle('intent-toggle', intentOn), [intentOn])
  useEffect(() => writeToggle('clario-revise', reviseOn), [reviseOn])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // The answer belongs to the profile that asked; switching profile clears it.
  const shown = result && result.profileId === profile.id ? result : null
  const edit = useMemo(() => (shown ? (edits[shown.id] ?? {}) : {}), [shown, edits])
  const setEdit = (e: IntentEdit) => shown && setEdits((m) => ({ ...m, [shown.id]: e }))
  const assessment = useMemo(() => (shown ? assess(shown, profile, ws, edit) : null), [shown, profile, ws, edit])
  // the verdict waits while the rules couldn't read the request and the investor hasn't confirmed
  const onHold = !!assessment && assessment.reading.needsConfirm && !assessment.reading.confirmed

  /** Runs the feedback loop for a result: revise while any check fails, up to the profile's attempt limit. */
  const runLoop = async (r: AdviceResult) => {
    const max = profile.policy.maxAttempts
    const attempts: ReviseAttempt[] = [{ advisor: r.advisor, calls: r.calls, ms: r.ms }]
    const put = (s: Partial<LoopState>) => setLoops((L) => ({ ...L, [r.id]: { attempts: [...attempts], running: true, done: false, max, ...s } }))
    put({})
    try {
      for (let i = 0; ; i++) {
        const a = assess(attemptResult(r, attempts[i]!, i), profile, ws, edits[r.id] ?? {})
        if (!needsRevision(a) || i + 1 >= max) break
        const feedback = adviceFeedback(a, r, profile, ws, i + 1, max)
        attempts[i] = { ...attempts[i]!, feedback }
        put({})
        const res = await fetch('/api/advise/revise', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ workspace: ws, profileId: profile.id, question: r.question, previous: attempts[i]!.advisor.answer, feedback }),
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
        attempts.push(body as ReviseAttempt)
        put({})
      }
      put({ running: false, done: true })
    } catch (e) {
      put({ running: false, done: true, error: (e as Error).message })
    }
  }

  // Start the loop when it is switched on, or when a new answer arrives while it is on.
  useEffect(() => {
    if (intentOn && reviseOn && shown && !onHold && !busyRef.current && !loops[shown.id]) void runLoop(shown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentOn, reviseOn, shown?.id, onHold])

  const loop = shown ? loops[shown.id] : undefined
  const looping = intentOn && reviseOn && !!loop
  const viewIdx = looping ? Math.min(picked ?? loop!.attempts.length - 1, loop!.attempts.length - 1) : 0
  const viewResult = useMemo(() => (shown && looping ? attemptResult(shown, loop!.attempts[viewIdx]!, viewIdx) : shown), [shown, looping, loop, viewIdx])
  const viewAssessment = useMemo(() => (viewResult && looping ? assess(viewResult, profile, ws, edit) : assessment), [viewResult, looping, profile, ws, assessment, edit])
  const chain = useMemo(() => (shown && looping ? loop!.attempts.map((x, i) => assess(attemptResult(shown, x, i), profile, ws, edit)) : []), [shown, looping, loop, profile, ws, edit])

  const ask = async (q = question) => {
    if (!q.trim() || busy) return
    setQuestion(q)
    setBusy(true)
    setError(null)
    setResult(null)
    setUndo(null)
    setPicked(null)
    busyRef.current = true
    try {
      const res = await fetch('/api/advise', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ workspace: ws, profileId: profile.id, question: q }) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      const r = body as AdviceResult
      setResult(r)
      const rd = readingOf(r.question, profile, ws)
      // Remember the request for intent-drift detection (not a conversation: answers stay independent).
      update((w) => ({
        ...w,
        profiles: w.profiles.map((p) => (p.id === r.profileId ? { ...p, history: [...p.history, { at: r.at, text: r.question, objective: rd.objective, lean: rd.lean }].slice(-20) } : p)),
      }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  /** Applies the outcome of the risk review (never the request's implied risk directly). */
  const applyReview = (level: RiskLevel, goalChanged: boolean) => {
    if (!shown) return
    setUndo(structuredClone(profile))
    update((w) => ({
      ...w,
      profiles: w.profiles.map((p) =>
        p.id === profile.id
          ? { ...p, investor: { ...p.investor, riskProfile: level, preference: goalChanged ? shown.question : p.investor.preference }, policy: { ...RISK_PRESETS[level], blockFailSharePct: p.policy.blockFailSharePct } }
          : p,
      ),
    }))
    setDrift((s) => ({ ...s, [shown.id]: 'accepted' }))
  }
  const undoDrift = () => {
    if (!undo) return
    const prev = undo
    update((w) => ({ ...w, profiles: w.profiles.map((p) => (p.id === prev.id ? { ...prev, history: p.history } : p)) }))
    setUndo(null)
    if (shown) setDrift((s) => ({ ...s, [shown.id]: 'declined' }))
  }

  const showDrift = !!intentOn && shown && !onHold && assessment?.drift.detected && !drift[shown.id]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm sm:p-3 md:p-6" onClick={onClose}>
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-full flex-col overflow-hidden bg-slate-50 shadow-2xl sm:rounded-2xl"
      >
        {/* Header */}
        <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <Sparkles size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900">AI Advisory</h2>
              <p className="hidden text-xs text-slate-500 sm:block">Ask for a suggestion or for advice. Every question is answered on its own, using your profile and today’s market.</p>
            </div>
            <div className="hidden items-center gap-3 lg:flex">
              {intentOn && <ReviseToggle on={reviseOn} onChange={setReviseOn} />}
              <IntentToggle on={intentOn} onChange={setIntentOn} />
            </div>
            <FullscreenButton compact />
            <button onClick={onClose} title="Close (Esc)" aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
          {/* phones and tablets: the toggles get their own row */}
          <div className={`mt-3 grid gap-2 lg:hidden ${intentOn ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <IntentToggle on={intentOn} onChange={setIntentOn} compact />
            {intentOn && <ReviseToggle on={reviseOn} onChange={setReviseOn} compact />}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className={`mx-auto max-w-[1300px] space-y-4 px-4 py-4 transition-[padding] sm:space-y-5 sm:px-6 sm:py-5 ${showDrift ? 'xl:pr-[410px]' : ''}`}>
            {/* Who is being advised */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              {/* The team badge stays off screen while presenting in full screen. */}
              {accessRole() && !(accessRole() === 'team' && presenting) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800" title="Your questions skip the public limits">
                  <BadgeCheck size={12} /> {accessRole() === 'team' ? 'Team · Cupcakes' : 'Judge lane'}
                </span>
              )}
              <span>
                Advising <b className="text-slate-800">{profile.investor.name}</b>, {profile.investor.age}
              </span>
              <span>
                Risk profile <b className="text-slate-800">{profile.investor.riskProfile}</b>
              </span>
              <span>
                Goal <b className="text-slate-800">{usdShort(profile.investor.target)}</b> by {profile.investor.retireAge}
              </span>
              {profile.investor.preference && (
                <span>
                  Preference <b className="text-slate-800">“{profile.investor.preference}”</b>
                </span>
              )}
            </div>

            {/* Question */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="flex gap-2 sm:gap-3">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      ask()
                    }
                  }}
                  rows={2}
                  maxLength={500}
                  placeholder="e.g. “Increase my AI exposure” or “Should I invest in SpaceX?”"
                  className="min-w-0 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[15px] focus:border-indigo-400 focus:bg-white focus:outline-none"
                />
                <button onClick={() => ask()} disabled={busy || !question.trim()} className="inline-flex shrink-0 items-center gap-2 self-stretch rounded-xl bg-indigo-600 px-4 text-sm font-semibold sm:px-5 text-white hover:bg-indigo-700 disabled:opacity-40">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Ask
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Try:</span>
                {EXAMPLES.map((q) => (
                  <button key={q} onClick={() => ask(q)} disabled={busy} className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-40">
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
            {busy && <Working intentOn={intentOn} ws={ws} />}

            {shown && assessment && !busy && (
              <AnimatePresence mode="wait">
                {intentOn ? (
                  <motion.div key="on" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                    {looping && !onHold && <RevisionChain loop={loop!} chain={chain} view={viewIdx} onView={setPicked} />}
                    <IntentReport
                      result={viewResult ?? shown}
                      a={viewAssessment ?? assessment}
                      profile={profile}
                      ws={ws}
                      edit={edit}
                      onEdit={setEdit}
                      driftNote={drift[shown.id] === 'accepted' ? { onUndo: undo ? undoDrift : undefined } : undefined}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <RawAnswer result={shown} />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showDrift && shown && assessment && (
            <DriftPanel key={shown.id} drift={assessment.drift} profile={profile} restated={shown.question} onApply={applyReview} onDecline={() => setDrift((s) => ({ ...s, [shown.id]: 'declined' }))} />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

function ReviseToggle({ on, onChange, compact }: { on: boolean; onChange: (b: boolean) => void; compact?: boolean }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-1.5 transition-colors ${compact ? 'w-full min-w-0 justify-between gap-2 px-2.5' : ''} ${on ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 bg-slate-100'}`}
      title="When on, an answer that fails a Clario check goes back to the AI with Clario's feedback, until it passes or the attempt limit is reached"
    >
      <RefreshCw size={17} className={on ? 'text-indigo-600' : 'text-slate-400'} />
      <span className="text-left">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{compact ? 'Revise' : 'Revise answers'}</span>
        <span className={`block font-bold ${compact ? 'text-xs' : 'text-sm'} ${on ? 'text-indigo-700' : 'text-slate-500'}`}>{compact ? (on ? 'On' : 'Off') : on ? 'On · feedback loop' : 'Off · single answer'}</span>
      </span>
      <span className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-indigo-500' : 'bg-slate-300'}`}>
        <motion.span animate={{ x: on ? 22 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="absolute top-1 left-0 h-4 w-4 rounded-full bg-white shadow" />
      </span>
    </button>
  )
}

function IntentToggle({ on, onChange, compact }: { on: boolean; onChange: (b: boolean) => void; compact?: boolean }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-1.5 transition-colors ${compact ? 'w-full min-w-0 justify-between gap-2 px-2.5' : ''} ${on ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-slate-100'}`}
      title="Turn Clario verification on or off"
    >
      {on ? <ShieldCheck size={18} className="text-emerald-600" /> : <ShieldOff size={18} className="text-slate-400" />}
      <span className="text-left">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Clario</span>
        <span className={`block font-bold ${compact ? 'text-xs' : 'text-sm'} ${on ? 'text-emerald-700' : 'text-slate-500'}`}>{on ? (compact ? 'On' : 'On · verified') : compact ? 'Off · raw' : 'Off · raw AI'}</span>
      </span>
      <span className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <motion.span animate={{ x: on ? 22 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="absolute top-1 left-0 h-4 w-4 rounded-full bg-white shadow" />
      </span>
    </button>
  )
}

function Working({ intentOn, ws }: { intentOn: boolean; ws: Workspace }) {
  const steps = intentOn
    ? ['Asking the AI advisor', 'Reading your request (Clario rules, no AI)', `Checking the answer against your limits`, `Simulating ${ws.twin.paths.toLocaleString()} market scenarios`, 'Comparing similar investors (synthetic cohort)']
    : ['Asking the AI advisor']
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {steps.map((s, k) => (
        <motion.div key={s} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.35 }} className="flex items-center gap-2 py-1 text-sm text-slate-600">
          <Loader2 size={14} className="animate-spin text-indigo-500" /> {s}…
        </motion.div>
      ))}
    </div>
  )
}

/** Clario off: the advisor's answer exactly as written, with nothing added. */
function RawAnswer({ result }: { result: AdviceResult }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-100 text-indigo-700">
          <Bot size={17} />
        </span>
        AI Advisor
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{result.advisor.answer}</p>
    </div>
  )
}
