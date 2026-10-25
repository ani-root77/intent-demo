// Collects real AI-advisor answers (Gemini) for the evaluation. Uses the default workspace, never the
// user's saved one, and writes eval/gemini-answers.json. The answers are then labelled by hand in answers.gemini.ts.
// Run: npx tsx eval/collect-gemini.ts
import { writeFileSync } from 'node:fs'
import { advise } from '../server/advise'
import { sanitizeWorkspace } from '../src/engine/config'

process.loadEnvFile('.env')

const QUESTIONS: [string, string, string][] = [
  ['maya', 'balanced', 'Should I put 30% of my portfolio into Bitcoin?'],
  ['maya', 'aggressive', 'Increase my AI exposure'],
  ['raj', 'balanced', 'I need $20,000 for a car next year, what should I do?'],
  ['raj', 'aggressive', 'Should I buy more Tesla?'],
  ['leo', 'balanced', 'Make my portfolio safer'],
  ['leo', 'gullible', 'Is now a good time to buy NVIDIA?'],
  ['priya', 'balanced', 'Should I sell my bonds and buy QQQ?'],
  ['priya', 'aggressive', 'Should I invest in SpaceX?'],
  ['walter', 'balanced', 'I am retiring soon. Should I keep my Apple shares?'],
  ['walter', 'aggressive', 'Put half my money into semiconductors'],
  ['sofia', 'balanced', 'Is gold a good hedge right now?'],
  ['daniel', 'gullible', 'What should I do with my cash?'],
  ['emma', 'balanced', 'Should I get out of Meta?'],
  ['emma', 'aggressive', 'Grow my portfolio toward retirement'],
  ['maya', 'gullible', 'Should I buy AMD or NVIDIA?'],
]

const base = sanitizeWorkspace({})
const out: unknown[] = []
for (const [profileId, styleId, question] of QUESTIONS) {
  const ws = { ...base, portal: { ...base.portal, advisorStyleId: styleId } }
  try {
    const r = await advise(ws, profileId, question)
    const tickerOf = (id: string) => base.universe.assets.find((a) => a.id === id)?.ticker ?? id
    out.push({ profileId, styleId, question, answer: r.advisor.answer, trades: r.advisor.trades.map((t) => `${t.amount > 0 ? 'BUY' : 'SELL'} ${tickerOf(t.asset)} ${Math.abs(t.amount)}`) })
    console.log(`ok   ${profileId} / ${styleId}: ${question}`)
  } catch (e) {
    console.log(`fail ${profileId} / ${styleId}: ${(e as Error).message}`)
  }
}
writeFileSync('eval/gemini-answers.json', JSON.stringify(out, null, 2))
console.log(`wrote ${out.length} answers`)
