// Snapshot of the LLM comparison run for the monitoring page.
// Run: npx tsx eval/llm-status.ts <out dir>
// Writes sets.json (progress per set), status.json (the run's state), readings.json (every text: Gemini's exact
// outputs, the NLP reader's output and the expected reading) and prompts.json (what Gemini is sent).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { sanitizeWorkspace } from '../src/engine/config'
import { readRequestNlp, scanAnswerNlp } from '../src/engine/nlp'
import { stanceByTicker } from '../src/engine/rules'
import { ANSWERS_DEV } from './answers.dev'
import { ANSWERS_GEMINI } from './answers.gemini'
import { ANSWERS_TEST } from './answers.test'
import { ANSWERS_INJECTION, REQUESTS_INJECTION } from './injection'
import { ANSWER_READER_PROMPT, answerMessages, answerSchema, MODEL, REQUEST_PARSER_PROMPT, requestMessages, requestSchema, toAns, toReq } from './llm-prompts'
import { REQUESTS_DEV } from './requests.dev'
import { REQUESTS_TEST } from './requests.test'
import { scoreAnswers, scoreRequests, type AnsOut, type Reader, type ReqOut } from './score'
import type { AnswerCase, RequestCase } from './types'

const RUNS = 3
const out = process.argv[2] ?? '.'
const ws = sanitizeWorkspace({})
const u = ws.universe
const cache: Record<string, { output: unknown; ms: number }[]> = existsSync('eval/llm-runs.json') ? JSON.parse(readFileSync('eval/llm-runs.json', 'utf8')) : {}

type Set = { reader: 'Requests' | 'Answers'; name: string; key: 'req' | 'ans'; cases: (RequestCase | AnswerCase)[] }
const SETS: Set[] = [
  { reader: 'Requests', name: 'Dev', key: 'req', cases: REQUESTS_DEV },
  { reader: 'Requests', name: 'Held-out test', key: 'req', cases: REQUESTS_TEST },
  { reader: 'Requests', name: 'Prompt injection', key: 'req', cases: REQUESTS_INJECTION },
  { reader: 'Answers', name: 'Dev', key: 'ans', cases: ANSWERS_DEV },
  { reader: 'Answers', name: 'Held-out test', key: 'ans', cases: ANSWERS_TEST },
  { reader: 'Answers', name: 'Real Gemini', key: 'ans', cases: ANSWERS_GEMINI },
  { reader: 'Answers', name: 'Prompt injection', key: 'ans', cases: ANSWERS_INJECTION },
]

// Progress per set
const sets = SETS.map((s) => {
  const done = s.cases.reduce((n, c) => n + Math.min(RUNS, cache[`${s.key}|${c.text}`]?.length ?? 0), 0)
  return { set: `${s.reader} · ${s.name}`, reader: s.reader, texts: s.cases.length, calls_done: done, calls_needed: s.cases.length * RUNS }
})

// Run status, from the last progress line of the log
const log = existsSync('eval/llm-run.log') ? readFileSync('eval/llm-run.log', 'utf8') : ''
const last = log.split('\n').filter((l) => l.startsWith('PROGRESS ')).at(-1)
const p = last ? JSON.parse(last.slice(9)) : {}
const finished = log.includes('## Speed')
const status = [{
  state: finished ? 'Finished' : p.note?.startsWith('rate limited') ? 'Waiting on rate limit' : 'Running',
  note: p.note || '',
  failed: p.failed ?? 0,
  elapsed_min: p.elapsedMin ?? 0,
  eta_min: finished ? 0 : (p.etaMin ?? null),
  limit_per_min: 15,
  model: MODEL,
}]

// Every reading: exact Gemini outputs, the NLP reader's output, the expected reading
const nlpReq = (t: string): ReqOut => {
  const r = readRequestNlp(t, u, ws.objectives, ws.rules, 'Maya')
  return { type: r.request_type, objective: r.objective, lean: r.implied_risk, assets: r.known.map((a) => a.ticker), unknown: r.unknown, trades: r.requested_trades.map((x) => ({ ticker: x.ticker, side: x.side, usd: x.usd || undefined, percent: x.percent || undefined })) }
}
const nlpAns = (t: string): AnsOut => {
  const s = scanAnswerNlp(t, u, ws.rules, 'Maya')
  return { stances: Object.fromEntries([...stanceByTicker(s)].map(([k, v]) => [k, v.stance])), unknownBuys: s.unknownBuys.map((x) => x.name) }
}
const one = (fn: () => ReqOut | AnsOut): Reader => ({ name: '', request: fn as () => ReqOut, answer: fn as () => AnsOut })
const right = (s: Set, c: RequestCase | AnswerCase, rd: Reader) =>
  s.key === 'req' ? scoreRequests(rd, [c as RequestCase]).exact.correct === 1 : scoreAnswers(rd, [c as AnswerCase]).exact.correct === 1
const showReq = (o: ReqOut) => JSON.stringify({ type: o.type, objective: o.objective, lean: o.lean, assets: o.assets, unknown: o.unknown, trades: o.trades.map((t) => `${t.side} ${t.ticker} ${t.usd ? `$${t.usd}` : `${t.percent}%`}`) })
const showAns = (o: AnsOut) => JSON.stringify({ stances: o.stances, unknown_buys: o.unknownBuys })
const gold = (s: Set, c: RequestCase | AnswerCase) => {
  if (s.key === 'ans') {
    const a = c as AnswerCase
    return JSON.stringify({ stances: a.stances, ...(a.unknownBuys ? { unknown_buys: a.unknownBuys } : {}), ...(a.optional ? { optional: a.optional } : {}) })
  }
  const r = c as RequestCase
  return JSON.stringify({ type: r.type, objective: r.objective, lean: r.lean, assets: r.assets, ...(r.optAssets ? { optional_assets: r.optAssets } : {}), unknown: r.unknown ?? [], trades: r.trades === null ? 'not scored' : r.trades.map((t) => `${t.side} ${t.ticker} ${t.usd ? `$${t.usd}` : `${t.percent}%`}`) })
}

const readings = SETS.flatMap((s) =>
  s.cases.map((c, i) => {
    const runs = cache[`${s.key}|${c.text}`] ?? []
    const raw = (k: number) => (runs[k] ? JSON.stringify(runs[k].output) : '')
    const geminiRight = runs.slice(0, RUNS).filter((r) => right(s, c, one(() => (s.key === 'req' ? toReq : toAns)((r.output ?? {}) as Record<string, unknown>)))).length
    const nlpOut = s.key === 'req' ? nlpReq(c.text) : nlpAns(c.text)
    return {
      id: `${s.key}-${s.name.toLowerCase().replace(/[^a-z]+/g, '-')}-${String(i + 1).padStart(2, '0')}`,
      set: `${s.reader} · ${s.name}`,
      input: c.text,
      runs_done: Math.min(RUNS, runs.length),
      gemini_run1: raw(0),
      gemini_run2: raw(1),
      gemini_run3: raw(2),
      gemini_right: runs.length ? `${geminiRight}/${Math.min(RUNS, runs.length)}` : '',
      gemini_same_each_run: runs.length >= 2 ? (new Set(runs.slice(0, RUNS).map((r) => JSON.stringify(s.key === 'req' ? toReq((r.output ?? {}) as Record<string, unknown>) : toAns((r.output ?? {}) as Record<string, unknown>)))).size === 1 ? 'yes' : 'no') : '',
      nlp_output: s.key === 'req' ? showReq(nlpOut as ReqOut) : showAns(nlpOut as AnsOut),
      nlp_right: right(s, c, one(() => nlpOut)) ? 'yes' : 'no',
      expected: gold(s, c),
    }
  }),
)

// What Gemini is sent: system prompt, the message for one text, the output schema
const prompts = [
  { reader: 'Requests', who: "Clario's old Gemini parser, unchanged", model: MODEL, temperature: 0, system_prompt: requestMessages('').system, message_template: requestMessages('{the investor request}').prompt, output_schema: JSON.stringify(requestSchema), template_source: REQUEST_PARSER_PROMPT.length },
  { reader: 'Answers', who: 'An LLM answer reader built for this test', model: MODEL, temperature: 0, system_prompt: answerMessages('').system, message_template: answerMessages('{the advisor answer}').prompt, output_schema: JSON.stringify(answerSchema), template_source: ANSWER_READER_PROMPT.length },
].map(({ template_source: _, ...r }) => r)

writeFileSync(`${out}/sets.json`, JSON.stringify(sets, null, 1))
writeFileSync(`${out}/status.json`, JSON.stringify(status, null, 1))
writeFileSync(`${out}/readings.json`, JSON.stringify(readings))
writeFileSync(`${out}/prompts.json`, JSON.stringify(prompts))
console.log(JSON.stringify({ sets: sets.map((r) => `${r.set} ${r.calls_done}/${r.calls_needed}`), status: status[0], readings: readings.length }))
