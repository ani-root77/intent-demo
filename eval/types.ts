// Gold-label formats for the reader evaluation.
//
// Labelling conventions
// - type: 'advice' = the investor asks for an opinion ("Should I…?", "Is X good?");
//   'suggestion' = the investor tells the advisor what they want ("Increase…", "I want…", "Move 10%…");
//   'other' = not about an investing action ("What's my balance?", "Thanks").
// - objective: the goal the request states. Pure asset questions ("Should I buy NVDA?") state no goal,
//   so null is correct for them; where a goal is reasonably implied, both are accepted.
// - lean: the risk the request itself implies. Buying a single volatile asset = aggressive; 30%+ into one = very
//   aggressive; wanting less risk / safety / cash for a near need = conservative; general growth / diversify =
//   moderate; no risk signal = neutral.
// - assets: every known ticker the request is about (including sources of money). optAssets may or may not appear.
// - trades: only explicit, sized trades on a named known asset. null = not scored for this case.
// - stances (answers): what the text tells the investor to do with each known asset it names:
//   buy, sell, avoid (advises against buying/adding), or mention (described, held, or "don't sell").
// Arrays mean "any of these is correct".

import type { RiskLean } from '../src/engine/objectives'

type OneOf<T> = T | T[]

export interface GoldTrade {
  ticker: string
  side: 'BUY' | 'SELL'
  usd?: number
  percent?: number
}

export interface RequestCase {
  text: string
  type: OneOf<'advice' | 'suggestion' | 'other'>
  objective: OneOf<string | null>
  lean: OneOf<RiskLean>
  assets: string[]
  optAssets?: string[]
  unknown?: string[]
  trades: GoldTrade[] | null
}

export type GoldStance = 'buy' | 'sell' | 'avoid' | 'mention'

export interface AnswerCase {
  text: string
  stances: Record<string, OneOf<GoldStance>>
  unknownBuys?: string[]
  /** Tickers the text only arguably names (e.g. "index funds"): not required, but if reported the stance must be "mention". */
  optional?: string[]
  /** Where the answer came from: 'written' (hand-written) or 'gemini' (a real advisor answer). */
  source?: 'written' | 'gemini'
}
