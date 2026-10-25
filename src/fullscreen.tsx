import { useEffect, useState } from 'react'
import { Maximize, Minimize } from 'lucide-react'

/** Full-screen mode for presenting: hides the browser's address bar and tabs until it is switched off (or Esc). */
export function useFullscreen(): [boolean, () => void] {
  const [on, setOn] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement)
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  const toggle = () => {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
    p?.catch(() => {
      /* the browser refused (e.g. inside an embedded frame); nothing to do */
    })
  }
  return [on, toggle]
}

export function FullscreenButton({ compact = false }: { compact?: boolean }) {
  const [on, toggle] = useFullscreen()
  if (typeof document !== 'undefined' && !document.fullscreenEnabled) return null
  const label = on ? 'Exit full screen' : 'Full screen'
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        toggle()
      }}
      title={`${label}${on ? ' (Esc)' : ''}`}
      aria-label={label}
      className={compact ? 'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100' : 'inline-flex items-center gap-1 hover:text-slate-900 hover:underline'}
    >
      {on ? <Minimize size={compact ? 17 : 14} /> : <Maximize size={compact ? 17 : 14} />}
      {!compact && <span className="hidden sm:inline">{label}</span>}
    </button>
  )
}
