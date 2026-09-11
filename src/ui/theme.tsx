import type { ReactNode } from 'react'
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react'
import type { CheckStatus, Decision } from '../engine/guard'

export const DECISION: Record<Decision, { label: string; hex: string; soft: string; text: string; border: string; blurb: string; next: string }> = {
  ALLOW: { label: 'ALLOW', hex: '#059669', soft: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', blurb: 'All required checks pass', next: 'Investor reviews and approves' },
  REVISE: { label: 'REVISE', hex: '#d97706', soft: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', blurb: 'Correctable failure', next: 'Feedback returns to the AI agent' },
  BLOCK: { label: 'BLOCK', hex: '#e11d48', soft: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', blurb: 'Clearly unauthorized or unsafe', next: 'Stop and explain' },
  HUMAN_REVIEW: { label: 'HUMAN REVIEW', hex: '#7c3aed', soft: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-300', blurb: 'Ambiguous or high-impact', next: 'Escalate to a person' },
}

export const STATUS_TEXT: Record<CheckStatus, string> = {
  pass: 'text-emerald-700',
  warn: 'text-amber-600',
  fail: 'text-rose-600',
}

export function StatusIcon({ s, size = 18 }: { s: CheckStatus; size?: number }) {
  if (s === 'pass') return <CircleCheck size={size} className="text-emerald-600 shrink-0" />
  if (s === 'warn') return <TriangleAlert size={size} className="text-amber-500 shrink-0" />
  return <CircleX size={size} className="text-rose-600 shrink-0" />
}

export function DecisionPill({ d, size = 'md' }: { d: Decision; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'px-3.5 py-1.5 text-base' : size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-sm'
  return (
    <span className={`inline-block rounded-lg font-bold tracking-wide text-white ${cls}`} style={{ background: DECISION[d].hex }}>
      {DECISION[d].label}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{children}</h3>
      {right}
    </div>
  )
}
