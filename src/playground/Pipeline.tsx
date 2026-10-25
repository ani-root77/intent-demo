import { motion } from 'framer-motion'
import type { LiveRun, RunEvent } from '../engine/timeline'
import { DECISION } from '../ui/theme'

type NodeId = 'investor' | 'parser' | 'lock' | 'feed' | 'agent' | 'validator' | 'verifier' | 'decision'

const W = 1000
const H = 190
const Y = 112
const NODES: Record<NodeId, { x: number; y: number; label: string; sub: string; color: string }> = {
  investor: { x: 60, y: Y, label: 'Investor', sub: 'request / mandate', color: '#0f172a' },
  parser: { x: 195, y: Y, label: 'Rules', sub: 'no AI · read the goal', color: '#0d9488' },
  lock: { x: 330, y: Y, label: 'Intent lock', sub: 'frozen, agent can’t edit', color: '#0d9488' },
  feed: { x: 470, y: 30, label: 'External feed', sub: 'untrusted', color: '#e11d48' },
  agent: { x: 470, y: Y, label: 'AI agent', sub: 'LLM · proposes', color: '#4f46e5' },
  validator: { x: 610, y: Y, label: 'Validator', sub: 'format, holdings', color: '#475569' },
  verifier: { x: 760, y: Y, label: 'Verifier', sub: '8 checks + Twin', color: '#0f172a' },
  decision: { x: 915, y: Y, label: 'Decision', sub: '', color: '#64748b' },
}

type Edge = { from: NodeId; to: NodeId; color: string; curve?: 'below' | 'above' }

/** Which node lights up and which hop a token travels for each event. */
function frame(e: RunEvent | undefined, run: LiveRun): { active: NodeId[]; edge?: Edge; tone?: string } {
  if (!e) return { active: [] }
  switch (e.t) {
    case 'intent':
      return { active: ['investor'], edge: { from: 'investor', to: 'parser', color: '#0f172a' } }
    case 'parse':
      return { active: ['parser'], edge: { from: 'parser', to: 'lock', color: '#7c3aed' } }
    case 'unclear':
      return { active: ['parser', 'investor'], edge: { from: 'parser', to: 'investor', color: '#d97706', curve: 'above' } }
    case 'lock':
      return { active: ['lock'], edge: { from: 'investor', to: 'agent', color: '#0d9488', curve: 'below' } }
    case 'context':
      return { active: ['feed'], edge: { from: 'feed', to: 'agent', color: '#e11d48' } }
    case 'propose':
      return { active: ['agent'], edge: { from: 'agent', to: 'validator', color: '#4f46e5' } }
    case 'reject':
      return { active: ['validator'], edge: { from: 'validator', to: 'agent', color: '#e11d48', curve: 'above' }, tone: '#e11d48' }
    case 'verify': {
      const d = run.verifications[e.v]?.decision
      return { active: ['verifier', 'lock'], edge: { from: 'validator', to: 'verifier', color: '#475569' }, tone: d ? DECISION[d].hex : undefined }
    }
    case 'feedback':
      return { active: ['verifier', 'agent'], edge: { from: 'verifier', to: 'agent', color: '#d97706', curve: 'below' } }
    case 'outcome':
      return { active: ['decision'], edge: { from: 'verifier', to: 'decision', color: DECISION[e.decision].hex }, tone: DECISION[e.decision].hex }
  }
}

function pathOf(e: Edge) {
  const a = NODES[e.from]
  const b = NODES[e.to]
  if (!e.curve) return `M${a.x},${a.y} L${b.x},${b.y}`
  const dy = e.curve === 'below' ? 78 : -62
  return `M${a.x},${a.y} C${a.x},${a.y + dy} ${b.x},${b.y + dy} ${b.x},${b.y}`
}

/** Points along an edge, matching pathOf(), for animating a token along it. */
function pointsOf(e: Edge, n = 24) {
  const a = NODES[e.from]
  const b = NODES[e.to]
  const dy = e.curve === 'below' ? 78 : e.curve === 'above' ? -62 : 0
  const xs: number[] = []
  const ys: number[] = []
  for (let k = 0; k <= n; k++) {
    const t = k / n
    const m = 1 - t
    if (!e.curve) {
      xs.push(a.x + (b.x - a.x) * t)
      ys.push(a.y + (b.y - a.y) * t)
    } else {
      // cubic bezier with control points (a.x, a.y+dy) and (b.x, b.y+dy)
      xs.push(m * m * m * a.x + 3 * m * m * t * a.x + 3 * m * t * t * b.x + t * t * t * b.x)
      ys.push(m * m * m * a.y + 3 * m * m * t * (a.y + dy) + 3 * m * t * t * (b.y + dy) + t * t * t * b.y)
    }
  }
  return { xs, ys }
}

export function Pipeline({ run, idx }: { run: LiveRun; idx: number }) {
  const e = run.events[idx]
  const f = frame(e, run)
  const pending = !run.done && idx === run.events.length - 1 ? run.pending : null
  const hasFeed = run.events.some((x) => x.t === 'context')
  const attempt = run.events.slice(0, idx + 1).filter((x) => x.t === 'verify').length
  const lastDecision = (() => {
    for (let k = idx; k >= 0; k--) {
      const x = run.events[k]
      if (x.t === 'outcome') return x.decision
    }
    return null
  })()

  const base: Edge[] = [
    { from: 'investor', to: 'parser', color: '#cbd5e1' },
    { from: 'parser', to: 'lock', color: '#cbd5e1' },
    { from: 'lock', to: 'agent', color: '#cbd5e1' },
    { from: 'agent', to: 'validator', color: '#cbd5e1' },
    { from: 'validator', to: 'verifier', color: '#cbd5e1' },
    { from: 'verifier', to: 'decision', color: '#cbd5e1' },
    { from: 'verifier', to: 'agent', color: '#fde68a', curve: 'below' },
  ]

  return (
    <svg viewBox={hasFeed ? `0 0 ${W} ${H}` : `0 34 ${W} ${H - 34}`} className="w-full select-none">
      {base.map((b, k) => (
        <path key={k} d={pathOf(b)} fill="none" stroke={b.color} strokeWidth={2} strokeDasharray={b.curve ? '5 5' : undefined} />
      ))}
      <text x={(NODES.verifier.x + NODES.agent.x) / 2} y={Y + 72} textAnchor="middle" fontSize="11" fill="#b45309">
        feedback loop · attempt {Math.max(1, attempt)}
      </text>
      {hasFeed && <path d={pathOf({ from: 'feed', to: 'agent', color: '' })} stroke="#fecdd3" strokeWidth={2} strokeDasharray="4 4" />}
      {/* reference line: the verifier always checks against the locked intent */}
      <path d={`M${NODES.lock.x},${Y - 26} C${NODES.lock.x},${Y - 80} ${NODES.verifier.x},${Y - 80} ${NODES.verifier.x},${Y - 26}`} fill="none" stroke="#99f6e4" strokeWidth={1.5} strokeDasharray="2 4" />
      <text x={(NODES.lock.x + NODES.verifier.x) / 2 + 60} y={Y - 64} textAnchor="middle" fontSize="10" fill="#0d9488">
        checked against the locked intent
      </text>

      {f.edge && (
        <g key={`edge-${idx}`}>
          <motion.path d={pathOf(f.edge)} fill="none" stroke={f.edge.color} strokeWidth={3} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: 'easeInOut' }} />
          <motion.circle r={7} fill={f.edge.color} initial={{ cx: pointsOf(f.edge).xs[0], cy: pointsOf(f.edge).ys[0] }} animate={{ cx: pointsOf(f.edge).xs, cy: pointsOf(f.edge).ys }} transition={{ duration: 0.7, ease: 'easeInOut' }} />
        </g>
      )}

      {(Object.keys(NODES) as NodeId[]).map((id) => {
        if (id === 'feed' && !hasFeed) return null
        const n = NODES[id]
        const active = f.active.includes(id)
        const thinking = (pending === 'agent' && id === 'agent')
        const fill = id === 'decision' && lastDecision ? DECISION[lastDecision].hex : id === 'verifier' && f.tone && active ? f.tone : n.color
        const isLlm = id === 'agent'
        return (
          <g key={id} transform={`translate(${n.x},${n.y})`}>
            {(active || thinking) && (
              <motion.rect
                x={-62}
                y={-28}
                width={124}
                height={56}
                rx={16}
                fill="none"
                stroke={fill}
                strokeWidth={3}
                initial={{ opacity: 0.9, scale: 1 }}
                animate={{ opacity: [0.9, 0.2, 0.9], scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: thinking ? 0.9 : 1.6 }}
              />
            )}
            <rect x={-56} y={-24} width={112} height={48} rx={13} fill={active || thinking ? fill : '#fff'} stroke={fill} strokeWidth={1.5} />
            <text y={-3} textAnchor="middle" fontSize="13" fontWeight="700" fill={active || thinking ? '#fff' : '#0f172a'}>
              {id === 'decision' && lastDecision ? DECISION[lastDecision].label : n.label}
            </text>
            <text y={13} textAnchor="middle" fontSize="9.5" fill={active || thinking ? '#e2e8f0' : '#64748b'}>
              {thinking ? 'thinking…' : id === 'agent' && attempt ? `attempt ${attempt}` : n.sub}
            </text>
            {isLlm && (
              <g transform="translate(44,-24)">
                <rect x={-14} y={-8} width={28} height={15} rx={7} fill="#f5f3ff" stroke="#c4b5fd" />
                <text y={3} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#6d28d9">
                  LLM
                </text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
