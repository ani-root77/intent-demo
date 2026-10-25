// HELD-OUT set of real AI-advisor answers (Gemini, default workspace, eval/gemini-answers.json),
// labelled by hand before either reader was run on them. Never used for tuning.
import { readFileSync } from 'node:fs'
import type { AnswerCase } from './types'

const raw = JSON.parse(readFileSync(new URL('./gemini-answers.json', import.meta.url), 'utf8')) as { answer: string }[]

const GOLD: Omit<AnswerCase, 'text'>[] = [
  { stances: { IBIT: 'avoid', BND: 'mention' } },
  { stances: { CASH: ['sell', 'mention'], SMH: 'buy' } },
  { stances: { CASH: ['sell', 'mention'], BND: 'mention' } },
  { stances: { TSLA: 'avoid', BND: 'mention' } },
  { stances: { CASH: ['sell', 'mention'], VTI: 'buy', SMH: 'mention' } },
  { stances: { NVDA: 'buy', CASH: ['sell', 'mention'] } },
  { stances: { BND: 'mention', QQQ: 'avoid', SMH: 'mention' } },
  { stances: {}, unknownBuys: [] },
  { stances: { JNJ: 'mention', VOO: 'mention', AAPL: 'mention', BND: 'mention', CASH: 'mention' } },
  { stances: { SMH: 'avoid', BND: 'mention' } },
  { stances: { GLD: 'avoid', IBIT: 'mention', CASH: 'mention' } },
  { stances: { CASH: ['sell', 'mention'], NVDA: 'buy' } },
  { stances: { META: 'mention', BND: 'mention', CASH: 'mention', SMH: 'mention' }, optional: ['VOO'] },
  { stances: { CASH: ['sell', 'mention'], VTI: 'buy', SMH: 'mention' }, optional: ['BND'] },
  { stances: { AMD: 'buy', NVDA: 'buy', BND: 'sell', CASH: ['sell', 'mention'], SMH: 'mention' } },
]

export const ANSWERS_GEMINI: AnswerCase[] = raw.map((r, i) => ({ text: r.answer, source: 'gemini', ...GOLD[i] }))
