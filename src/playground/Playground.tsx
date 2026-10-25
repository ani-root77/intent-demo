import { useState } from 'react'
import { motion } from 'framer-motion'
import { CircleCheck, CloudOff, FlaskConical, Loader2, Settings2, Users } from 'lucide-react'
import { ProfilesPane } from './ProfilesPane'
import { SettingsPane } from './SettingsPane'
import { TestPane } from './TestPane'
import type { Workspace } from '../engine/config'
import type { SaveState } from './useWorkspace'

type Tab = 'test' | 'profiles' | 'settings'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'test', label: 'Test', icon: <FlaskConical size={14} /> },
  { id: 'profiles', label: 'Customer profiles', icon: <Users size={14} /> },
  { id: 'settings', label: 'Settings', icon: <Settings2 size={14} /> },
]

interface Props {
  ws: Workspace
  update: (fn: (w: Workspace) => Workspace) => void
  replace: (raw: unknown) => void
  state: SaveState
  profileId: string
  setProfileId: (id: string) => void
}

export function Playground({ ws, update, replace, state, profileId, setProfileId }: Props) {
  const [tab, setTab] = useState<Tab>('test')
  const profile = ws.profiles.find((p) => p.id === profileId) ?? ws.profiles[0]

  const profileSelect = (
    <select value={profile.id} onChange={(e) => setProfileId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold">
      {ws.profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.investor.name} · {p.investor.riskProfile}
        </option>
      ))}
    </select>
  )

  return (
    <main className="mx-auto max-w-[1680px] space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t.id ? 'text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {tab === t.id && <motion.span layoutId="pg-tab" className="absolute inset-0 rounded-lg bg-slate-900" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <span className="relative inline-flex items-center gap-1.5">
                {t.icon}
                {t.label}
              </span>
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500">Every number here is editable. Change a profile or a setting, then test it live or in the sandbox.</p>
        <SaveBadge state={state} />
      </div>

      {tab === 'test' && <TestPane ws={ws} profile={profile} profileSelect={profileSelect} />}
      {tab === 'profiles' && <ProfilesPane ws={ws} update={update} selectedId={profile.id} onSelect={setProfileId} />}
      {tab === 'settings' && <SettingsPane ws={ws} update={update} replace={replace} />}
    </main>
  )
}

function SaveBadge({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; cls: string; icon: React.ReactNode }> = {
    loading: { text: 'Loading…', cls: 'text-slate-400', icon: <Loader2 size={12} className="animate-spin" /> },
    saved: { text: 'Saved', cls: 'text-emerald-600', icon: <CircleCheck size={12} /> },
    saving: { text: 'Saving…', cls: 'text-slate-500', icon: <Loader2 size={12} className="animate-spin" /> },
    unsaved: { text: 'Unsaved changes', cls: 'text-amber-600', icon: <Loader2 size={12} className="animate-spin" /> },
    error: { text: 'Save failed', cls: 'text-rose-600', icon: <CloudOff size={12} /> },
    offline: { text: 'Server offline: changes are not saved', cls: 'text-rose-600', icon: <CloudOff size={12} /> },
  }
  const s = map[state]
  return <span className={`ml-auto inline-flex items-center gap-1 text-xs font-semibold ${s.cls}`}>{s.icon} {s.text}</span>
}
