// Stage script for the live demo. One recorded run of real Gemini answers (server/stage-script.json, made by
// eval/stage-record.ts) is replayed whenever the stage question is asked as its profile, so a slow or different AI
// answer can't derail the demo. The reply has the same shape and timing as a live answer. Any other question or
// profile goes to Gemini as normal. Clario's checks, verdict, drift and numbers are computed live from the answer.

import type { AdvisorReply } from '../src/engine/advisory'
import type { LlmCall } from './gemini'
import script from './stage-script.json'

interface Step {
  advisor: AdvisorReply
  calls: LlmCall[]
}
const first = script.first as unknown as Step & { model: string }
const revisions = script.revisions as unknown as Step[]

/** Letters and digits only, so a missed comma or capital still matches. */
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9%$]+/g, ' ').trim().split(' ').filter(Boolean)

/** True when `question` is the stage question, allowing for a typo or two. */
function isStageQuestion(question: string) {
  const want = words(script.question)
  const got = words(question)
  if (!got.length) return false
  const have = new Set(got)
  const shared = want.filter((w) => have.has(w)).length
  return shared / want.length >= 0.85 && got.length <= want.length + 4
}

/** The recorded calls, with the question as this person typed it. */
const asTyped = (calls: LlmCall[], question: string) => calls.map((c) => ({ ...c, prompt: c.prompt.split(script.question).join(question) }))

const pause = (min: number) => new Promise((r) => setTimeout(r, min + Math.random() * 1500))

export const isStage = (profileId: string, question: string) => profileId === script.profileId && isStageQuestion(question)

/** The recorded first answer, shaped like a live one. `style` is the current advisor persona's label. */
export async function stageAdvice(question: string, profileId: string, style: string) {
  const t0 = Date.now()
  await pause(2400)
  return {
    id: `adv_${t0.toString(36)}`,
    at: new Date(t0).toISOString(),
    question,
    profileId,
    advisor: first.advisor,
    calls: asTyped(first.calls, question),
    model: first.model,
    style,
    ms: Date.now() - t0,
  }
}

/** The recorded revision that follows `previous`, or null when `previous` isn't part of the recorded run. */
export async function stageRevision(question: string, previous: string) {
  const chain = [first, ...revisions]
  const i = chain.findIndex((s) => s.advisor.answer.trim() === previous.trim())
  const next = i >= 0 ? chain[i + 1] : undefined
  if (!next) return null
  const t0 = Date.now()
  await pause(2800)
  return { advisor: next.advisor, calls: asTyped(next.calls, question), ms: Date.now() - t0 }
}
