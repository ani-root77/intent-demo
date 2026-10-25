// HTTP routes. Used by the Vite dev server (as middleware) and by server/index.ts (standalone).
//
//   GET  /api/health               whether a Gemini key is configured
//   GET  /api/models               Gemini models this key can use
//   GET  /api/workspace            the shared settings everyone uses (profiles, assets, objectives, settings)
//   PUT  /api/workspace            save the shared settings (team code only)
//   POST /api/run                  full live loop for the playground
//   POST /api/advise               portal: one question → Clario's parse + the AI advisor's answer
//   POST /api/advise/revise        portal feedback loop: the advisor revises its answer using Clario's feedback
//   POST /api/code                 check an access code: judge (skips the public limits) or team (also the lab)
//
// The routes that call Gemini are limited per visitor, per network and site-wide, and identical questions on the
// same settings share one answer (server/guard.ts).
//   POST /v1/intents               parse + lock an intent for any external agent
//   POST /v1/intents/:id/context   register content the agent was given (always untrusted)
//   GET  /v1/intents/:id           the locked intent and its attempts so far
//   POST /v1/verify                verify one proposal against a locked intent

import type { IncomingMessage, ServerResponse } from 'node:http'
import { sanitizeWorkspace, type Workspace } from '../src/engine/config'
import { findObjective } from '../src/engine/objectives'
import { GeminiError, JUDGE_FALLBACKS, keyConfigured, listModels, PUBLIC_FALLBACKS } from './gemini'
import { admit, admitCodeAttempt, BusyError, cached, cacheKey, callerOf, normalizeQuestion, roleOfCode, type Caller } from './guard'
import { readRequestNlp } from '../src/engine/nlp'
import { advise, reviseAdvice } from './advise'
import { runLive } from './run'
import { addContext, createSession, getSession, verifyInSession } from './sessions'
import { isStage, stageAdvice, stageRevision } from './stage'
import { getShared, setShared } from './store'

export const isApiPath = (url = '') => url.startsWith('/api/') || url.startsWith('/v1/')

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage, limit = 64_000): Promise<Record<string, unknown>> {
  let size = 0
  const chunks: Buffer[] = []
  // Cloud Functions has already read the body; it is available as rawBody.
  const raw = (req as IncomingMessage & { rawBody?: Buffer }).rawBody
  if (raw) {
    if (raw.length > limit) throw new HttpError(413, 'Request body too large')
    chunks.push(raw)
  } else for await (const c of req) {
    size += (c as Buffer).length
    if (size > limit) throw new HttpError(413, 'Request body too large')
    chunks.push(c as Buffer)
  }
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    if (v && typeof v === 'object' && !Array.isArray(v)) return v
  } catch {
    /* fall through */
  }
  throw new HttpError(400, 'Body must be a JSON object')
}

const text = (v: unknown, name: string, max: number) => {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${name} is required`)
  return v.trim().slice(0, max)
}
const kindOf = (v: unknown) => (v === 'mandate' ? 'mandate' : 'request') as 'request' | 'mandate'
const fallbacksFor = (c: Caller) => (c.lane === 'public' ? PUBLIC_FALLBACKS : JUDGE_FALLBACKS)

/**
 * The settings a request runs on. The team's lab uses what it sends (it may be trying an edit). Everyone else gets
 * the shared settings, plus their own copy of the asked profile's risk level and limits (from a risk review they took).
 */
async function workspaceFor(caller: Caller, raw: unknown, profileId?: string): Promise<Workspace> {
  if (caller.lane === 'team' && raw) return sanitizeWorkspace(raw)
  const { ws } = await getShared()
  const mine = raw && profileId ? sanitizeWorkspace(raw).profiles.find((p) => p.id === profileId) : undefined
  if (!mine) return ws
  return { ...ws, profiles: ws.profiles.map((p) => (p.id === profileId ? { ...p, investor: { ...p.investor, riskProfile: mine.investor.riskProfile, preference: mine.investor.preference }, policy: mine.policy } : p)) }
}

/** Everything the advisor's answer depends on, so a cached answer is only reused for the same settings. */
function adviceKey(kind: string, ws: Workspace, profileId: string, question: string, extra: unknown = null) {
  const p = ws.profiles.find((x) => x.id === profileId)
  return cacheKey({ v: 1, kind, q: normalizeQuestion(question), profile: p ? { ...p, history: [] } : profileId, universe: ws.universe, market: ws.market, objectives: ws.objectives, agent: ws.agent, portal: ws.portal, extra })
}

export async function handle(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname
    const m = req.method ?? 'GET'

    if (m === 'GET' && path === '/api/health') return send(res, 200, { ok: true, keyConfigured: keyConfigured() })

    if (m === 'GET' && path === '/api/models') return send(res, 200, { models: await listModels() })

    if (m === 'GET' && path === '/api/workspace') {
      const s = await getShared()
      return send(res, 200, { ...s.ws, rev: s.rev })
    }

    if (m === 'PUT' && path === '/api/workspace') {
      if (callerOf(req).lane !== 'team') throw new HttpError(403, 'Only the team can change the settings.')
      const s = await setShared(await readJson(req, 2_000_000))
      return send(res, 200, { ...s.ws, rev: s.rev })
    }

    if (m === 'POST' && (path === '/api/code' || path === '/api/judge')) {
      admitCodeAttempt(callerOf(req).ip)
      const b = await readJson(req)
      const role = roleOfCode(typeof b.code === 'string' ? b.code : '')
      return role ? send(res, 200, { ok: true, role }) : send(res, 401, { error: 'That code is not right.' })
    }

    if (m === 'POST' && path === '/api/run') {
      const caller = callerOf(req)
      if (caller.lane !== 'team') throw new HttpError(403, 'The Clario lab is only open to the team.')
      admit(caller, 4)
      const b = await readJson(req, 2_000_000)
      const ext = b.external as Record<string, unknown> | undefined
      const opts = {
        workspace: await workspaceFor(caller, b.workspace),
        profileId: text(b.profileId, 'profileId', 60),
        text: text(b.text, 'text', 500),
        kind: kindOf(b.kind),
        external: ext && typeof ext.text === 'string' && ext.text.trim() ? { source: String(ext.source ?? 'External source').slice(0, 120), text: ext.text.trim().slice(0, 4000) } : undefined,
        agentName: typeof b.agentName === 'string' && b.agentName.trim() ? b.agentName.slice(0, 80) : 'AI agent',
        styleId: typeof b.styleId === 'string' ? b.styleId : '',
        objective: typeof b.objective === 'string' ? b.objective : undefined,
      }
      if (b.stream !== true) return send(res, 200, await runLive(opts))
      // Stream a snapshot after every step as newline-delimited JSON.
      res.statusCode = 200
      res.setHeader('content-type', 'application/x-ndjson; charset=utf-8')
      res.setHeader('cache-control', 'no-cache')
      try {
        const line = (o: unknown) => res.write(`${JSON.stringify(o)}\n`)
        const final = await runLive(opts, (snap) => line({ run: snap }))
        line({ run: final })
      } catch (e) {
        res.write(`${JSON.stringify({ error: (e as Error).message })}\n`)
      }
      return res.end()
    }

    if (m === 'POST' && path === '/api/advise/revise') {
      const b = await readJson(req, 2_000_000)
      const caller = callerOf(req)
      const [profileId, question, previous, feedback] = [text(b.profileId, 'profileId', 60), text(b.question, 'question', 500), text(b.previous, 'previous', 4000), b.feedback ?? {}]
      if (isStage(profileId, question)) {
        const staged = await stageRevision(question, previous)
        if (staged) {
          if (caller.lane === 'public') admit(caller)
          return send(res, 200, staged)
        }
      }
      const ws = await workspaceFor(caller, b.workspace, profileId)
      const { value } = await cached(adviceKey('revise', ws, profileId, question, { previous, feedback }), () => reviseAdvice(ws, profileId, question, previous, feedback, fallbacksFor(caller)), () => admit(caller))
      return send(res, 200, value)
    }

    if (m === 'POST' && path === '/api/advise') {
      const b = await readJson(req, 2_000_000)
      const caller = callerOf(req)
      const [profileId, question] = [text(b.profileId, 'profileId', 60), text(b.question, 'question', 500)]
      const ws = await workspaceFor(caller, b.workspace, profileId)
      if (isStage(profileId, question)) {
        if (caller.lane === 'public') admit(caller)
        const style = ws.agent.styles.find((x) => x.id === ws.portal.advisorStyleId)?.label ?? ''
        return send(res, 200, await stageAdvice(question, profileId, style))
      }
      const { value, hit } = await cached(adviceKey('advise', ws, profileId, question), () => advise(ws, profileId, question, fallbacksFor(caller)), () => admit(caller))
      // A shared answer gets its own id and time, so each visitor's history and drift detection stay their own.
      const now = Date.now()
      return send(res, 200, hit ? { ...value, id: `adv_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date(now).toISOString(), question, cached: true } : value)
    }

    if (m === 'POST' && path === '/v1/intents') {
      const b = await readJson(req)
      const { ws } = await getShared()
      const profile = ws.profiles.find((p) => p.id === b.profile_id) ?? ws.profiles[0]
      const said = text(b.text, 'text', 500)
      const manual = findObjective(ws.objectives, b.objective)
      const rd = manual ? null : readRequestNlp(said, ws.universe, ws.objectives, ws.rules, profile.investor.name)
      const parsed = manual ? { objective: manual.id, restated: 'Objective chosen by the investor.' } : { objective: rd!.objective ?? 'unclear', restated: rd!.evidence.join(' · ') || 'No rule matched.' }
      if (parsed.objective === 'unclear') return send(res, 422, { error: 'unclear_intent', detail: 'Clario’s rules could not tell the goal of this request. Send it again with an explicit "objective" id.', objectives: ws.objectives.map((o) => ({ id: o.id, label: o.label })) })
      const s = createSession({
        kind: kindOf(b.kind),
        text: said,
        objective: parsed.objective,
        restated: parsed.restated,
        profile,
        cfg: { universe: ws.universe, objectives: ws.objectives, twin: ws.twin },
        parsedBy: manual ? 'investor (manual)' : 'Clario NLP reader (no AI)',
      })
      return send(res, 201, { intent: s.intent, policy: s.policy })
    }

    const ctx = path.match(/^\/v1\/intents\/([\w-]+)\/context$/)
    if (m === 'POST' && ctx) {
      const s = getSession(ctx[1])
      if (!s) throw new HttpError(404, 'Unknown intent')
      const b = await readJson(req)
      addContext(s, String(b.source ?? ''), text(b.text, 'text', 4000))
      return send(res, 201, { context_items: s.context.length })
    }

    const one = path.match(/^\/v1\/intents\/([\w-]+)$/)
    if (m === 'GET' && one) {
      const s = getSession(one[1])
      if (!s) throw new HttpError(404, 'Unknown intent')
      return send(res, 200, {
        intent: s.intent,
        attempts: s.attempts,
        closed: s.closed,
        decisions: s.verifications.map((v) => ({ proposal_id: v.proposal.id, decision: v.decision })),
      })
    }

    if (m === 'POST' && path === '/v1/verify') {
      const b = await readJson(req)
      const s = getSession(b.intent_id)
      if (!s) throw new HttpError(404, 'Unknown intent_id')
      const r = verifyInSession(s, b.proposal, typeof b.agent === 'string' ? b.agent : 'External agent')
      if (!r.ok) return send(res, r.status, { error: 'invalid_proposal', details: r.errors })
      const v = r.verification
      return send(res, 200, {
        proposal_id: v.proposal.id,
        decision: v.decision,
        reason: v.reason,
        checks: v.checks.map(({ meter: _meter, ...c }) => c),
        goal_likelihood: { before: v.twinBefore.successPct, after: v.twinAfter.successPct },
        feedback: r.feedback ?? null,
      })
    }

    throw new HttpError(404, `No route for ${m} ${path}`)
  } catch (e) {
    if (e instanceof BusyError) {
      res.setHeader('retry-after', String(e.retryAfter))
      return send(res, 429, { error: e.message, busy: true, retryAfter: e.retryAfter })
    }
    const status = e instanceof HttpError || e instanceof GeminiError ? e.status : 500
    if (status === 500) console.error(e)
    send(res, status, { error: (e as Error).message, ...(status === 503 ? { busy: true } : {}) })
  }
}
