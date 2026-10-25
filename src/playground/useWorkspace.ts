import { useCallback, useEffect, useRef, useState } from 'react'
import { apiHeaders, isTeam } from '../api'
import { DEFAULT_WORKSPACE, sanitizeWorkspace, type Workspace } from '../engine/config'

export type SaveState = 'loading' | 'saved' | 'saving' | 'unsaved' | 'error' | 'offline'

const KEY = 'intent-workspace'
/** How often an open page checks whether the team has changed the shared settings. */
const POLL_MS = 60_000

/** This browser's copy: the shared settings it was based on (`rev`), plus the visitor's own history. */
function readLocal(): { rev: number; ws: unknown } | null {
  try {
    const s = localStorage.getItem(KEY)
    if (!s) return null
    const v = JSON.parse(s) as { rev?: unknown; ws?: unknown }
    // A copy saved before settings were shared has no rev: it is replaced by the shared settings.
    return v && typeof v.rev === 'number' && v.ws ? { rev: v.rev, ws: v.ws } : { rev: -1, ws: v }
  } catch {
    return null
  }
}

function writeLocal(rev: number, ws: Workspace) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ rev, ws }))
    return true
  } catch {
    return false
  }
}

/**
 * The workspace everyone uses: the shared settings from the server (edited by the team in the Clario lab), plus each
 * visitor's own question history and risk-review results, kept in their browser. When the team saves new settings,
 * open pages pick them up within a minute.
 * `update` saves for everyone (team only, used by the lab); `updateLocal` changes only this browser (the portal).
 */
export function useWorkspace() {
  const [ws, setWs] = useState<Workspace>(() => sanitizeWorkspace(readLocal()?.ws ?? DEFAULT_WORKSPACE))
  const [state, setState] = useState<SaveState>('loading')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaded = useRef(false)
  const rev = useRef(readLocal()?.rev ?? -1)
  const dirty = useRef(false)

  const sync = useCallback(async (first: boolean) => {
    try {
      const r = await fetch('/api/workspace')
      if (!r.ok) throw new Error(String(r.status))
      const data = (await r.json()) as Record<string, unknown>
      const serverRev = typeof data.rev === 'number' ? data.rev : 0
      // Keep this browser's copy while it is based on the current settings; otherwise take the team's new settings.
      if (serverRev !== rev.current && !dirty.current) {
        const next = sanitizeWorkspace(data)
        rev.current = serverRev
        setWs(next)
        writeLocal(serverRev, next)
      }
      if (first) setState('saved')
    } catch {
      if (first) setState(readLocal() ? 'saved' : 'offline')
    } finally {
      loaded.current = true
    }
  }, [])

  useEffect(() => {
    void sync(true)
    const t = setInterval(() => void sync(false), POLL_MS)
    const onFocus = () => void sync(false)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [sync])

  const save = useCallback((next: Workspace) => {
    if (!isTeam()) {
      writeLocal(rev.current, next)
      dirty.current = false
      setState('saved')
      return
    }
    setState('saving')
    writeLocal(rev.current, next)
    fetch('/api/workspace', { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(next) })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status))
        const saved = (await r.json()) as { rev?: number }
        if (typeof saved.rev === 'number') rev.current = saved.rev
        writeLocal(rev.current, next)
        setState('saved')
      })
      .catch(() => setState('error'))
      .finally(() => {
        dirty.current = false
      })
  }, [])

  /** Applies a settings edit and saves it for everyone (team only). Values are sanitised so the engine never sees out-of-range input. */
  const update = useCallback(
    (fn: (w: Workspace) => Workspace) => {
      setWs((prev) => {
        const next = sanitizeWorkspace(fn(prev))
        if (loaded.current) {
          dirty.current = true
          setState('unsaved')
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => save(next), 700)
        }
        return next
      })
    },
    [save],
  )

  /** Applies a change for this browser only (question history, a risk review). */
  const updateLocal = useCallback((fn: (w: Workspace) => Workspace) => {
    setWs((prev) => {
      const next = sanitizeWorkspace(fn(prev))
      writeLocal(rev.current, next)
      return next
    })
  }, [])

  const replace = useCallback((raw: unknown) => update(() => sanitizeWorkspace(raw)), [update])

  return { ws, update, updateLocal, replace, state }
}
