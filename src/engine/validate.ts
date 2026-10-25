// Checks that trades proposed by an AI are well-formed and executable on a portfolio.
// Shared by the agent loop (server/sessions.ts) and the advisory portal.

import { usd, type Portfolio, type Trade, type Universe } from './model'

export interface RawTrade {
  ticker?: unknown
  side?: unknown
  usd?: unknown
}

/** Returns netted trades by asset id, or the reasons they can't be executed. */
export function validateTrades(u: Universe, portfolio: Portfolio, raw: unknown, opts: { allowEmpty?: boolean } = {}): { ok: true; trades: Trade[] } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const list = Array.isArray(raw) ? (raw as RawTrade[]) : []
  if ((!opts.allowEmpty && list.length < 1) || list.length > 12) errors.push(`trades must contain ${opts.allowEmpty ? '0' : '1'} to 12 entries`)

  const byTicker = new Map(u.assets.map((a) => [a.ticker, a]))
  const net = new Map<string, number>()
  for (const t of list) {
    const ticker = typeof t?.ticker === 'string' ? t.ticker.trim().toUpperCase() : ''
    const a = byTicker.get(ticker)
    const side = typeof t?.side === 'string' ? t.side.trim().toUpperCase() : ''
    const amt = Number(t?.usd)
    if (!a) {
      errors.push(`unknown ticker "${String(t?.ticker)}". Allowed: ${[...byTicker.keys()].join(', ')}`)
      continue
    }
    if (side !== 'BUY' && side !== 'SELL') errors.push(`${a.ticker}: side must be BUY or SELL`)
    else if (!Number.isFinite(amt) || amt <= 0 || amt > 1e10) errors.push(`${a.ticker}: usd must be a positive amount`)
    else net.set(a.id, (net.get(a.id) ?? 0) + (side === 'SELL' ? -amt : amt))
  }
  for (const [id, amt] of net) {
    const held = portfolio[id] ?? 0
    if (amt < 0 && -amt > held + 0.5) errors.push(`${u.assets.find((x) => x.id === id)?.ticker}: cannot sell ${usd(-amt)}, only ${usd(held)} is held`)
  }
  const sum = [...net.values()].reduce((a, b) => a + b, 0)
  if (net.size && Math.abs(sum) > 1) errors.push(`trades must be self-funded: buys and sells must net to $0 (they net to ${usd(sum)}).`)
  if (errors.length) return { ok: false, errors }
  return { ok: true, trades: [...net].filter(([, a]) => Math.abs(a) > 0.5).map(([asset, amount]) => ({ asset, amount: Math.round(amount) })) }
}
