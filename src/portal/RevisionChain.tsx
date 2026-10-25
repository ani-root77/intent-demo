import { motion } from 'framer-motion'
import { ArrowRight, Loader2, RefreshCw, Siren } from 'lucide-react'
import type { Assessment, IntentVerdict, ReviseAttempt } from '../engine/advisory'
import { Json } from '../ui/Json'

/** The state of one answer's feedback loop. */
export interface LoopState {
  attempts: ReviseAttempt[]
  running: boolean
  done: boolean
  max: number
  error?: string
}

const SHORT: Record<IntentVerdict, { label: string; cls: string }> = {
  VERIFIED: { label: 'Verified', cls: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  CAUTION: { label: 'Use with caution', cls: 'border-amber-300 bg-amber-50 text-amber-800' },
  BLOCKED: { label: 'Blocked', cls: 'border-rose-400 bg-rose-50 text-rose-700' },
  UNVERIFIABLE: { label: 'Cannot verify', cls: 'border-violet-300 bg-violet-50 text-violet-800' },
  NO_ACTION: { label: 'No action', cls: 'border-sky-300 bg-sky-50 text-sky-800' },
}

/**
 * The feedback loop at a glance: each attempt with Clario's verdict, the feedback sent back
 * between attempts, and how the loop ended. Click an attempt to see its full report below.
 */
export function RevisionChain({ loop, chain, view, onView }: { loop: LoopState; chain: Assessment[]; view: number; onView: (i: number) => void }) {
  const last = chain[chain.length - 1]
  const passed = last && last.counts.fail === 0
  const exhausted = loop.done && !passed && !loop.error
  const fbIdx = Math.min(view, loop.attempts.length - 1)
  const feedback = loop.attempts[fbIdx]?.feedback
  return (
    <section className="rounded-2xl border border-indigo-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <RefreshCw size={15} className="text-indigo-500" />
        <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">Feedback loop</h3>
        <span className="text-xs text-slate-500">
          Answers that fail a check go back to the AI with Clario’s feedback, up to {loop.max} attempts. Clario reports what failed and the limits to meet; it never picks the investment.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chain.map((a, i) => {
          const s = SHORT[a.verdict]
          return (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-500">
                  <ArrowRight size={14} /> feedback <ArrowRight size={14} />
                </span>
              )}
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => onView(i)}
                className={`rounded-xl border-2 px-3 py-1.5 text-left ${s.cls} ${i === view ? 'ring-2 ring-indigo-300 ring-offset-1' : 'opacity-80 hover:opacity-100'}`}
              >
                <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70">Attempt {i + 1}</span>
                <span className="block text-sm font-bold">
                  {s.label} · {a.counts.pass}/{a.counts.active}
                </span>
              </motion.button>
            </div>
          )
        })}
        {loop.running && (
          <span className="flex items-center gap-2 text-sm text-indigo-600">
            <ArrowRight size={14} /> <Loader2 size={15} className="animate-spin" /> the AI is revising with Clario’s feedback…
          </span>
        )}
      </div>

      {loop.done && !loop.error && (
        <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${passed ? 'bg-emerald-50 text-emerald-900' : 'bg-violet-50 text-violet-900'}`}>
          {passed ? (
            chain.length === 1 ? (
              'The first answer already passed every check, so nothing needed revising.'
            ) : (
              <>
                After <b>{chain.length - 1}</b> revision{chain.length > 2 ? 's' : ''}, the AI’s answer passes every check. Showing the final answer below; click an earlier attempt to compare.
              </>
            )
          ) : exhausted ? (
            <span className="flex items-center gap-2">
              <Siren size={16} /> <b>Escalated to human review.</b> The AI could not produce an answer that passes in {loop.max} attempts. It is never approved automatically.
            </span>
          ) : null}
        </div>
      )}
      {loop.error && <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">The loop stopped: {loop.error}</div>}

      {feedback && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-indigo-700">Feedback Clario sent after attempt {fbIdx + 1}</summary>
          <div className="mt-2">
            <Json value={feedback} />
          </div>
        </details>
      )}
    </section>
  )
}
