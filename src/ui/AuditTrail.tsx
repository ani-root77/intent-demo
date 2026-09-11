import { useEffect, useRef } from 'react'
import type { Flow } from '../engine/scenarios'
import { DECISION, Card, SectionTitle } from './theme'
import type { Resolution } from './Feed'

function fnv1a(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const ACTOR_STYLE: Record<string, string> = {
  Investor: 'bg-slate-800 text-white',
  INTENT: 'bg-emerald-600 text-white',
  Agent: 'bg-indigo-600 text-white',
  Untrusted: 'bg-rose-600 text-white',
}

export function AuditTrail({ flow, index, agent, resolution }: { flow: Flow; index: number; agent: string; resolution: Resolution }) {
  const rows: { actor: string; text: string; tag?: string }[] = []
  for (const s of flow.steps.slice(0, index + 1)) {
    switch (s.kind) {
      case 'intent':
        rows.push({ actor: 'Investor', text: `Intent received: “${flow.scenario.intent.text}”` })
        break
      case 'parse':
        rows.push({ actor: 'INTENT', text: 'Intent locked as structured policy: objective + 5 hard constraints (agent: read-only)' })
        break
      case 'context':
        rows.push({ actor: 'Untrusted', text: `External content entered agent context: ${flow.scenario.injected?.source}` })
        break
      case 'propose':
        rows.push({ actor: 'Agent', text: `${agent} submitted proposal v${s.i + 1}: ${flow.verifications[s.i].proposal.summary}` })
        break
      case 'verify': {
        const v = flow.verifications[s.i]
        const fails = v.checks.filter((c) => c.status === 'fail').length
        rows.push({ actor: 'INTENT', text: `Verified v${s.i + 1}: 8 checks, ${fails} failed. Goal likelihood ${v.twinBefore.successPct.toFixed(0)}% → ${v.twinAfter.successPct.toFixed(0)}%`, tag: v.decision })
        break
      }
      case 'feedback':
        rows.push({ actor: 'INTENT', text: `Structured feedback sent to agent (${flow.feedback[s.i].violations.length} violations, 5 limits). No investment suggested` })
        break
      case 'outcome':
        rows.push({
          actor: 'INTENT',
          text: flow.final === 'ALLOW' ? 'Passed proposal released to the investor for approval' : flow.final === 'BLOCK' ? 'Action blocked before execution. Portfolio unchanged' : 'Revision cap reached. Escalated to the advisor queue',
          tag: flow.final,
        })
        break
    }
  }
  if (resolution === 'approved') rows.push({ actor: 'Investor', text: 'Investor approved the verified proposal (simulated, no real trade)' })
  if (resolution === 'declined') rows.push({ actor: 'Investor', text: 'Investor declined. Nothing executed' })
  if (resolution === 'notified') rows.push({ actor: 'INTENT', text: 'Investor notified of the blocked action' })
  if (resolution === 'escalated') rows.push({ actor: 'INTENT', text: 'Advisor review packet created' })

  let prev = '00000000'
  const chained = rows.map((r, k) => {
    prev = fnv1a(prev + r.actor + r.text)
    const secs = 10 + k * 3
    const time = `14:02:${String(secs % 60).padStart(2, '0')}`.replace(/^14:02/, secs >= 60 ? '14:03' : '14:02')
    return { ...r, hash: prev, time }
  })

  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = boxRef.current
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' })
  }, [chained.length])

  return (
    <Card className="p-4">
      <SectionTitle right={<span className="text-[10px] font-semibold text-slate-400">append-only · each entry hashes the previous one</span>}>Audit trail</SectionTitle>
      <div ref={boxRef} className="scroll-thin max-h-48 overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
            {chained.map((r, k) => (
              <tr key={k} className="border-t border-slate-100 first:border-0">
                <td className="w-20 py-1.5 font-mono text-xs text-slate-400">{r.time}</td>
                <td className="w-24">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${ACTOR_STYLE[r.actor]}`}>{r.actor}</span>
                </td>
                <td className="py-1.5 text-slate-700">
                  {r.text}
                  {r.tag && (
                    <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: DECISION[r.tag as keyof typeof DECISION].hex }}>
                      {DECISION[r.tag as keyof typeof DECISION].label}
                    </span>
                  )}
                </td>
                <td className="hidden w-24 text-right font-mono text-[11px] text-slate-400 md:table-cell">#{r.hash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
