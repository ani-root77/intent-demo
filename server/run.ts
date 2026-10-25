// The live loop: parse -> lock -> agent proposes -> validate -> verify -> feedback -> revise.
// Records every step as an event so the playground can replay and animate it.

import type { Workspace } from '../src/engine/config'
import type { Decision } from '../src/engine/guard'
import { findObjective } from '../src/engine/objectives'
import type { LiveRun, LlmCall, RunEvent } from '../src/engine/timeline'
import { agentPropose } from './agent'
import { GeminiError } from './gemini'
import { readRequestNlp } from '../src/engine/nlp'
import { addContext, createSession, verifyInSession } from './sessions'

export interface RunRequest {
  workspace: Workspace
  profileId: string
  text: string
  kind: 'request' | 'mandate'
  external?: { source: string; text: string }
  agentName: string
  styleId: string
  /** Set when the investor picks the objective themselves. Skips Clario’s rule reading. */
  objective?: string
}

/** `emit` receives a snapshot after every step, for streaming to the browser. */
export async function runLive(req: RunRequest, emit?: (snapshot: LiveRun) => void): Promise<LiveRun> {
  const t0 = Date.now()
  const ws = req.workspace
  const profile = ws.profiles.find((p) => p.id === req.profileId)
  if (!profile) throw new GeminiError(`Unknown profile "${req.profileId}"`, 400)
  const style = ws.agent.styles.find((s) => s.id === req.styleId) ?? ws.agent.styles[0]
  const cfg = { universe: ws.universe, objectives: ws.objectives, twin: ws.twin }

  const events: RunEvent[] = [{ t: 'intent', kind: req.kind, text: req.text }]
  const calls: LlmCall[] = []
  let verifs: LiveRun['verifications'] = []
  let pending: LiveRun['pending'] = null
  const result = (final: LiveRun['final'], verifications: LiveRun['verifications'] = verifs): LiveRun => ({
    id: `run_${t0.toString(36)}`,
    profileId: profile.id,
    agentName: req.agentName,
    style: style?.label ?? '',
    events,
    calls,
    verifications,
    final,
    done: final !== 'RUNNING',
    pending: final === 'RUNNING' ? pending : null,
    totalMs: Date.now() - t0,
  })
  const add = (e: RunEvent) => {
    events.push(e)
    pending = null
    emit?.(result('RUNNING'))
  }
  const waitFor = (who: 'agent') => {
    pending = who
    emit?.(result('RUNNING'))
  }
  emit?.(result('RUNNING'))

  let objective: string
  let restated: string
  let parsedBy: string
  if (findObjective(ws.objectives, req.objective)) {
    objective = req.objective as string
    restated = 'Objective chosen by the investor.'
    parsedBy = 'investor (manual)'
  } else {
    // Clario's rules read the request (no AI). If they can't tell the goal, the investor picks it.
    const rd = readRequestNlp(req.text, ws.universe, ws.objectives, ws.rules, profile.investor.name)
    const why = rd.evidence.join(' · ') || 'No rule matched.'
    add({ t: 'parse', objective: rd.objective ?? 'unclear', restated: why, evidence: rd.evidence })
    if (!rd.objective) {
      add({ t: 'unclear', restated: why })
      return result('UNCLEAR')
    }
    objective = rd.objective
    restated = why
    parsedBy = 'Clario NLP reader (no AI)'
  }

  const s = createSession({ kind: req.kind, text: req.text, objective, restated, profile, cfg, parsedBy })
  verifs = s.verifications
  add({ t: 'lock', intent: { ...s.intent } })
  if (req.external?.text) {
    const item = addContext(s, req.external.source, req.external.text)
    add({ t: 'context', source: item.source, text: item.text })
  }

  let lastFeedback: unknown
  let final: Decision = 'HUMAN_REVIEW'
  while (!s.closed) {
    let repairErrors: string[] | undefined
    let ok = false
    for (let r = 0; r <= ws.agent.maxRepairs; r++) {
      waitFor('agent')
      const call = await agentPropose({
        name: req.agentName,
        stylePrompt: style?.prompt ?? '',
        settings: ws.agent,
        cfg,
        investor: s.investor,
        policy: s.policy,
        kind: s.kind,
        context: s.context,
        feedback: lastFeedback,
        repairErrors,
      })
      calls.push(call)
      const ci = calls.length - 1
      add({ t: 'propose', call: ci, attempt: s.attempts + 1 })
      const res = call.output === null ? { ok: false as const, status: 422, errors: call.rejected ?? ['No JSON'] } : verifyInSession(s, call.output, req.agentName)
      if (!res.ok) {
        call.rejected = res.errors
        add({ t: 'reject', call: ci, errors: res.errors })
        repairErrors = res.errors
        continue
      }
      ok = true
      const vi = s.verifications.length - 1
      add({ t: 'verify', v: vi })
      if (res.feedback) {
        lastFeedback = res.feedback
        add({ t: 'feedback', v: vi, feedback: res.feedback })
      } else {
        final = res.verification.decision
      }
      break
    }
    if (!ok) {
      // The agent never produced a usable proposal. Treat it as a failure that needs a human.
      final = 'HUMAN_REVIEW'
      break
    }
  }
  events.push({ t: 'outcome', decision: final })
  return result(final)
}
