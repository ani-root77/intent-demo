import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, ChevronDown, ChevronUp, ClipboardCheck, Compass } from 'lucide-react'
import type { Drift } from '../engine/advisory'
import { RISK_PRESETS, type Profile, type RiskLevel } from '../engine/config'
import { usd } from '../engine/model'

const LEAN_TEXT: Record<string, string> = {
  very_conservative: 'very cautious',
  conservative: 'cautious',
  moderate: 'moderate',
  aggressive: 'higher-risk',
  very_aggressive: 'very high-risk',
  neutral: 'neutral',
}

/** A short risk review. Each answer scores -1 (more cautious), 0 or +1 (more risk). */
const QUESTIONS: { id: string; q: string; options: { label: string; score: number }[] }[] = [
  {
    id: 'goal',
    q: 'Has your investing goal changed?',
    options: [
      { label: 'No, same goal as before', score: 0 },
      { label: 'Yes, I want more growth', score: 1 },
      { label: 'Yes, I want more safety', score: -1 },
    ],
  },
  {
    id: 'loss',
    q: 'If your portfolio fell 25% in a year, you would most likely…',
    options: [
      { label: 'Sell to stop further losses', score: -1 },
      { label: 'Hold and wait', score: 0 },
      { label: 'Buy more at lower prices', score: 1 },
    ],
  },
  {
    id: 'horizon',
    q: 'When will you need most of this money?',
    options: [
      { label: 'Within 5 years', score: -1 },
      { label: 'In 5 to 15 years', score: 0 },
      { label: 'More than 15 years from now', score: 1 },
    ],
  },
]

/** Total score → risk level. Deterministic, no AI. */
const levelFor = (score: number): RiskLevel => (score <= -2 ? 'Conservative' : score >= 2 ? 'Aggressive' : 'Moderate')

interface Props {
  drift: Drift
  profile: Profile
  restated: string
  /** Called only after the investor completes the review and explicitly applies the result. */
  onApply: (level: RiskLevel, goalChanged: boolean) => void
  onDecline: () => void
}

/** Side panel shown when a request doesn't match the investor's saved profile. */
export function DriftPanel({ drift, profile, restated, onApply, onDecline }: Props) {
  const [stage, setStage] = useState<'notice' | 'review' | 'result'>('notice')
  const [answers, setAnswers] = useState<Record<string, number>>({})
  // On phones the panel starts as a small bar so it doesn't cover the report.
  const [min, setMin] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches)
  const complete = QUESTIONS.every((q) => q.id in answers)
  const score = QUESTIONS.reduce((s, q) => s + (answers[q.id] ?? 0), 0)
  const level = levelFor(score)
  const current = profile.investor.riskProfile
  const same = level.toLowerCase() === current.toLowerCase()
  const goalChanged = (answers.goal ?? 0) !== 0

  const next = RISK_PRESETS[level]
  const cur = profile.policy
  const changes: [string, string, string][] = [
    ['Risk profile', current, level],
    ['Max single stock', `${cur.maxSingleStockPct}%`, `${next.maxSingleStockPct}%`],
    ['Max technology', `${cur.maxSectorPct}%`, `${next.maxSectorPct}%`],
    ['Min cash buffer', usd(cur.minCash), usd(next.minCash)],
    ['Max equity', `${cur.maxEquityPct}%`, `${next.maxEquityPct}%`],
    ['Max volatility', `${cur.maxVolPct}%`, `${next.maxVolPct}%`],
  ]

  if (min)
    return (
      <motion.button
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        onClick={() => setMin(false)}
        className="fixed inset-x-3 bottom-3 z-[60] flex items-center gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-left shadow-xl"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
          <Compass size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-700">Clario · possible change in goals</span>
          <span className="block truncate text-sm font-semibold text-slate-900">Has your investing goal changed?</span>
        </span>
        <ChevronUp size={18} className="shrink-0 text-amber-700" />
      </motion.button>
    )

  return (
    <motion.aside
      initial={{ x: 420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 420, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[85vh] flex-col overflow-y-auto rounded-t-2xl border border-amber-200 bg-white p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:top-20 sm:right-4 sm:bottom-4 sm:z-10 sm:max-h-none sm:w-[380px] sm:max-w-[calc(100%-2rem)] sm:rounded-2xl sm:p-5"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700">{stage === 'notice' ? <Compass size={19} /> : <ClipboardCheck size={19} />}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Clario · possible change in goals</div>
          <h3 className="text-base font-bold text-slate-900">{stage === 'notice' ? 'Has your investing goal changed?' : stage === 'review' ? 'Quick risk review' : 'Your review result'}</h3>
        </div>
        <button onClick={() => setMin(true)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 sm:hidden" aria-label="Minimise">
          <ChevronDown size={18} />
        </button>
      </div>

      {stage === 'notice' && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            This request points to a <b>{LEAN_TEXT[drift.requestLean]}</b> approach, but your profile is set to <b>{current}</b>
            {profile.investor.preference ? (
              <>
                {' '}
                with the goal “<i>{profile.investor.preference}</i>”
              </>
            ) : null}
            .
            {drift.recentSimilar > 0 && (
              <>
                {' '}
                {drift.recentSimilar} of your last {drift.recentTotal} requests also leaned {drift.direction === 'riskier' ? 'riskier' : 'safer'} than your profile.
              </>
            )}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            One request isn’t enough to change your risk profile. If your situation has changed, a short risk review (3 questions) will check whether your profile should change. Until then, advice is judged against your current profile.
          </p>
          <div className="mt-4 space-y-2">
            <button onClick={() => setStage('review')} className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
              Yes, start a risk review
            </button>
            <button onClick={onDecline} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              No, keep my current profile
            </button>
          </div>
        </>
      )}

      {stage === 'review' && (
        <>
          <div className="mt-3 space-y-4">
            {QUESTIONS.map((q, k) => (
              <div key={q.id}>
                <div className="mb-1.5 text-sm font-semibold text-slate-800">
                  {k + 1}. {q.q}
                </div>
                <div className="space-y-1">
                  {q.options.map((o) => {
                    const on = answers[q.id] === o.score
                    return (
                      <button
                        key={o.label}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.score }))}
                        className={`w-full rounded-lg border px-3 py-1.5 text-left text-sm ${on ? 'border-indigo-400 bg-indigo-50 font-semibold text-indigo-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <button onClick={() => setStage('result')} disabled={!complete} className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
              See my result
            </button>
            <button onClick={onDecline} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancel, keep my current profile
            </button>
          </div>
        </>
      )}

      {stage === 'result' && (
        <>
          {same ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Your answers match your current <b>{current}</b> profile, so nothing changes. Clario will keep judging advice against it, including this answer.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Based on your answers, a <b>{level}</b> profile fits you better than <b>{current}</b>. Review what would change, then decide.
            </p>
          )}
          {!same && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">What would change</div>
              {goalChanged && (
                <div className="mb-2 text-sm">
                  <div className="text-slate-500">Stated goal</div>
                  <div className="font-medium text-slate-800">“{restated}”</div>
                </div>
              )}
              <table className="w-full text-sm">
                <tbody>
                  {changes.map(([k, a, b]) => (
                    <tr key={k} className="border-t border-slate-200">
                      <td className="py-1 text-slate-500">{k}</td>
                      <td className="py-1 text-right tabular-nums text-slate-500">{a}</td>
                      <td className="px-1 py-1 text-slate-300">
                        <ArrowRight size={12} />
                      </td>
                      <td className={`py-1 text-right font-semibold tabular-nums ${a === b ? 'text-slate-500' : 'text-slate-900'}`}>{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {same ? (
              <button onClick={onDecline} className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                Done
              </button>
            ) : (
              <>
                <button onClick={() => onApply(level, goalChanged)} className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                  Apply {level} profile
                </button>
                <button onClick={onDecline} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Keep my current profile
                </button>
              </>
            )}
            {stage === 'result' && (
              <button onClick={() => setStage('review')} className="w-full text-xs font-semibold text-slate-500 hover:text-slate-800">
                Change my answers
              </button>
            )}
          </div>
        </>
      )}

      <p className="mt-3 text-[11px] text-slate-400">
        Clario noticed this by comparing the risk your request implies with the risk level you saved ({drift.source === 'you' ? 'the risk level you set' : 'read by its fixed rules, no AI'}). Your profile only changes if you complete the review and apply the result.
      </p>
    </motion.aside>
  )
}
