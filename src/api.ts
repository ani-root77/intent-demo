// Headers for the server routes: an anonymous id for this browser (so the demo's request limits are per visitor,
// not per Wi-Fi network) and this browser's access code, if it has one. A judge code skips the public limits; the
// team (Cupcakes) code also opens the Clario lab and lets its settings changes apply to everyone.

export type Role = 'judge' | 'team'

const get = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const put = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* private mode: the value lasts for this page only */
  }
}

let session = ''
function clientId() {
  const saved = get('clario-client')
  if (saved) return saved
  session ||= (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9-]/g, '')
  put('clario-client', session)
  return session
}

/** The stored access code. A code saved before roles existed was a judge code. */
export const accessCode = () => get('clario-code') ?? get('clario-judge') ?? ''
export const accessRole = (): Role | null => {
  const r = get('clario-role')
  return r === 'team' || r === 'judge' ? r : get('clario-judge') ? 'judge' : null
}
export const isTeam = () => accessRole() === 'team'

export function setAccess(code: string | null, role: Role | null) {
  put('clario-code', code)
  put('clario-role', role)
  put('clario-judge', null)
}

export function apiHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json', 'x-clario-client': clientId() }
  const c = accessCode()
  if (c) h['x-clario-code'] = c
  return h
}

/** Checks an access code with the server. */
export async function checkCode(code: string): Promise<{ ok: boolean; role?: Role; error?: string }> {
  try {
    const res = await fetch('/api/code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
    const body = await res.json().catch(() => ({}))
    return res.ok ? { ok: true, role: body.role === 'team' ? 'team' : 'judge' } : { ok: false, error: body.error ?? 'That code could not be checked.' }
  } catch {
    return { ok: false, error: 'Could not reach the server to check the code.' }
  }
}
