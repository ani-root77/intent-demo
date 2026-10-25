// Clario's keyword lists (RuleLexicon) and the original keyword-only reader. No AI in here.
// The app reads text with the NLP reader in nlp.ts, which uses these lists; the keyword-only
// readRequest()/scanAnswer() below are kept as the baseline for eval/run.ts.
// 1. readRequest(): a rule-based reading of the investor's question, used to cross-check the
//    reading the investor sees and can correct (Clario has no AI parser).
// 2. scanAnswer(): reads the AI advisor's written answer for what it actually tells the investor
//    to buy, sell or avoid, so Clario never relies on the advisor's own description of itself.
// The keyword lists live in the workspace (RuleLexicon) and are editable.

import type { Asset, Universe } from './model'
import { RISK_LEANS, type Objective, type ObjectiveMetric, type RiskLean } from './objectives'

export type Level = Exclude<RiskLean, 'neutral'>

export interface RuleLexicon {
  buyWords: string[]
  sellWords: string[]
  negations: string[]
  /** Words that send money from the assets before them to the assets after them ("cash into QQQ"). */
  intoWords: string[]
  /** A sentence only counts as a recommendation if it has one of these (or starts with a buy/sell verb). */
  recommendCues: string[]
  /** Phrases that look negative but aren't ("cannot miss"); they cancel a negation in the same clause. */
  positiveIdioms: string[]
  riskWords: Record<Level, string[]>
  metricWords: Record<Exclude<ObjectiveMetric, 'none'>, string[]>
  /** Words for a general goal with no specific direction ("grow toward retirement"): objectives whose metric is 'none'. */
  generalWords: string[]
  increaseWords: string[]
  decreaseWords: string[]
  adviceStarters: string[]
  /** Words after which a capitalised name is read as an asset ("invest in SpaceX", "buy Rivian"). */
  assetLeadWords: string[]
  /** Capitalised words that are never asset names (sentence starters, pronouns, generic terms). */
  stopWords: string[]
  /** Buying a risky asset with at least this share of the portfolio reads as very aggressive. */
  bigPercent: number
}

export const DEFAULT_RULES: RuleLexicon = {
  buyWords: ['buy', 'buying', 'add', 'adding', 'invest', 'investing', 'allocate', 'allocating', 'put', 'putting', 'purchase', 'accumulate', 'load up', 'loading up', 'increase', 'increasing', 'overweight', 'pick up', 'get into', 'start a position', 'deploy', 'deploying', 'reallocate', 'reallocating', 'shift', 'shifting', 'rotate', 'rotating', 'move', 'moving', 'go all-in', 'go all in', 'grab', 'own'],
  sellWords: ['sell', 'selling', 'trim', 'trimming', 'reduce', 'reducing', 'exit', 'exiting', 'take profits', 'dump', 'dumping', 'get out of', 'underweight', 'cut', 'cutting', 'liquidate', 'liquidating'],
  negations: ["don't", 'do not', 'not', 'avoid', 'against', 'instead of', 'rather than', 'hold off', 'never', "shouldn't", 'should not', "wouldn't", 'steer clear', 'skip', 'no need', 'unavailable', 'cannot', "can't", 'too risky', 'resist', 'decline', 'declining', 'pass on', 'refrain', 'stay away', 'reject', 'forgo', 'forego', 'advise against', 'recommend against'],
  intoWords: ['into', 'to buy', 'to purchase', 'to fund', 'in favor of', 'toward', 'towards'],
  recommendCues: ['you should', 'we should', 'i recommend', 'i would recommend', 'recommend', 'i suggest', 'suggest', 'consider', "let's", 'let us', 'we will', "we'll", 'i will', "i'll", 'i would', "i'd", 'go ahead', 'you could', 'it makes sense', 'my advice', 'definitely', 'now is the time', 'time to', 'the best move', 'you need to', 'we need to', 'must', 'act now', 'act immediately', 'should'],
  positiveIdioms: ['cannot miss', "can't miss", 'not to be missed', "don't miss", 'do not miss', "can't go wrong", 'cannot go wrong', "don't wait", 'do not wait', 'not too late', "don't hesitate", 'do not hesitate', 'no doubt', 'not a question of if'],
  riskWords: {
    very_conservative: ['as safe as possible', 'no risk', 'zero risk', 'all cash', 'sell everything', 'guaranteed', 'cannot lose'],
    conservative: ['safe', 'safer', 'safety', 'protect', 'preserve', 'reduce risk', 'less risk', 'lower risk', 'nervous', 'worried', 'scared', 'defensive', 'income', 'stable', 'stability'],
    moderate: ['balanced', 'diversify', 'diversified', 'rebalance', 'steady', 'moderate'],
    aggressive: ['growth', 'aggressive', 'ai exposure', 'more ai', 'tech exposure', 'high growth', 'crypto', 'upside', 'momentum'],
    very_aggressive: ['all in', 'all-in', 'everything into', 'maximum', 'max out', 'as much as possible', 'double', 'moon', 'yolo', 'leverage', 'margin', 'go big', 'half my', 'most of my'],
  },
  metricWords: {
    tech: ['ai', 'artificial intelligence', 'tech', 'technology', 'semiconductor', 'semiconductors', 'chip', 'chips', 'nasdaq'],
    volatility: ['risk', 'risky', 'safe', 'safer', 'volatility', 'volatile', 'protect', 'defensive', 'nervous', 'worried'],
    cash: ['cash', 'liquidity', 'liquid', 'need money', 'need the money', 'house deposit', 'down payment', 'emergency fund', 'withdraw'],
    equity: ['stocks', 'equities', 'equity'],
    expectedReturn: ['return', 'returns', 'yield'],
  },
  generalWords: ['grow', 'growth', 'retire', 'retirement', 'goal', 'long-term', 'long term', 'manage my', 'my plan', 'compound', 'build wealth'],
  increaseWords: ['increase', 'more', 'add', 'boost', 'raise', 'grow', 'higher', 'buy', 'need'],
  decreaseWords: ['reduce', 'less', 'lower', 'cut', 'decrease', 'trim', 'safer', 'safe', 'protect'],
  adviceStarters: ['should i', 'is it', 'would it', 'can i', 'do you think', 'what about', 'is now', 'is this', 'would you', 'am i', 'is', 'are', 'does', 'will'],
  assetLeadWords: ['invest in', 'investing in', 'invested in', 'buy', 'buying', 'buy more', 'purchase', 'own', 'into', 'stake in', 'shares of', 'position in', 'exposure to', 'about', 'in', 'on', 'like', 'such as'],
  stopWords: ['I', 'The', 'A', 'An', 'My', 'Your', 'You', 'We', 'It', 'This', 'That', 'These', 'Those', 'AI', 'US', 'ETF', 'ETFs', 'Fund', 'Funds', 'Index', 'Inc', 'Corp', 'Instead', 'However', 'Therefore', 'Given', 'While', 'Let', 'Lets', 'Buy', 'Sell', 'Add', 'Put', 'Move', 'Also', 'And', 'But', 'So', 'If', 'With', 'For', 'To', 'In', 'On', 'At', 'Now', 'Today', 'Friday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday', 'Sunday', 'October', 'Fed', 'CEO', 'IPO', 'S&P', 'Nasdaq', 'Dow', 'Wall', 'Street', 'Overall', 'Finally', 'First', 'Second', 'Third', 'Given', 'Since', 'Because', 'Although', 'Here', 'There', 'Yes', 'No', 'Maybe', 'Please', 'Should', 'Is', 'Are', 'Will', 'Can', 'Could', 'Would', 'What', 'Why', 'How', 'When'],
  bigPercent: 30,
}

// ---------- helpers ----------

const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const phraseRe = (p: string) => new RegExp(`(?<![a-z0-9])${esc(p.toLowerCase())}(?![a-z0-9])`, 'i')
const has = (text: string, words: string[]) => words.find((w) => w.trim() && phraseRe(w).test(text))

/** Names a known asset can be referred to by: ticker, full name, and its aliases. */
export function namesOf(a: Asset): string[] {
  return [a.ticker, a.name, ...(a.aliases ?? [])].filter(Boolean)
}

/** Finds a known asset from a free-text name (used for advisor-reported asset names). */
export function matchAsset(name: string, assets: Asset[]): Asset | undefined {
  const m = norm(name).trim().toLowerCase()
  if (!m) return undefined
  return (
    assets.find((a) => a.ticker.toLowerCase() === m) ??
    assets.find((a) => namesOf(a).some((n) => n.toLowerCase() === m)) ??
    assets.find((a) => namesOf(a).some((n) => phraseRe(n).test(m) || (m.length > 3 && phraseRe(m).test(n))))
  )
}

/** Known assets mentioned in a piece of text (ticker as a whole word, or a name/alias). */
export function assetsIn(text: string, assets: Asset[]): Asset[] {
  const t = norm(text)
  return assets.filter((a) => new RegExp(`(?<![A-Za-z0-9])${esc(a.ticker)}(?![A-Za-z0-9])`).test(t) || [a.name, ...(a.aliases ?? [])].some((n) => n && phraseRe(n).test(t)))
}

/** Capitalised names right after an asset lead word ("invest in SpaceX") that match nothing known. */
function unknownNamesIn(text: string, assets: Asset[], lex: RuleLexicon, extraStop: string[]): string[] {
  const stop = new Set([...lex.stopWords, ...extraStop].map((s) => s.toLowerCase()))
  const out: string[] = []
  const t = norm(text)
  const leads = lex.assetLeadWords.map((w) => esc(w.toLowerCase())).sort((a, b) => b.length - a.length)
  const lead = new RegExp(`(?<![a-z0-9])(?:${leads.join('|')})\\s+(?:(?:more|some|a|an|the|shares of|stock in)\\s+)?`, 'gi')
  const name = /^([A-Z][A-Za-z0-9&.-]*[A-Za-z0-9](?:\s+[A-Z][A-Za-z0-9&.-]*[A-Za-z0-9]){0,2})/
  for (const l of t.matchAll(lead)) {
    const m = name.exec(t.slice((l.index ?? 0) + l[0].length))
    if (!m) continue
    const words = m[1].split(/\s+/).filter((w) => !stop.has(w.toLowerCase()))
    if (!words.length) continue
    const phrase = words.join(' ')
    if (phrase.length < 3 || matchAsset(phrase, assets)) continue
    if (!out.some((o) => o.toLowerCase() === phrase.toLowerCase())) out.push(phrase)
  }
  return out
}

/** Splits text into clauses, so "Instead of chasing X, buy Y" treats X and Y separately. */
function clauses(text: string): string[] {
  return norm(text)
    .split(/(?<=[.!?])\s+|[;:\n]|,\s+|\s+but\s+|\s+however\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ---------- answer scan ----------

export type Stance = 'buy' | 'sell' | 'avoid' | 'mention'

export interface AnswerScan {
  /** What the text says about each known asset it mentions, with the clause as evidence. */
  stances: { ticker: string; stance: Stance; clause: string }[]
  /** Names the text recommends buying that Clario can't model. */
  unknownBuys: { name: string; clause: string }[]
}

export function scanAnswer(answer: string, u: Universe, lex: RuleLexicon, investorName: string): AnswerScan {
  const stances: AnswerScan['stances'] = []
  const unknownBuys: AnswerScan['unknownBuys'] = []
  const sentences = norm(answer)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const sentence of sentences) {
    // A sentence only recommends something if it carries a recommending cue ("you should",
    // "I recommend", "let's"...). Descriptions like "putting 40% into crypto is risky" don't.
    const cue = !!has(sentence, lex.recommendCues)
    for (const c of clauses(sentence)) {
      const found = assetsIn(c, u.assets)
      const negated = !!has(c, lex.negations) && !has(c, lex.positiveIdioms)
      const buy = !!has(c, lex.buyWords)
      const sell = !!has(c, lex.sellWords)
      // An imperative clause ("Buy $10k of QQQ") recommends even without a cue.
      const imperative = [...lex.buyWords, ...lex.sellWords]
        .filter((w) => !/ing\b/.test(w))
        .some((w) => new RegExp(`^(?:and\\s+|then\\s+)?${esc(w)}(?![a-z0-9])`, 'i').test(c))
      const recommends = cue || imperative
      const into = lex.intoWords
        .map((w) => phraseRe(w).exec(c))
        .filter((m): m is RegExpExecArray => !!m)
        .sort((x, y) => x.index - y.index)[0]

      for (const a of found) {
        let stance: Stance = 'mention'
        const pos = c.toLowerCase().search(new RegExp(`(?<![a-z0-9])(${namesOf(a).map((n) => esc(n.toLowerCase())).join('|')})(?![a-z0-9])`))
        const afterInto = !!into && pos > into.index
        if (negated) stance = 'avoid'
        else if (!recommends) stance = 'mention'
        else if (into && (buy || sell)) {
          // "move cash and bonds into QQQ" / "sell BND to buy IBIT": before is the source, after is the destination.
          stance = afterInto ? 'buy' : 'sell'
        } else if (buy && !sell) stance = 'buy'
        else if (sell && !buy) stance = 'sell'
        // Cash named with a buy word is the funding source ("put your cash to work"), unless money goes into it.
        if (a.kind === 'cash' && stance === 'buy' && !afterInto) stance = 'sell'
        stances.push({ ticker: a.ticker, stance, clause: c })
      }
      if (!negated && recommends && (buy || into)) {
        const tail = into ? c.slice(into.index) : c
        for (const name of unknownNamesIn(tail, u.assets, lex, [investorName])) unknownBuys.push({ name, clause: c })
      }
    }
  }
  return { stances, unknownBuys }
}

/** The strongest stance per ticker: avoid beats buy/sell, which beat a plain mention. */
export function stanceByTicker(scan: AnswerScan): Map<string, { stance: Stance; clause: string }> {
  const rank: Record<Stance, number> = { mention: 0, sell: 1, buy: 2, avoid: 3 }
  const m = new Map<string, { stance: Stance; clause: string }>()
  for (const s of scan.stances) {
    const cur = m.get(s.ticker)
    if (!cur || rank[s.stance] > rank[cur.stance]) m.set(s.ticker, { stance: s.stance, clause: s.clause })
  }
  return m
}

// ---------- request reading ----------

export interface RuleReading {
  request_type: 'suggestion' | 'advice' | 'other' | null
  objective: string | null
  implied_risk: RiskLean
  known: Asset[]
  unknown: string[]
  requested_trades: { ticker: string; side: 'BUY' | 'SELL'; usd: number; percent: number }[]
  /** Which keywords drove the reading, for transparency. */
  evidence: string[]
}

export function readRequest(question: string, u: Universe, objectives: Objective[], lex: RuleLexicon, investorName: string): RuleReading {
  const q = norm(question).trim()
  const lower = q.toLowerCase()
  const evidence: string[] = []

  const known = assetsIn(q, u.assets)
  const unknown = unknownNamesIn(q, u.assets, lex, [investorName])
  if (known.length) evidence.push(`assets named: ${known.map((a) => a.ticker).join(', ')}`)
  if (unknown.length) evidence.push(`unrecognised names: ${unknown.join(', ')}`)

  // Request type
  const adviceStart = lex.adviceStarters.find((s) => lower.startsWith(s.toLowerCase() + ' '))
  const imperative = has(lower, [...lex.buyWords, ...lex.sellWords, ...lex.increaseWords, ...lex.decreaseWords, 'make'])
  const request_type = adviceStart ? 'advice' : imperative ? 'suggestion' : null
  if (adviceStart) evidence.push(`starts with “${adviceStart}” → advice`)
  else if (imperative) evidence.push(`action word “${imperative}” → suggestion`)

  // Amounts
  const pctM = /(\d{1,3}(?:\.\d+)?)\s?(?:%|percent)/i.exec(q)
  const usdM = /\$\s?(\d[\d,]*(?:\.\d+)?)\s?(k|m)?\b/i.exec(q)
  const percent = pctM ? Number(pctM[1]) : lower.includes('half') ? 50 : 0
  const usd = usdM ? Number(usdM[1].replace(/,/g, '')) * (usdM[2]?.toLowerCase() === 'k' ? 1e3 : usdM[2]?.toLowerCase() === 'm' ? 1e6 : 1) : 0
  const sellish = !!has(lower, lex.sellWords) && !has(lower, lex.buyWords)
  const requested_trades =
    known.length === 1 && (percent || usd) ? [{ ticker: known[0].ticker, side: (sellish ? 'SELL' : 'BUY') as 'BUY' | 'SELL', usd: usd || 0, percent: usd ? 0 : percent }] : []
  if (requested_trades.length) evidence.push(`explicit amount: ${usd ? `$${usd.toLocaleString()}` : `${percent}%`} ${sellish ? 'from' : 'into'} ${known[0].ticker}`)

  // Risk lean: the most extreme keyword level wins; big bets on risky assets count as very aggressive.
  let implied_risk: RiskLean = 'neutral'
  for (const level of ['very_aggressive', 'very_conservative', 'aggressive', 'conservative', 'moderate'] as Level[]) {
    const w = has(lower, lex.riskWords[level])
    if (w) {
      implied_risk = level
      evidence.push(`“${w}” → ${level.replace('_', ' ')}`)
      break
    }
  }
  const risky = known.some((a) => a.kind === 'stock' || (a.tailProb ?? 0) > 0 || a.sigma >= 0.3)
  if (!sellish && risky && percent >= lex.bigPercent) {
    implied_risk = 'very_aggressive'
    evidence.push(`${percent}% into a volatile asset → very aggressive`)
  } else if (!sellish && risky && implied_risk === 'neutral') {
    implied_risk = 'aggressive'
    evidence.push('buying a volatile asset → aggressive')
  }

  // Objective: which metric is talked about, and in which direction.
  let objective: string | null = null
  const metric = (Object.keys(lex.metricWords) as (keyof RuleLexicon['metricWords'])[]).find((m) => has(lower, lex.metricWords[m]))
  if (metric) {
    const down = has(lower, lex.decreaseWords)
    const up = has(lower, lex.increaseWords)
    const direction = metric === 'volatility' ? (up && !down ? 'up' : 'down') : down && !up ? 'down' : 'up'
    objective = objectives.find((o) => o.metric === metric && o.direction === direction)?.id ?? null
    if (objective) evidence.push(`talks about ${metric} going ${direction} → ${objective}`)
  }
  if (!objective) {
    const g = has(lower, lex.generalWords)
    const general = g ? objectives.find((o) => o.metric === 'none') : undefined
    if (general) {
      objective = general.id
      evidence.push(`“${g}” → ${general.id}`)
    }
  }

  return { request_type, objective, implied_risk, known, unknown, requested_trades, evidence }
}

export const levelOf = (l: RiskLean) => (l === 'neutral' ? null : RISK_LEANS.indexOf(l))

// ---------- sanitising ----------

const words = (v: unknown, def: string[]) =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 200)
    : def

export function sanitizeRules(raw: unknown): RuleLexicon {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_RULES
  const rw = (r.riskWords && typeof r.riskWords === 'object' ? r.riskWords : {}) as Record<string, unknown>
  const mw = (r.metricWords && typeof r.metricWords === 'object' ? r.metricWords : {}) as Record<string, unknown>
  return {
    buyWords: words(r.buyWords, d.buyWords),
    sellWords: words(r.sellWords, d.sellWords),
    negations: words(r.negations, d.negations),
    intoWords: words(r.intoWords, d.intoWords),
    recommendCues: words(r.recommendCues, d.recommendCues),
    positiveIdioms: words(r.positiveIdioms, d.positiveIdioms),
    riskWords: Object.fromEntries((Object.keys(d.riskWords) as Level[]).map((k) => [k, words(rw[k], d.riskWords[k])])) as Record<Level, string[]>,
    metricWords: Object.fromEntries((Object.keys(d.metricWords) as (keyof RuleLexicon['metricWords'])[]).map((k) => [k, words(mw[k], d.metricWords[k])])) as RuleLexicon['metricWords'],
    generalWords: words(r.generalWords, d.generalWords),
    increaseWords: words(r.increaseWords, d.increaseWords),
    decreaseWords: words(r.decreaseWords, d.decreaseWords),
    adviceStarters: words(r.adviceStarters, d.adviceStarters),
    assetLeadWords: words(r.assetLeadWords, d.assetLeadWords),
    stopWords: words(r.stopWords, d.stopWords),
    bigPercent: typeof r.bigPercent === 'number' && Number.isFinite(r.bigPercent) ? Math.min(100, Math.max(1, r.bigPercent)) : d.bigPercent,
  }
}
