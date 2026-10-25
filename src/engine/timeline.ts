// The step-by-step record of one live run, produced by the server and replayed by the playground.

import type { buildFeedback, Decision, Verification } from './guard'

export interface LlmCall {
  role: 'parser' | 'agent'
  model: string
  temperature: number
  system: string
  prompt: string
  raw: string
  output: unknown
  ms: number
  /** Set when the output was rejected (wrong format, or failed proposal validation). */
  rejected?: string[]
}

export type RunEvent =
  | { t: 'intent'; kind: 'request' | 'mandate'; text: string }
  | { t: 'parse'; objective: string; restated: string; evidence: string[] }
  | { t: 'unclear'; restated: string }
  | { t: 'lock'; intent: Record<string, unknown> }
  | { t: 'context'; source: string; text: string }
  | { t: 'propose'; call: number; attempt: number }
  | { t: 'reject'; call: number; errors: string[] }
  | { t: 'verify'; v: number }
  | { t: 'feedback'; v: number; feedback: ReturnType<typeof buildFeedback> }
  | { t: 'outcome'; decision: Decision }

export interface LiveRun {
  id: string
  profileId: string
  agentName: string
  style: string
  events: RunEvent[]
  calls: LlmCall[]
  verifications: Verification[]
  final: Decision | 'UNCLEAR' | 'RUNNING'
  done: boolean
  /** While streaming: which LLM call is in flight. */
  pending: 'parser' | 'agent' | null
  totalMs: number
}
