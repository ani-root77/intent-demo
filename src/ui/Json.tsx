import type { ReactNode } from 'react'

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b/g

/** Pretty JSON with light syntax colouring, for showing the machine-readable contracts. */
export function Json({ value, className = '' }: { value: unknown; className?: string }) {
  const text = JSON.stringify(value, null, 2)
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    if (m[1]) {
      out.push(
        <span key={at} className={m[2] ? 'text-teal-300' : 'text-amber-200'}>
          {m[1]}
        </span>,
      )
      if (m[2]) out.push(m[2])
    } else if (m[3]) {
      out.push(<span key={at} className="text-indigo-300">{m[3]}</span>)
    } else {
      out.push(<span key={at} className="text-rose-300">{m[4]}</span>)
    }
    last = at + m[0].length
  }
  out.push(text.slice(last))
  return (
    <pre className={`scroll-thin overflow-x-auto rounded-xl bg-slate-950 p-3 font-mono text-[11.5px] leading-relaxed text-slate-300 ${className}`}>
      {out}
    </pre>
  )
}
