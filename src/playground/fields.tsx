import { useEffect, useState, type ReactNode } from 'react'
import { motion, animate } from 'framer-motion'

export function Panel({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

/** Number input that accepts free typing and commits on blur/enter. `scale` shows e.g. 0.15 as 15. */
export function NumField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  prefix,
  suffix,
  scale = 1,
  hint,
  width = 'w-24',
}: {
  label?: ReactNode
  value: number
  onChange: (n: number) => void
  step?: number
  min?: number
  max?: number
  prefix?: string
  suffix?: string
  scale?: number
  hint?: string
  width?: string
}) {
  const shown = +(value * scale).toFixed(6)
  const [draft, setDraft] = useState(String(shown))
  useEffect(() => setDraft(String(shown)), [shown])
  const commit = () => {
    const n = Number(draft)
    if (draft.trim() !== '' && Number.isFinite(n)) onChange(n / scale)
    else setDraft(String(shown))
  }
  const input = (
    <span className="inline-flex items-center gap-1">
      {prefix && <span className="text-xs text-slate-400">{prefix}</span>}
      <input
        type="number"
        value={draft}
        step={step}
        min={min}
        max={max}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className={`${width} rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-right text-sm font-semibold tabular-nums focus:border-indigo-400 focus:bg-white focus:outline-none`}
      />
      {suffix && <span className="w-7 text-xs text-slate-400">{suffix}</span>}
    </span>
  )
  if (!label) return input
  return (
    <label className="flex items-center justify-between gap-2 py-0.5 text-sm" title={hint}>
      <span className="min-w-0 text-slate-600">{label}</span>
      {input}
    </label>
  )
}

export function TextField({ label, value, onChange, placeholder, rows, mono }: { label?: ReactNode; value: string; onChange: (s: string) => void; placeholder?: string; rows?: number; mono?: boolean }) {
  const cls = `w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none ${mono ? 'font-mono text-xs' : ''}`
  return (
    <label className="block space-y-1 text-sm">
      {label && <span className="text-slate-600">{label}</span>}
      {rows ? <textarea value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cls} /> : <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cls} />}
    </label>
  )
}

export function Select<T extends string>({ value, options, onChange, className = '' }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={`min-w-0 max-w-full rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-sm focus:border-indigo-400 focus:outline-none ${className}`}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Segmented<T extends string>({ value, options, onChange, size = 'sm' }: { value: T; options: { value: T; label: string; tone?: string }[]; onChange: (v: T) => void; size?: 'xs' | 'sm' }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`relative shrink-0 whitespace-nowrap rounded-md px-2 ${size === 'xs' ? 'py-0 text-[11px]' : 'py-0.5 text-xs'} font-semibold transition-colors ${value === o.value ? (o.tone ?? 'text-slate-900') : 'text-slate-500 hover:text-slate-800'}`}
        >
          {value === o.value && <span className="absolute inset-0 rounded-md bg-white shadow-sm" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Toggle({ label, value, onChange, hint }: { label: ReactNode; value: boolean; onChange: (b: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 py-0.5 text-sm" title={hint}>
      <span className="min-w-0 text-slate-600">{label}</span>
      <button onClick={() => onChange(!value)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${value ? 'bg-indigo-600' : 'bg-slate-300'}`}>
        <motion.span animate={{ x: value ? 16 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="absolute top-0.5 left-0 h-4 w-4 rounded-full bg-white shadow" />
      </button>
    </label>
  )
}

export function Btn({ children, onClick, tone = 'ghost', disabled, title }: { children: ReactNode; onClick: () => void; tone?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; title?: string }) {
  const cls =
    tone === 'primary'
      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
      : tone === 'danger'
        ? 'text-rose-600 hover:bg-rose-50 border border-rose-200'
        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
  return (
    <button title={title} onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  )
}

/** A number that animates to its new value. */
export function CountUp({ value, format, duration = 0.8 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    const ctl = animate(shown, value, { duration, ease: 'easeOut', onUpdate: setShown })
    return () => ctl.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])
  return <>{format(shown)}</>
}
