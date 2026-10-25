// Compares Clario's text readers on the gold sets.
// Run: npx tsx eval/run.ts            (summary for all sets, failures for the dev set)
//      npx tsx eval/run.ts --all      (also list failures on the held-out sets; writes eval/report.md)
import { readFileSync, writeFileSync } from 'node:fs'
import { sanitizeWorkspace } from '../src/engine/config'
import { readRequest, scanAnswer, stanceByTicker } from '../src/engine/rules'
import { ANSWERS_DEV } from './answers.dev'
import { ANSWERS_GEMINI } from './answers.gemini'
import { ANSWERS_TEST } from './answers.test'
import { REQUESTS_DEV } from './requests.dev'
import { REQUESTS_TEST } from './requests.test'
import { scoreAnswers, scoreRequests, type AnsScore, type Reader, type ReqScore, type Tally } from './score'

const ws = sanitizeWorkspace({})
const u = ws.universe
const NAME = 'Maya'

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

const readers: Reader[] = [rules]
try {
  const nlp = await import('../src/engine/nlp')
  readers.push({
    name: 'NLP (after)',
    request: (t) => {
      const r = nlp.readRequestNlp(t, u, ws.objectives, ws.rules, NAME)
      return { type: r.request_type, objective: r.objective, lean: r.implied_risk, assets: r.known.map((a) => a.ticker), unknown: r.unknown, trades: r.requested_trades.map((x) => ({ ticker: x.ticker, side: x.side, usd: x.usd || undefined, percent: x.percent || undefined })) }
    },
    answer: (t) => {
      const s = nlp.scanAnswerNlp(t, u, ws.rules, NAME)
      return { stances: Object.fromEntries([...stanceByTicker(s)].map(([k, v]) => [k, v.stance])), unknownBuys: s.unknownBuys.map((x) => x.name) }
    },
  })
} catch (e) {
  if (!String(e).includes('Cannot find module')) throw e
}

const all = process.argv.includes('--all')
const pct = (t: Tally) => (t.n ? `${((t.correct / t.n) * 100).toFixed(0)}% (${t.correct}/${t.n})` : '-')
const lines: string[] = []
const out = (s = '') => {
  lines.push(s)
  console.log(s)
}

const reqSets = [
  ['Requests · dev', REQUESTS_DEV, true],
  ['Requests · held-out test', REQUESTS_TEST, false],
] as const
const ansSets = [
  ['Answers · dev', ANSWERS_DEV, true],
  ['Answers · held-out test', ANSWERS_TEST, false],
  ['Answers · real Gemini (held-out)', ANSWERS_GEMINI, false],
] as const

for (const [title, cases, dev] of reqSets) {
  const scores = readers.map((r) => scoreRequests(r, [...cases]))
  out(`\n## ${title} (${cases.length} requests)\n`)
  out(`| Field | ${readers.map((r) => r.name).join(' | ')} |`)
  out(`|---|${readers.map(() => '---|').join('')}`)
  for (const f of ['type', 'objective', 'lean', 'assets', 'unknown', 'trades', 'exact'] as (keyof Omit<ReqScore, 'failures'>)[]) {
    out(`| ${f === 'exact' ? '**all fields right**' : f} | ${scores.map((s) => pct(s[f]) + (s[f].abstained ? `, ${s[f].abstained} no answer` : '')).join(' | ')} |`)
  }
  if (dev || all) failures(scores.map((s) => s.failures))
}

for (const [title, cases, dev] of ansSets) {
  const scores = readers.map((r) => scoreAnswers(r, [...cases]))
  out(`\n## ${title} (${cases.length} answers)\n`)
  out(`| Measure | ${readers.map((r) => r.name).join(' | ')} |`)
  out(`|---|${readers.map(() => '---|').join('')}`)
  out(`| stance per asset | ${scores.map((s) => pct(s.stance)).join(' | ')} |`)
  for (const [k, label] of [
    ['falseBuy', 'false "buy" (dangerous)'],
    ['missedAvoid', 'missed "avoid" (dangerous)'],
    ['falseAvoid', 'false "avoid"'],
    ['spurious', 'assets not in the text'],
  ] as [keyof AnsScore, string][]) out(`| ${label} | ${scores.map((s) => s[k] as number).join(' | ')} |`)
  out(`| unknown names | ${scores.map((s) => pct(s.unknown)).join(' | ')} |`)
  out(`| **whole answer right** | ${scores.map((s) => pct(s.exact)).join(' | ')} |`)
  if (dev || all) failures(scores.map((s) => s.failures))
}

// End to end: the "Text matches trades" check on the real Gemini answers, from each reader vs from the gold labels.
{
  const raw = JSON.parse(readFileSync(new URL('./gemini-answers.json', import.meta.url), 'utf8')) as { trades: string[] }[]
  const status = (stances: Record<string, string | string[]>, trades: string[]) => {
    const buys = trades.filter((t) => t.startsWith('BUY ')).map((t) => t.split(' ')[1])
    const is = (tk: string, st: string) => [stances[tk]].flat().includes(st)
    const textBuys = Object.keys(stances).filter((tk) => is(tk, 'buy') && !is(tk, 'mention'))
    if (textBuys.some((tk) => !buys.includes(tk)) || buys.some((tk) => is(tk, 'avoid'))) return 'fail'
    if (buys.some((tk) => !(tk in stances))) return 'warn'
    return 'pass'
  }
  out(`
## End to end: “Text matches trades” check on the real Gemini answers
`)
  out(`| | ${readers.map((r) => r.name).join(' | ')} |`)
  out(`|---|${readers.map(() => '---|').join('')}`)
  const rows = readers.map((r) => {
    let same = 0
    const wrong: string[] = []
    ANSWERS_GEMINI.forEach((c, i) => {
      const want = status(c.stances, raw[i].trades)
      const got = status(r.answer(c.text).stances, raw[i].trades)
      if (want === got) same++
      else wrong.push(`#${i} ${want}→${got}`)
    })
    return { same, wrong }
  })
  out(`| check result matches the gold reading | ${rows.map((x) => `${x.same}/${ANSWERS_GEMINI.length}`).join(' | ')} |`)
  out(`| wrong results | ${rows.map((x) => x.wrong.join(', ') || 'none').join(' | ')} |`)

  // Simulated advisors on the held-out hand-written answers: trades built from the gold labels.
  const cases = ANSWERS_TEST
  const goldBuys = (c: (typeof cases)[number]) => Object.keys(c.stances).filter((tk) => [c.stances[tk]].flat().every((x) => x === 'buy'))
  const goldAvoids = (c: (typeof cases)[number]) => Object.keys(c.stances).filter((tk) => [c.stances[tk]].flat().includes('avoid'))
  const honest = cases.filter((c) => goldBuys(c).length)
  const contra = cases.filter((c) => goldAvoids(c).length)
  out(`
## End to end: “Text matches trades” with simulated advisors (held-out hand-written answers)
`)
  out(`| Scenario | ${readers.map((r) => r.name).join(' | ')} |`)
  out(`|---|${readers.map(() => '---|').join('')}`)
  const run = (cs: typeof cases, trades: (c: (typeof cases)[number]) => string[], want: string) =>
    readers.map((r) => cs.filter((c) => status(r.answer(c.text).stances, trades(c)) === want).length)
  const h = run(honest, (c) => goldBuys(c).map((tk) => `BUY ${tk} 1`), 'pass')
  const x = run(contra, (c) => [...goldBuys(c), ...goldAvoids(c)].map((tk) => `BUY ${tk} 1`), 'fail')
  out(`| honest advisor (trades = what the text recommends): check correctly passes | ${h.map((n) => `${n}/${honest.length}`).join(' | ')} |`)
  out(`| contradicting advisor (also buys what the text warns against): check correctly fails | ${x.map((n) => `${n}/${contra.length}`).join(' | ')} |`)
}

function failures(per: { text: string; field: string; want: string; got: string }[][]) {
  per.forEach((fs, i) => {
    if (!fs.length) return
    out(`\n<details><summary>${readers[i].name}: ${fs.length} errors</summary>\n`)
    for (const f of fs) out(`- ${f.field}: want \`${f.want}\`, got \`${f.got}\` · “${f.text.length > 110 ? f.text.slice(0, 110) + '…' : f.text}”`)
    out('\n</details>')
  })
}

const HEADER = `# Clario reader evaluation

Compares the original keyword reader (src/engine/rules.ts) with the NLP reader (src/engine/nlp.ts).
Both are deterministic and use the same editable keyword lists; the NLP reader adds tokenising, lemmas,
clause splitting, NegEx negation scope, verb–object attachment, modality, coreference and number words.

How the sets were made
- **dev**: used while building and tuning the NLP reader. Its scores are optimistic by design.
- **held-out test**: written before the NLP reader existed and never used for tuning. One label was corrected
  before the NLP reader first ran on it ("don't add to it" is *avoid* under the labelling rules in types.ts).
- **real Gemini**: 15 answers from the live advisor (default workspace), labelled by hand before either reader
  ran on them. They were read while labelling, so they are not blind to the reader's author.
- All labels were written by one person (the reader's author). Treat the numbers as an honest indication,
  not a benchmark; a larger set labelled by someone else is the next step.

Regenerate: npx tsx eval/run.ts --all. Determinism, crash and speed checks: npx tsx eval/robust.ts.
`
if (all) writeFileSync('eval/report.md', `${HEADER}${lines.join('\n')}\n`)
