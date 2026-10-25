// Scores a reader against the gold sets. Shared by eval/run.ts.
import type { RiskLean } from '../src/engine/objectives'
import type { AnswerCase, GoldStance, GoldTrade, RequestCase } from './types'

export interface ReqOut {
  type: 'advice' | 'suggestion' | 'other' | null
  objective: string | null
  lean: RiskLean
  assets: string[]
  unknown: string[]
  trades: GoldTrade[]
}
export interface AnsOut {
  stances: Record<string, GoldStance>
  unknownBuys: string[]
}
export interface Reader {
  name: string
  request: (text: string) => ReqOut
  answer: (text: string) => AnsOut
}

const arr = <T>(x: T | T[]): T[] => (Array.isArray(x) ? x : [x])
const ci = (xs: string[]) => [...new Set(xs.map((x) => x.toLowerCase()))].sort()
const sameSet = (a: string[], b: string[]) => JSON.stringify(ci(a)) === JSON.stringify(ci(b))
const tradeKey = (t: GoldTrade) => `${t.ticker}|${t.side}|${t.usd ? `$${Math.round(t.usd)}` : `${Math.round((t.percent ?? 0) * 10) / 10}%`}`
const sameTrades = (a: GoldTrade[], b: GoldTrade[]) => {
  const near = (x: GoldTrade, y: GoldTrade) =>
    x.ticker === y.ticker && x.side === y.side && (x.usd || y.usd ? Math.round(x.usd ?? 0) === Math.round(y.usd ?? 0) : Math.abs((x.percent ?? 0) - (y.percent ?? 0)) < 0.6)
  return a.length === b.length && a.every((x) => b.some((y) => near(x, y)))
}

export interface Tally {
  n: number
  correct: number
  abstained: number
}
const tally = (): Tally => ({ n: 0, correct: 0, abstained: 0 })

export interface ReqScore {
  type: Tally
  objective: Tally
  lean: Tally
  assets: Tally
  unknown: Tally
  trades: Tally
  exact: Tally
  failures: { text: string; field: string; want: string; got: string }[]
}

export function scoreRequests(reader: Reader, cases: RequestCase[]): ReqScore {
  const s: ReqScore = { type: tally(), objective: tally(), lean: tally(), assets: tally(), unknown: tally(), trades: tally(), exact: tally(), failures: [] }
  for (const c of cases) {
    const o = reader.request(c.text)
    let all = true
    const field = (name: keyof Omit<ReqScore, 'failures' | 'exact'>, ok: boolean, want: string, got: string, abstain = false) => {
      s[name].n++
      if (ok) s[name].correct++
      else {
        all = false
        if (abstain) s[name].abstained++
        s.failures.push({ text: c.text, field: name, want, got: abstain ? `(no answer) ${got}` : got })
      }
    }
    field('type', arr(c.type).includes(o.type as never), arr(c.type).join('|'), String(o.type), o.type === null)
    field('objective', arr(c.objective).includes(o.objective), arr(c.objective).map(String).join('|'), String(o.objective))
    field('lean', arr(c.lean).includes(o.lean), arr(c.lean).join('|'), o.lean)
    const opt = new Set((c.optAssets ?? []).map((x) => x.toUpperCase()))
    const got = o.assets.filter((a) => !opt.has(a.toUpperCase()))
    field('assets', sameSet(got, c.assets), c.assets.join(',') || '-', o.assets.join(',') || '-')
    field('unknown', sameSet(o.unknown, c.unknown ?? []), (c.unknown ?? []).join(',') || '-', o.unknown.join(',') || '-')
    if (c.trades) field('trades', sameTrades(o.trades, c.trades), c.trades.map(tradeKey).join(' ') || '-', o.trades.map(tradeKey).join(' ') || '-')
    s.exact.n++
    if (all) s.exact.correct++
  }
  return s
}

export interface AnsScore {
  stance: Tally
  /** Gold is not "buy" but the reader says "buy": would accuse a correct answer of a hidden buy, or miss a warning. */
  falseBuy: number
  /** Gold is "avoid" but the reader misses it: a contradiction (trades buy what the text warns against) goes unseen. */
  missedAvoid: number
  /** Gold is "buy" but the reader says "avoid": a false contradiction. */
  falseAvoid: number
  /** Assets the reader reports that the gold does not list. */
  spurious: number
  unknown: Tally
  exact: Tally
  failures: { text: string; field: string; want: string; got: string }[]
}

export function scoreAnswers(reader: Reader, cases: AnswerCase[]): AnsScore {
  const s: AnsScore = { stance: tally(), falseBuy: 0, missedAvoid: 0, falseAvoid: 0, spurious: 0, unknown: tally(), exact: tally(), failures: [] }
  for (const c of cases) {
    const o = reader.answer(c.text)
    let all = true
    for (const [tk, want] of Object.entries(c.stances)) {
      const ok = arr(want)
      const got = o.stances[tk]
      s.stance.n++
      if (got && ok.includes(got)) s.stance.correct++
      else {
        all = false
        if (got === 'buy' && !ok.includes('buy')) s.falseBuy++
        if (ok.includes('avoid') && got !== 'avoid') s.missedAvoid++
        if (got === 'avoid' && ok.includes('buy')) s.falseAvoid++
        s.failures.push({ text: c.text, field: `stance ${tk}`, want: ok.join('|'), got: got ?? '(not found)' })
      }
    }
    for (const tk of Object.keys(o.stances)) {
      if (!(tk in c.stances) && !(c.optional?.includes(tk) && o.stances[tk] === 'mention')) {
        s.spurious++
        all = false
        s.failures.push({ text: c.text, field: `stance ${tk}`, want: '(not mentioned)', got: o.stances[tk] })
      }
    }
    if (c.unknownBuys) {
      s.unknown.n++
      if (sameSet(o.unknownBuys, c.unknownBuys)) s.unknown.correct++
      else {
        all = false
        s.failures.push({ text: c.text, field: 'unknown buys', want: c.unknownBuys.join(',') || '-', got: o.unknownBuys.join(',') || '-' })
      }
    }
    s.exact.n++
    if (all) s.exact.correct++
  }
  return s
}
