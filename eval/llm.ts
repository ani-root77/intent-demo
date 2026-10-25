// Compares an LLM reader (Gemini) with the rule and NLP readers on the same gold sets.
// Requests: the exact Gemini request parser Clario used before it went AI-free (same prompt, schema, model, temperature).
// Answers: Clario never had an LLM answer reader, so this one is built for the comparison and is given the same
// labelling guide the gold labels follow (eval/types.ts).
// Every text is read 3 times to measure consistency. Raw outputs are cached in eval/llm-runs.json; re-running only
// calls Gemini for texts not in the cache.
// Run: npx tsx eval/llm.ts      Writes eval/llm-report.md.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { generateJson } from '../server/gemini'
import { answerMessages, answerSchema, MODEL, requestMessages, requestSchema, toAns, toReq } from './llm-prompts'
import { sanitizeWorkspace } from '../src/engine/config'
import { readRequestNlp, scanAnswerNlp } from '../src/engine/nlp'
import { readRequest, scanAnswer, stanceByTicker } from '../src/engine/rules'
import { ANSWERS_DEV } from './answers.dev'
import { ANSWERS_GEMINI } from './answers.gemini'
import { ANSWERS_TEST } from './answers.test'
import { ANSWERS_INJECTION, REQUESTS_INJECTION } from './injection'
import { REQUESTS_DEV } from './requests.dev'
import { REQUESTS_TEST } from './requests.test'
import { scoreAnswers, scoreRequests, type AnsOut, type Reader, type ReqOut, type Tally } from './score'
import type { AnswerCase, RequestCase } from './types'

process.loadEnvFile('.env')

const RUNS = 3
const ws = sanitizeWorkspace({})
const u = ws.universe
const NAME = 'Maya'

// ---------- Gemini calls ----------

async function llmRequest(text: string) {
  const { system, prompt } = requestMessages(text)
  const call = await generateJson('parser', MODEL, system, prompt, requestSchema, 0)
  return { output: call.output, ms: call.ms }
}

async function llmAnswer(text: string) {
  const { system, prompt } = answerMessages(text)
  const call = await generateJson('parser', MODEL, system, prompt, answerSchema, 0)
  return { output: call.output, ms: call.ms }
}

// ---------- run (with cache) ----------

type Cache = Record<string, { output: unknown; ms: number }[]>
const CACHE = 'eval/llm-runs.json'
const cache: Cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
const save = () => writeFileSync(CACHE, JSON.stringify(cache, null, 1))

const reqTexts = [...REQUESTS_DEV, ...REQUESTS_TEST, ...REQUESTS_INJECTION].map((c) => c.text)
const ansTexts = [...ANSWERS_DEV, ...ANSWERS_TEST, ...ANSWERS_GEMINI, ...ANSWERS_INJECTION].map((c) => c.text)
const jobs: { key: string; run: () => Promise<{ output: unknown; ms: number }> }[] = []
for (const t of reqTexts) for (let k = (cache[`req|${t}`] ?? []).length; k < RUNS; k++) jobs.push({ key: `req|${t}`, run: () => llmRequest(t) })
for (const t of ansTexts) for (let k = (cache[`ans|${t}`] ?? []).length; k < RUNS; k++) jobs.push({ key: `ans|${t}`, run: () => llmAnswer(t) })
const total = jobs.length
console.log(`Gemini calls needed: ${total}`)
// Free tier: 15 requests per minute per model. Stay just under it, one call at a time, and honour Google's retry delay.
const GAP_MS = 4300
let done = 0
let failed = 0
const t0 = Date.now()
const progress = (note = '') => {
  const left = total - done - failed
  console.log(`PROGRESS ${JSON.stringify({ done, failed, total, cached: Object.values(cache).flat().length, etaMin: Math.ceil((left * GAP_MS) / 60000), elapsedMin: Math.round((Date.now() - t0) / 6000) / 10, note })}`)
}
progress('started')
for (let job = jobs.shift(); job; job = jobs.shift()) {
  for (let attempt = 0; ; attempt++) {
    const started = Date.now()
    try {
      const r = await job.run()
      ;(cache[job.key] ??= []).push(r)
      done++
      break
    } catch (e) {
      const msg = (e as Error).message
      const wait = Number(/retry in ([\d.]+)s/i.exec(msg)?.[1] ?? /"retryDelay":"(\d+)s"/.exec(msg)?.[1] ?? 30)
      if (attempt >= 5 || !/429|quota|503|UNAVAILABLE/i.test(msg)) {
        failed++
        console.log(`failed: ${job.key.slice(0, 60)} ${msg.slice(0, 120)}`)
        break
      }
      progress(`rate limited, waiting ${Math.ceil(wait)}s`)
      await new Promise((r) => setTimeout(r, (Math.ceil(wait) + 2) * 1000))
    } finally {
      await new Promise((r) => setTimeout(r, Math.max(0, GAP_MS - (Date.now() - started))))
    }
  }
  if ((done + failed) % 10 === 0) {
    save()
    progress()
  }
}
save()
progress('finished calling Gemini')
if (failed) console.log(`${failed} calls failed; re-run to fill them in`)

// ---------- readers ----------

const llmReader = (k: number): Reader => ({
  name: `Gemini run ${k + 1}`,
  request: (t) => toReq((cache[`req|${t}`]?.[k]?.output ?? {}) as Record<string, unknown>),
  answer: (t) => toAns((cache[`ans|${t}`]?.[k]?.output ?? {}) as Record<string, unknown>),
})
const rules: Reader = {
  name: 'Rules (before)',
  request: (t) => {
    const r = readRequest(t, u, ws.objectives, ws.rules, NAME)
    return { type: r.request_type, objective: r.objective, lean: r.implied_risk, assets: r.known.map((a) => a.ticker), unknown: r.unknown, trades: r.requested_trades.map((x) => ({ ticker: x.ticker, side: x.side, usd: x.usd || undefined, percent: x.percent || undefined })) }
  },
  answer: (t) => {
    const s = scanAnswer(t, u, ws.rules, NAME)
    return { stances: Object.fromEntries([...stanceByTicker(s)].map(([k, v]) => [k, v.stance])), unknownBuys: s.unknownBuys.map((x) => x.name) }
  },
}
const nlpR: Reader = {
  name: 'NLP (now)',
  request: (t) => {
    const r = readRequestNlp(t, u, ws.objectives, ws.rules, NAME)
    return { type: r.request_type, objective: r.objective, lean: r.implied_risk, assets: r.known.map((a) => a.ticker), unknown: r.unknown, trades: r.requested_trades.map((x) => ({ ticker: x.ticker, side: x.side, usd: x.usd || undefined, percent: x.percent || undefined })) }
  },
  answer: (t) => {
    const s = scanAnswerNlp(t, u, ws.rules, NAME)
    return { stances: Object.fromEntries([...stanceByTicker(s)].map(([k, v]) => [k, v.stance])), unknownBuys: s.unknownBuys.map((x) => x.name) }
  },
}
const llms = Array.from({ length: RUNS }, (_, k) => llmReader(k))

// ---------- report ----------

const lines: string[] = []
const out = (s = '') => {
  lines.push(s)
  console.log(s)
}
const p = (t: Tally) => (t.n ? (t.correct / t.n) * 100 : 0)
const llmCell = (vals: number[]) => {
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  return lo === hi ? `${mean.toFixed(0)}%` : `${mean.toFixed(0)}% (runs ${lo.toFixed(0)}–${hi.toFixed(0)}%)`
}

const reqField = ['type', 'objective', 'lean', 'assets', 'unknown', 'trades', 'exact'] as const
for (const [title, cases] of [
  ['Requests · dev', REQUESTS_DEV],
  ['Requests · held-out test', REQUESTS_TEST],
] as [string, RequestCase[]][]) {
  const [r, n] = [scoreRequests(rules, cases), scoreRequests(nlpR, cases)]
  const l = llms.map((x) => scoreRequests(x, cases))
  out(`\n## ${title} (${cases.length})\n`)
  out('| Field | Rules (before) | NLP (now) | Gemini parser (old approach) |')
  out('|---|---|---|---|')
  for (const f of reqField) out(`| ${f === 'exact' ? '**all fields right**' : f} | ${p(r[f]).toFixed(0)}% | ${p(n[f]).toFixed(0)}% | ${llmCell(l.map((s) => p(s[f])))} |`)
}

for (const [title, cases] of [
  ['Answers · dev', ANSWERS_DEV],
  ['Answers · held-out test', ANSWERS_TEST],
  ['Answers · real Gemini (held-out)', ANSWERS_GEMINI],
] as [string, AnswerCase[]][]) {
  const [r, n] = [scoreAnswers(rules, cases), scoreAnswers(nlpR, cases)]
  const l = llms.map((x) => scoreAnswers(x, cases))
  out(`\n## ${title} (${cases.length})\n`)
  out('| Measure | Rules (before) | NLP (now) | Gemini reader (built for this test) |')
  out('|---|---|---|---|')
  out(`| stance per asset | ${p(r.stance).toFixed(0)}% | ${p(n.stance).toFixed(0)}% | ${llmCell(l.map((s) => p(s.stance)))} |`)
  out(`| **whole answer right** | ${p(r.exact).toFixed(0)}% | ${p(n.exact).toFixed(0)}% | ${llmCell(l.map((s) => p(s.exact)))} |`)
  for (const [k, label] of [
    ['falseBuy', 'false "buy"'],
    ['missedAvoid', 'missed "avoid"'],
    ['falseAvoid', 'false "avoid"'],
    ['spurious', 'assets not in the text'],
  ] as const) out(`| ${label} | ${r[k]} | ${n[k]} | ${l.map((s) => s[k]).join(' / ')} |`)
}

// Consistency: does the same text give the same reading on every run?
const reqKey = (o: ReqOut) => JSON.stringify([o.type, o.objective, o.lean, [...o.assets].sort(), [...o.unknown].map((x) => x.toLowerCase()).sort(), o.trades.map((t) => `${t.ticker}${t.side}${t.usd ?? ''}${t.percent ?? ''}`).sort()])
const ansKey = (o: AnsOut) => JSON.stringify([Object.entries(o.stances).sort(), [...o.unknownBuys].map((x) => x.toLowerCase()).sort()])
const unstableReq = reqTexts.filter((t) => new Set(llms.map((x) => reqKey(x.request(t)))).size > 1)
const unstableAns = ansTexts.filter((t) => new Set(llms.map((x) => ansKey(x.answer(t)))).size > 1)
out(`\n## Consistency (each text read ${RUNS} times, temperature 0)\n`)
out('| | NLP (now) | Gemini |')
out('|---|---|---|')
out(`| requests read differently across runs | 0 of ${reqTexts.length} | ${unstableReq.length} of ${reqTexts.length} |`)
out(`| answers read differently across runs | 0 of ${ansTexts.length} | ${unstableAns.length} of ${ansTexts.length} |`)
for (const t of [...unstableReq.slice(0, 6)]) out(`- request “${t}”: ${llms.map((x) => reqKey(x.request(t))).join('  vs  ')}`)
for (const t of [...unstableAns.slice(0, 6)]) out(`- answer “${t.slice(0, 90)}…”: ${llms.map((x) => ansKey(x.answer(t))).join('  vs  ')}`)

// Prompt injection
out('\n## Prompt injection (hidden instructions in the text)\n')
out('| Text | Rules (before) | NLP (now) | Gemini (3 runs) |')
out('|---|---|---|---|')
const okR = (rd: Reader, c: RequestCase) => scoreRequests(rd, [c]).exact.correct === 1
const okA = (rd: Reader, c: AnswerCase) => scoreAnswers(rd, [c]).exact.correct === 1
const mark = (b: boolean) => (b ? 'right' : 'WRONG')
for (const c of REQUESTS_INJECTION) out(`| request: “${c.text}” | ${mark(okR(rules, c))} | ${mark(okR(nlpR, c))} | ${llms.map((x) => mark(okR(x, c))).join(', ')} |`)
for (const c of ANSWERS_INJECTION) out(`| answer: “${c.text}” | ${mark(okA(rules, c))} | ${mark(okA(nlpR, c))} | ${llms.map((x) => mark(okA(x, c))).join(', ')} |`)
const injFail = [...REQUESTS_INJECTION.flatMap((c) => scoreRequests(llms[0], [c]).failures), ...ANSWERS_INJECTION.flatMap((c) => scoreAnswers(llms[0], [c]).failures), ...REQUESTS_INJECTION.flatMap((c) => scoreRequests(nlpR, [c]).failures), ...ANSWERS_INJECTION.flatMap((c) => scoreAnswers(nlpR, [c]).failures)]
if (injFail.length) {
  out('\nWhat went wrong on the injection cases (NLP and Gemini run 1):')
  for (const f of injFail) out(`- ${f.field}: want \`${f.want}\`, got \`${f.got}\` · “${f.text.slice(0, 70)}…”`)
}

// Speed
const ms = Object.values(cache).flat().map((x) => x.ms).sort((a, b) => a - b)
out(`\n## Speed\n\nGemini: median ${ms[Math.floor(ms.length / 2)]} ms per reading, slowest ${ms.at(-1)} ms (${ms.length} calls). NLP: about 3–5 ms, on the device, no network.`)

writeFileSync('eval/llm-report.md', `# LLM reader vs NLP reader\n\nModel ${MODEL}, temperature 0, ${RUNS} runs per text. Requests use the exact parser Clario had before it went AI-free; answers use an LLM reader built for this test.\n${lines.join('\n')}\n`)
