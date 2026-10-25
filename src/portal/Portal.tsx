import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeftRight, Bell, Clapperboard, CalendarClock, ChevronDown, ChevronUp, CircleHelp, CircleUserRound, FlaskConical, Info, Lightbulb, MessageSquare, Receipt, RefreshCw, Search, Sparkles, TrendingDown, TrendingUp, UserRound } from 'lucide-react'
import type { Profile, Workspace } from '../engine/config'
import { total, usd } from '../engine/model'
import { isTeam } from '../api'
import { FullscreenButton } from '../fullscreen'
import { AdvisoryOverlay } from './AdvisoryOverlay'
import { accountsOf, balanceHistory, dayChangeOf, sparkline } from './data'

interface Props {
  ws: Workspace
  update: (fn: (w: Workspace) => Workspace) => void
  profileId: string
  onProfile: (id: string) => void
  /** Only given to the team: the Clario lab is hidden from everyone else. */
  onOpenLab?: () => void
  onLogout: () => void
}

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const signed = (n: number) => `${n >= 0 ? '+' : '-'}${money(Math.abs(n))}`
const pctS = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const tone = (n: number) => (n >= 0 ? 'text-emerald-700' : 'text-rose-600')

export function Portal({ ws, update, profileId, onProfile, onOpenLab, onLogout }: Props) {
  const profile = ws.profiles.find((p) => p.id === profileId) ?? ws.profiles[0]
  const [tab, setTab] = useState<'summary' | 'positions'>('summary')
  const [advisory, setAdvisory] = useState(false)
  const [menu, setMenu] = useState(false)

  /** Team only: back to a clean starting point for the live demo (shared settings, no local history, Clario off). */
  const resetForStage = () => {
    try {
      localStorage.removeItem('intent-workspace')
      localStorage.setItem('intent-toggle', 'off')
      localStorage.setItem('clario-revise', 'off')
    } catch {
      /* ignore */
    }
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Top bar */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 pt-3 sm:gap-6 sm:px-6 sm:pt-4">
          <div className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">Investor Portal</div>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-600 sm:gap-4">
            <span className="hidden md:inline">Open an Account</span>
            <span className="hidden md:inline">Assistant</span>
            <CircleHelp size={16} className="hidden md:block" />
            <div className="relative">
              <button onClick={() => setMenu(!menu)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 hover:bg-slate-50">
                <CircleUserRound size={16} /> {profile.investor.name} <ChevronDown size={12} />
              </button>
              {menu && (
                <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Signed in as (demo)</div>
                  {ws.profiles.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onProfile(p.id)
                        setMenu(false)
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50 ${p.id === profile.id ? 'font-semibold text-indigo-700' : ''}`}
                    >
                      <UserRound size={14} /> {p.investor.name}, {p.investor.age} · {p.investor.riskProfile}
                    </button>
                  ))}
                  {onOpenLab && (
                    <>
                      <div className="my-1 border-t border-slate-100" />
                      <button onClick={onOpenLab} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50">
                        <FlaskConical size={14} /> Clario lab (profiles, settings, demo)
                      </button>
                    </>
                  )}
                  {isTeam() && (
                    <button
                      onClick={resetForStage}
                      title="Clears this browser's question history and risk-review changes, and turns Clario and Revise answers off"
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
                    >
                      <Clapperboard size={14} /> Reset demo
                    </button>
                  )}
                </div>
              )}
            </div>
            <FullscreenButton />
            <button onClick={onLogout} className="hover:text-slate-900 hover:underline">
              Log Out
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:gap-6">
          <nav className="-mx-4 flex gap-5 overflow-x-auto whitespace-nowrap px-4 text-sm text-slate-700 md:mx-0 md:gap-6 md:px-0">
            {['Accounts & Trade', 'Planning', 'News & Research', 'Products & Services'].map((n) => (
              <span key={n} className="shrink-0 cursor-default hover:text-slate-950">
                {n}
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-2 md:ml-auto">
            <label className="flex w-full items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-400 md:w-72">
              <Search size={14} /> How can we help?
            </label>
            <MessageSquare size={18} className="hidden shrink-0 text-slate-500 sm:block" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
        {/* Actions */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0">
          {[
            ['Trade', <ArrowLeftRight key="t" size={14} />],
            ['Transfer', <RefreshCw key="r" size={14} />],
            ['Automate', <CalendarClock key="a" size={14} />],
            ['Pay Bills', <Receipt key="p" size={14} />],
            ['Quote', <Search key="q" size={14} />],
          ].map(([l, i]) => (
            <button key={l as string} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-300 px-3.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              {i} {l}
            </button>
          ))}
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <span className="hidden items-center gap-1 text-xs text-slate-500 md:inline-flex">
              <Bell size={14} /> Messages
            </span>
            <button className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 lg:flex-none lg:px-3.5">
              <UserRound size={15} /> Contact your team <ChevronDown size={14} />
            </button>
            <button
              onClick={() => setAdvisory(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700 lg:flex-none"
            >
              <Sparkles size={15} /> AI advisory
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <AccountsSidebar profile={profile} ws={ws} />
          <main className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">All accounts</h1>
            <div className="-mx-4 mt-3 flex gap-6 overflow-x-auto whitespace-nowrap border-b border-slate-200 px-4 text-sm sm:mx-0 sm:px-0">
              {(
                [
                  ['summary', 'Summary'],
                  ['positions', 'Positions'],
                ] as const
              ).map(([id, l]) => (
                <button key={id} onClick={() => setTab(id)} className={`-mb-px shrink-0 border-b-2 pb-2 ${tab === id ? 'border-indigo-700 font-semibold text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
                  {l}
                </button>
              ))}
              {['Activity & Orders', 'Balances', 'Documents', 'Planning', 'More (5)'].map((l) => (
                <span key={l} className="shrink-0 pb-2 text-slate-500">
                  {l}
                </span>
              ))}
            </div>
            {tab === 'summary' ? <Summary profile={profile} ws={ws} /> : <Positions profile={profile} ws={ws} />}
          </main>
        </div>
        <p className="mt-8 mb-16 text-center text-[11px] text-slate-400 sm:mb-0">Mock investor portal for a proof of concept. Fictional accounts and people, illustrative prices and simulated market data. No real trades are executed.</p>
      </div>

      {!advisory && (
        <button
          onClick={() => setAdvisory(true)}
          className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-indigo-300 sm:hidden"
        >
          <Sparkles size={16} /> AI advisory
        </button>
      )}
      {advisory && <AdvisoryOverlay ws={ws} update={update} profile={profile} onClose={() => setAdvisory(false)} />}
    </div>
  )
}

function AccountsSidebar({ profile, ws }: { profile: Profile; ws: Workspace }) {
  const accounts = accountsOf(profile, ws)
  const tot = total(profile.investor.portfolio)
  return (
    <aside className="h-fit rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-900">Accounts</div>
          <div className="text-[11px] text-slate-500">As of {ws.market.asOf}</div>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-slate-300 p-3">
        <div className="flex justify-between text-sm font-semibold">
          <span>All accounts</span>
          <span className="tabular-nums">{money(tot)}</span>
        </div>
        <div className="text-[11px] text-slate-500">{money(tot)} in brokerage accounts</div>
      </div>
      <div className="mt-4 flex justify-between text-sm font-semibold">
        <span>Investment</span>
        <span className="tabular-nums">{money(tot)}</span>
      </div>
      <ul className="mt-2 space-y-3">
        {accounts.map((a) => (
          <li key={a.id} className="flex justify-between gap-2 text-sm">
            <div>
              <div className="text-slate-700">{a.name}</div>
              <div className="text-[11px] text-slate-400">{a.number}</div>
            </div>
            <div className="text-right">
              <div className="tabular-nums">{money(a.value)}</div>
              <div className={`text-[11px] tabular-nums ${tone(a.dayChange)}`}>
                {signed(a.dayChange)} ({pctS(a.dayChangePct)})
              </div>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}

function Card({ title, right, children, className = '' }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

function Line({ vals, w = 300, h = 80, color = '#4f46e5', fill = false }: { vals: number[]; w?: number; h?: number; color?: string; fill?: boolean }) {
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const pts = vals.map((v, k) => `${(k / (vals.length - 1)) * w},${h - ((v - lo) / (hi - lo || 1)) * (h - 4) - 2}`)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      {fill && <path d={`M0,${h} L${pts.join(' L')} L${w},${h} Z`} fill={color} fillOpacity={0.08} />}
      <path d={`M${pts.join(' L')}`} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Summary({ profile, ws }: { profile: Profile; ws: Workspace }) {
  const [range, setRange] = useState<'1M' | 'YTD' | '1Y'>('1Y')
  const hist = useMemo(() => balanceHistory(profile), [profile])
  const series = range === '1M' ? hist.slice(-22) : range === 'YTD' ? hist.slice(-200) : hist
  const tot = total(profile.investor.portfolio)
  const day = dayChangeOf(profile.investor.portfolio, ws)
  const held = ws.universe.assets.filter((a) => profile.investor.portfolio[a.id])
  const heldTickers = held.map((a) => a.ticker)
  const [newsTab, setNewsTab] = useState<'mine' | 'top'>('mine')
  const news = newsTab === 'mine' ? ws.market.headlines.filter((h) => h.tickers.some((t) => heldTickers.includes(t)) || !h.tickers.length) : ws.market.headlines
  const movers = [...ws.universe.assets].filter((a) => a.kind !== 'cash').sort((a, b) => Math.abs(b.dayChangePct ?? 0) - Math.abs(a.dayChangePct ?? 0)).slice(0, 6)
  const mine = held
    .filter((a) => a.kind !== 'cash')
    .map((a) => ({ a, chg: (profile.investor.portfolio[a.id] ?? 0) * (1 - 1 / (1 + (a.dayChangePct ?? 0) / 100)) }))
    .sort((x, y) => y.chg - x.chg)

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-3">
      <div className="space-y-5">
        <Card title="Balance" right={<Info size={15} className="text-slate-400" />}>
          <div className="text-3xl font-semibold tabular-nums text-slate-900">{money(tot)}</div>
          <div className={`text-xs tabular-nums ${tone(day)}`}>
            {signed(day)} ({pctS((day / (tot - day)) * 100)}) <span className="text-slate-500">Today’s gain/loss</span>
          </div>
          <div className="mt-4 h-28">
            <Line vals={series} h={110} fill />
          </div>
          <div className="mt-2 flex justify-center gap-2 text-xs">
            {(['1M', 'YTD', '1Y'] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`rounded-full px-2.5 py-1 ${range === r ? 'bg-indigo-700 font-semibold text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {r}
              </button>
            ))}
          </div>
        </Card>
        <Card title="Markets">
          <div className="grid grid-cols-3 gap-3">
            {ws.market.indices.map((q) => (
              <div key={q.name}>
                <div className="text-[11px] text-slate-500">{q.name}</div>
                <div className="text-sm font-semibold tabular-nums">{q.level.toLocaleString()}</div>
                <div className={`text-[11px] tabular-nums ${tone(q.changePct)}`}>{pctS(q.changePct)}</div>
                <div className="mt-1 h-8">
                  <Line vals={sparkline(q.name, 40, q.changePct)} h={30} color={q.changePct >= 0 ? '#059669' : '#e11d48'} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
            {ws.market.other.map((q) => (
              <div key={q.name} className="text-sm">
                <div className="text-[11px] text-slate-500">{q.name}</div>
                <span className="tabular-nums">{q.level.toLocaleString()}</span>{' '}
                <span className={`text-[11px] ${tone(q.changePct)}`}>
                  {q.changePct >= 0 ? <TrendingUp size={11} className="inline" /> : <TrendingDown size={11} className="inline" />} {pctS(q.changePct)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">Simulated market snapshot · {ws.market.asOf}</p>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Up next">
          <div className="flex gap-3">
            <Lightbulb className="mt-1 shrink-0 text-amber-500" size={22} />
            <div>
              <div className="text-sm font-semibold">You’re invited to our Quarterly Market Update</div>
              <p className="mt-1 text-xs text-slate-600">Market perspectives and analysis in a live webinar.</p>
              <button className="mt-2 rounded-full border border-slate-400 px-3 py-1 text-xs">Register now</button>
            </div>
          </div>
        </Card>
        <Card title="Market movers" right={<span className="text-[11px] text-slate-400">Gainers & losers</span>}>
          <table className="w-full text-sm">
            <tbody>
              {movers.map((a) => (
                <tr key={a.id} className="border-t border-slate-100 first:border-0">
                  <td className="py-1.5">
                    <div className="font-semibold">{a.ticker}</div>
                    <div className="text-[11px] text-slate-500">{a.name}</div>
                  </td>
                  <td className="text-right tabular-nums text-slate-600">${a.price?.toFixed(2)}</td>
                  <td className={`text-right tabular-nums ${tone(a.dayChangePct ?? 0)}`}>{pctS(a.dayChangePct ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Portfolio events">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <CalendarClock size={15} className="text-slate-400" /> Earnings dates <span className="text-[11px] text-slate-500">{heldTickers.filter((t) => t !== 'CASH').slice(0, 3).join(', ') || 'none'}</span>
            </li>
            <li className="flex items-center gap-2">
              <Receipt size={15} className="text-slate-400" /> Ex-dividend dates <span className="text-[11px] text-slate-500">{heldTickers.filter((t) => t !== 'CASH').slice(-2).join(', ') || 'none'}</span>
            </li>
          </ul>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="News" right={<ChevronUp size={16} className="text-slate-400" />}>
          <div className="mb-3 flex gap-4 border-b border-slate-200 text-sm">
            {(
              [
                ['mine', 'Your investments'],
                ['top', 'Top news'],
              ] as const
            ).map(([id, l]) => (
              <button key={id} onClick={() => setNewsTab(id)} className={`-mb-px border-b-2 pb-1.5 ${newsTab === id ? 'border-indigo-700 font-semibold' : 'border-transparent text-slate-500'}`}>
                {l}
              </button>
            ))}
          </div>
          <ul className="space-y-3">
            {news.slice(0, 5).map((h) => (
              <li key={h.id}>
                <div className="text-sm text-slate-800">{h.title}</div>
                <div className="text-[11px] text-slate-500">
                  {h.source} · {h.time}
                  {!h.verified && <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">unverified</span>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Your top and bottom movers">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-slate-500">
                <th className="text-left font-normal">Symbol</th>
                <th className="text-right font-normal">Today’s gain/loss</th>
                <th className="text-right font-normal">Last price</th>
              </tr>
            </thead>
            <tbody>
              {mine.map(({ a, chg }) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="py-1.5">
                    <div className="font-semibold">{a.ticker}</div>
                    <div className="text-[11px] text-slate-500">{a.name}</div>
                  </td>
                  <td className={`text-right tabular-nums ${tone(chg)}`}>
                    {signed(chg)} ({pctS(a.dayChangePct ?? 0)})
                  </td>
                  <td className="text-right tabular-nums">${a.price?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

function Positions({ profile, ws }: { profile: Profile; ws: Workspace }) {
  const tot = total(profile.investor.portfolio) || 1
  const rows = ws.universe.assets.filter((a) => profile.investor.portfolio[a.id])
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">Symbol</th>
            <th className="px-4 py-2 text-right">Last price</th>
            <th className="px-4 py-2 text-right">Today</th>
            <th className="px-4 py-2 text-right">Quantity</th>
            <th className="px-4 py-2 text-right">Current value</th>
            <th className="px-4 py-2 text-right">% of account</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const v = profile.investor.portfolio[a.id] ?? 0
            return (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <div className="font-semibold">{a.ticker}</div>
                  <div className="text-[11px] text-slate-500">{a.name}</div>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">${a.price?.toFixed(2)}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${tone(a.dayChangePct ?? 0)}`}>{pctS(a.dayChangePct ?? 0)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{a.kind === 'cash' ? '-' : (v / (a.price || 1)).toFixed(3)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{usd(v)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{((v / tot) * 100).toFixed(1)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
