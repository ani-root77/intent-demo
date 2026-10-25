import { useState } from 'react'
import { BadgeCheck, LogIn, UserRound } from 'lucide-react'
import { accessRole, checkCode, setAccess, type Role } from '../api'
import type { Workspace } from '../engine/config'
import { total, usdShort } from '../engine/model'

/** Demo password for every mock profile. This is a mock sign-in: nothing is authenticated. */
export const DEMO_PASSWORD = 'demo'

export function Login({ ws, onLogin }: { ws: Workspace; onLogin: (profileId: string) => void }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [role, setRole] = useState<Role | null>(() => accessRole())
  const [checking, setChecking] = useState(false)

  const submit = async () => {
    const p = ws.profiles.find((x) => x.id.toLowerCase() === user.trim().toLowerCase())
    if (!p || pass !== DEMO_PASSWORD) {
      setError('Unknown demo username or password. Pick a demo account below.')
      return
    }
    if (code.trim()) {
      setChecking(true)
      const r = await checkCode(code.trim())
      setChecking(false)
      if (!r.ok || !r.role) {
        setError(r.error ?? 'That code is not right.')
        return
      }
      setAccess(code.trim(), r.role)
      setRole(r.role)
    }
    onLogin(p.id)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-6 py-4 text-xl font-extrabold tracking-tight text-slate-900">Investor Portal</div>
      </header>
      <div className="mx-auto grid max-w-[1100px] gap-8 px-6 py-10 lg:grid-cols-[380px_minmax(0,1fr)]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h1 className="text-2xl font-semibold text-slate-900">Log in</h1>
          <p className="mt-1 text-xs text-slate-500">Mock sign-in for the proof of concept. Use a demo account; no real credentials.</p>
          <label className="mt-5 block text-sm">
            <span className="text-slate-600">Username</span>
            <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none" placeholder="e.g. maya" />
          </label>
          <label className="mt-3 block text-sm">
            <span className="text-slate-600">Password</span>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none" placeholder={DEMO_PASSWORD} />
          </label>
          {role ? (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <BadgeCheck size={15} /> {role === 'team' ? 'Team access (Cupcakes) is on for this browser.' : 'Judge lane is on for this browser.'}
              <button
                type="button"
                onClick={() => {
                  setAccess(null, null)
                  setRole(null)
                }}
                className="ml-auto text-xs font-semibold text-emerald-700 underline"
              >
                Turn off
              </button>
            </p>
          ) : (
            <label className="mt-3 block text-sm">
              <span className="text-slate-600">Judge or team code (optional)</span>
              <input id="access-code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 uppercase focus:border-indigo-500 focus:outline-none" placeholder="Leave empty if you don't have one" />
            </label>
          )}
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          <button type="submit" disabled={checking} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60">
            <LogIn size={16} /> {checking ? 'Checking the code…' : 'Log in'}
          </button>
          <p className="mt-3 text-[11px] text-slate-400">
            Every demo account uses the password <code className="rounded bg-slate-100 px-1">{DEMO_PASSWORD}</code>.
          </p>
        </form>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-500">Demo accounts</h2>
          <p className="mt-1 text-xs text-slate-500">Click one to fill in the form. Profiles are edited in the Clario lab, and new ones appear here automatically.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ws.profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setUser(p.id)
                  setPass(DEMO_PASSWORD)
                  setError('')
                }}
                onDoubleClick={() => onLogin(p.id)}
                className={`rounded-xl border bg-white p-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40 ${user === p.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-sm font-bold text-white">{p.investor.name.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {p.investor.name}, {p.investor.age} · {p.investor.riskProfile}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      <UserRound size={10} className="mr-0.5 inline" />
                      <code>{p.id}</code> / <code>{DEMO_PASSWORD}</code> · {usdShort(total(p.investor.portfolio))} · goal {usdShort(p.investor.target)} by {p.investor.retireAge}
                    </div>
                  </div>
                </div>
                {p.notes && <p className="mt-2 text-xs text-slate-600">{p.notes}</p>}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
