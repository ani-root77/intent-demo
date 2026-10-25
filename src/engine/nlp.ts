// Clario's NLP reader. Deterministic: the same text always gives the same reading. No AI model, no network.
// It reads text with classic NLP techniques, on top of the editable keyword lists (RuleLexicon):
//  - tokenising, part-of-speech tags, lemmas and contractions (compromise), so "bought", "buying" and "buys"
//    all match "buy", and "don't" is read as "do not";
//  - clause segmentation, so "Instead of X, buy Y" and "trim A and add B" are read as separate actions;
//  - NegEx-style negation scope: a negation only covers its own clause, double negatives cancel ("not a bad
//    idea", "no reason to avoid"), and post-negations ("…would be a mistake") cover what came before;
//  - verb–object attachment: each asset is linked to the verb acting on it, with money direction from
//    "from X", "into Y", "swap X for Y", "replace X with Y";
//  - modality: a buy/sell only counts as advice if it is a recommendation (imperative, "I recommend", "we will"),
//    not a description ("investors bought…"), a question or the "if" part of a condition;
//  - coreference: "it", "the position", "more" point back to the last asset named;
//  - number normalisation: "forty percent", "fifty grand", "a third", "half", "all of".

import nlp from 'compromise'
import type { Asset, Universe } from './model'
import type { Objective, RiskLean } from './objectives'
import { namesOf, type AnswerScan, type Level, type RuleLexicon, type RuleReading, type Stance } from './rules'

// ---------- grammar (closed-class words, not domain vocabulary) ----------

/** Verbs that move money from one holding into another: what comes before "into" is the source. */
const MOVE_VERBS = ['move', 'shift', 'reallocate', 'rotate', 'put', 'allocate', 'deploy', 'redeploy', 'transfer', 'use', 'invest', 'switch']
/** "swap X for Y", "replace X with Y": X is sold, Y bought. */
const SWAP_VERBS = ['swap', 'exchange', 'trade', 'replace', 'switch']
const HOLD_VERBS = ['keep', 'hold', 'stick with', 'stay with', 'maintain', 'retain', 'stay in', 'hang on to', 'hold onto', 'hold on to']
const INTO = ['into', 'to', 'toward', 'towards', 'in favor of', 'in favour of', 'in']
const FROM = ['from', 'out of']
/** Recommendation verbs are transparent to negation: "I can't recommend X" negates X. */
const ADVISE_VERBS = ['recommend', 'suggest', 'advise', 'consider', 'think']
/** Post-negations (NegEx): they negate what came before them in the clause. */
const POST_NEGATIONS = ['too risky', 'too volatile', 'too concentrated', 'too speculative', 'too aggressive', 'far too', 'a mistake', 'a bad idea', 'not a good idea', 'not advisable', 'not recommended', 'not suitable', 'unsuitable', 'not appropriate', 'inappropriate', 'make no sense', 'not wise', 'unwise', 'counter to', 'clash', 'contradict', 'lock in losses', 'not for you', 'not for someone']
/** Words a negation particle cancels against ("not a bad idea", "no reason to avoid", "don't hesitate"). */
const NEGATIVE_WORDS = ['bad', 'mistake', 'wrong', 'avoid', 'miss', 'hesitate', 'wait', 'late', 'doubt', 'worry', 'risky', 'harm', 'hurt']
const PARTICLES = ['not', 'no', 'never', 'nor', 'without']
/** Short sentences that reject the asset just asked about ("Bitcoin? Absolutely not."). */
const ELLIPTIC = ['absolutely not', 'definitely not', 'certainly not', 'no way', 'not now', 'not yet', 'not for you', 'not for someone', 'no thanks']
const ANAPHORS = ['it', 'them', 'the stock', 'the fund', 'the etf', 'the position', 'your position', 'this position', 'that position', 'the dip', 'more of it', 'more']
const CLAUSE_WORDS = ['but', 'however', 'although', 'though', 'whereas', 'yet', 'while', 'which', 'who', 'because', 'since', 'except', 'otherwise']
const NEGATED_CLAUSE_START = ['rather than', 'instead of']
const CONDITION_WORDS = ['if', 'unless', 'when', 'once', 'whenever']
const FILLERS = ['and', 'then', 'so', 'please', 'now', 'just', 'also', 'simply', 'instead', 'first', 'finally', 'next', 'but', 'today']
const SUBJECTS = ['i', 'we', 'you', 'he', 'she', 'they', 'it', 'let', 'this', 'that', 'there']
const FIRST_PERSON_ACTION = ['i be', 'we be', 'i will', 'we will', 'i would', 'we would', 'i plan to', 'we plan to', 'let us', 'i be go to', 'we be go to']
const MARKET_MOVES = ['drop', 'fall', 'rise', 'gain', 'lose', 'climb', 'crash', 'jump', 'double', 'triple', 'surge', 'slide', 'decline']
const POLITE = ['can you', 'could you', 'would you', 'will you', 'can we', 'could we', 'please']
const DESIRE = ['i want', 'i would like', 'i need', 'i wish', 'i be look', 'help me', 'make', 'let us', 'please']
const WH = ['what', 'how', 'why', 'which', 'where', 'who']
const FRACTIONS: [string, number][] = [['three quarters', 75], ['two thirds', 66.7], ['a third', 33.3], ['one third', 33.3], ['a quarter', 25], ['one quarter', 25], ['half', 50], ['a fifth', 20]]
const ALL_OF = ['all', 'everything', 'entire', 'completely', 'whole', 'all of', 'fully', 'every']
const STATUS_WORDS = ['balance', 'worth', 'value', 'statement', 'login', 'password']

// ---------- tokens ----------

interface Tok {
  i: number
  /** Surface text without punctuation. */
  text: string
  /** Lower-case word, with contractions expanded ("n't" → "not"). */
  w: string
  /** The word and its possible base forms (lemma, singular, stem). */
  forms: string[]
  tags: Set<string>
  start: number
  end: number
  /** Punctuation after the word. */
  post: string
  sent: number
}

interface CTerm {
  text: string
  post: string
  normal: string
  root?: string | null
  implicit?: string
  tags: string[]
  offset: { start: number; length: number }
}

function formsOf(w: string, root?: string | null): string[] {
  const f = new Set([w])
  if (root) f.add(root.toLowerCase())
  const undouble = (b: string) => (b.length > 2 && b.at(-1) === b.at(-2) ? b.slice(0, -1) : b)
  if (w.length > 4 && w.endsWith('ies')) f.add(w.slice(0, -3) + 'y')
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) f.add(w.slice(0, -1))
  if (w.length > 4 && w.endsWith('es')) f.add(w.slice(0, -2))
  if (w.length > 5 && w.endsWith('ing')) {
    const b = w.slice(0, -3)
    f.add(b).add(b + 'e').add(undouble(b))
  }
  if (w.length > 4 && w.endsWith('ed')) {
    const b = w.slice(0, -2)
    f.add(b).add(b + 'e').add(undouble(b))
  }
  // Auxiliaries read as "be"/"will"/"would" so that "I'm", "I am" and "we are" all match "i be".
  if (['am', 'is', 'are', "'m", "'re", 'was', 'were'].includes(w)) f.add('be')
  return [...f]
}

const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"')

const cache = new Map<string, { toks: Tok[]; sentEnd: number[]; sentQuestion: boolean[] }>()

function tokenize(text: string) {
  const hit = cache.get(text)
  if (hit) return hit
  const doc = nlp(text)
  doc.compute('root')
  const toks: Tok[] = []
  const sentEnd: number[] = []
  const sentQuestion: boolean[] = []
  ;(doc.json({ offset: true }) as { text: string; terms: CTerm[] }[]).forEach((s, si) => {
    for (const t of s.terms) {
      const raw = (t.implicit ?? t.normal ?? t.text).toLowerCase()
      const w = raw.replace(/^[^a-z0-9$&]+|[^a-z0-9%&]+$/g, '') || raw
      // compromise sometimes tags "bonds" as a verb; the lemma it gives is still right, so keep both.
      toks.push({ i: toks.length, text: t.text, w, forms: formsOf(w, t.implicit ? null : t.root), tags: new Set(t.tags), start: t.offset.start, end: t.offset.start + t.offset.length, post: t.post ?? '', sent: si })
    }
    sentEnd.push(toks.length)
    sentQuestion.push(/\?\s*$/.test(s.text))
  })
  const out = { toks, sentEnd, sentQuestion }
  if (cache.size > 500) cache.clear()
  cache.set(text, out)
  return out
}

/** A phrase as a list of word forms, tokenised the same way as the text. */
const phraseCache = new Map<string, string[][]>()
function phraseForms(p: string): string[][] {
  let f = phraseCache.get(p)
  if (!f) {
    f = tokenize(norm(p.toLowerCase())).toks.map((t) => t.forms)
    phraseCache.set(p, f)
  }
  return f
}

const GAP = new Set(['me', 'my', 'your', 'our', 'us', 'it', 'them', 'him', 'her', 'their'])

/**
 * If `phrase` starts at token i (within [i, to)), returns the index after it, else -1. With `gap`, object pronouns
 * may sit inside a multi-word verb phrase ("get me out of"); other phrases must match word for word ("all cash" is
 * not "all my cash").
 */
function matchAt(toks: Tok[], i: number, to: number, phrase: string, gap = false): number {
  const pf = phraseForms(phrase)
  if (!pf.length) return -1
  let k = i
  for (let j = 0; j < pf.length; j++) {
    while (gap && j > 0 && k < to && GAP.has(toks[k].w) && !pf[j].includes(toks[k].w) && k - i < pf.length + 2) k++
    if (k >= to || !toks[k].forms.some((x) => pf[j].includes(x))) return -1
    k++
  }
  return k
}

interface Hit {
  phrase: string
  start: number
  end: number
}

function findAll(toks: Tok[], from: number, to: number, phrases: string[], gap = false): Hit[] {
  const out: Hit[] = []
  const sorted = [...new Set(phrases.filter((p) => p.trim()))].sort((a, b) => phraseForms(b).length - phraseForms(a).length)
  for (let i = from; i < to; i++) {
    for (const p of sorted) {
      const e = matchAt(toks, i, to, p, gap)
      if (e > 0) {
        out.push({ phrase: p, start: i, end: e })
        break
      }
    }
  }
  return out
}

const isIn = (t: Tok | undefined, words: string[]) => !!t && words.some((w) => t.forms.includes(w))

// ---------- assets ----------

interface Mention {
  asset: Asset
  start: number
  end: number
}

/** Can a ticker be matched in lower case? Not when it is also an English word ("cash"). */
const looseTicker = (tk: string) => {
  const lower = tk.toLowerCase()
  const lex = (nlp as unknown as { model: () => { one: { lexicon: Record<string, unknown> } } }).model().one.lexicon
  const tag = lex[lower]
  return tk.length >= 3 && (tag === undefined || ['Organization', 'ProperNoun', 'Acronym'].includes(String(tag)))
}

function findMentions(toks: Tok[], assets: Asset[], from = 0, to = toks.length): Mention[] {
  const names = assets.flatMap((a) => namesOf(a).filter((n) => n !== a.ticker).map((n) => ({ a, n, len: phraseForms(n).length }))).sort((x, y) => y.len - x.len)
  const out: Mention[] = []
  for (let i = from; i < to; i++) {
    const t = toks[i]
    let best: Mention | null = null
    for (const { a, n } of names) {
      const e = matchAt(toks, i, to, n)
      if (e > 0 && (!best || e > best.end)) best = { asset: a, start: i, end: e }
    }
    if (!best) {
      const a = assets.find((x) => t.text === x.ticker || (t.text.toLowerCase() === x.ticker.toLowerCase() && looseTicker(x.ticker)))
      if (a) best = { asset: a, start: i, end: i + 1 }
    }
    if (best) {
      out.push(best)
      i = best.end - 1
    }
  }
  return out
}

// ---------- clauses ----------

interface Clause {
  start: number
  end: number
  sent: number
  /** The "if" part of a conditional: nothing in it is a recommendation. */
  cond: boolean
  question: boolean
  /** Starts with "rather than" / "instead of": everything in it is advised against. */
  negatedStart: boolean
}

const VERBISH = (t: Tok) => t.tags.has('Verb') && !t.tags.has('Gerund') && !t.tags.has('Copula')

function clausesOf(toks: Tok[], sentEnd: number[], sentQuestion: boolean[]): Clause[] {
  const out: Clause[] = []
  let s0 = 0
  sentEnd.forEach((sEnd, si) => {
    const cuts = new Set<number>()
    for (let i = s0; i < sEnd; i++) {
      const t = toks[i]
      const next = toks[i + 1]
      if (i > s0 && (isIn(t, CLAUSE_WORDS) || isIn(t, CONDITION_WORDS))) cuts.add(i)
      if (i > s0 && NEGATED_CLAUSE_START.some((p) => matchAt(toks, i, sEnd, p) > 0)) cuts.add(i)
      if (/[;:]/.test(t.post) && i + 1 < sEnd) cuts.add(i + 1)
      // A comma ends a clause when a new clause starts after it, not inside a list of names: ", and BND" continues
      // the list, while ", and buy BND" starts a new action.
      const listGoesOn = !!next && ['and', 'or'].includes(next.w) && !!toks[i + 2] && !VERBISH(toks[i + 2]!) && !toks[i + 2]!.tags.has('Gerund')
      if (/,/.test(t.post) && next && i + 1 < sEnd && !listGoesOn && (VERBISH(next) || isIn(next, SUBJECTS) || isIn(next, FILLERS) || isIn(next, CLAUSE_WORDS))) cuts.add(i + 1)
      // "trim A and add B": "and"/"then"/"or" before a new verb starts a new action.
      if (i > s0 && ['and', 'then', 'or'].includes(t.w) && next && (VERBISH(next) || next.tags.has('Gerund') || (next.w === 'not' || next.w === 'do'))) cuts.add(i)
      // "If NVDA drops 10% should I buy…": a question word after a condition starts the main clause.
      if (i > s0 && ['should', 'would', 'could', 'can', 'will'].includes(t.w) && isIn(next, SUBJECTS)) cuts.add(i)
    }
    const bounds = [s0, ...[...cuts].sort((a, b) => a - b), sEnd]
    for (let k = 0; k < bounds.length - 1; k++) {
      const [a, b] = [bounds[k], bounds[k + 1]]
      if (a >= b) continue
      let first = a
      while (first < b && isIn(toks[first], FILLERS) && toks[first].w !== 'but') first++
      out.push({
        start: a,
        end: b,
        sent: si,
        cond: isIn(toks[a], CONDITION_WORDS) || isIn(toks[first], CONDITION_WORDS) || (toks[a].w === 'only' && toks[a + 1]?.w === 'if'),
        question: sentQuestion[si],
        negatedStart: NEGATED_CLAUSE_START.some((p) => matchAt(toks, a, b, p) > 0),
      })
    }
    s0 = sEnd
  })
  return out
}

// ---------- negation (NegEx) ----------

interface Negation {
  /** Tokens covered by a negation, and what kind of trigger covers them. */
  scope: Map<number, 'particle' | 'avoid' | 'post'>
}

function negationIn(toks: Tok[], c: Clause, lex: RuleLexicon): Negation {
  const scope = new Map<number, 'particle' | 'avoid' | 'post'>()
  const idioms = findAll(toks, c.start, c.end, lex.positiveIdioms)
  const cancelled = new Set<number>()
  for (const h of idioms) for (let k = h.start; k < h.end; k++) cancelled.add(k)
  // Double negatives: a particle followed closely by a negative word cancels both.
  for (let i = c.start; i < c.end; i++) {
    if (!isIn(toks[i], PARTICLES) || cancelled.has(i)) continue
    for (let k = i + 1; k < Math.min(c.end, i + 5); k++) {
      if (isIn(toks[k], NEGATIVE_WORDS)) {
        cancelled.add(i)
        cancelled.add(k)
        break
      }
      if (VERBISH(toks[k]) && !isIn(toks[k], ['be', 'do', 'need', 'have'])) break
    }
  }
  const triggers = findAll(toks, c.start, c.end, [...lex.negations, ...PARTICLES, ...NEGATED_CLAUSE_START]).filter((h) => !cancelled.has(h.start))
  for (const h of triggers) {
    const kind = PARTICLES.some((p) => phraseForms(p).length === h.end - h.start && toks[h.start].forms.includes(p)) || ['do not', "don't", 'not', 'never', 'should not', "shouldn't", 'cannot', "can't", "wouldn't", 'no need'].includes(h.phrase) ? 'particle' : 'avoid'
    for (let k = h.end; k < Math.min(c.end, h.end + 12); k++) if (!scope.has(k)) scope.set(k, kind)
  }
  if (c.negatedStart) for (let k = c.start; k < c.end; k++) scope.set(k, 'avoid')
  for (const h of findAll(toks, c.start, c.end, POST_NEGATIONS)) {
    let cancel = false
    for (let k = h.start; k < h.end; k++) if (cancelled.has(k)) cancel = true
    if (cancel) continue
    for (let k = c.start; k < h.start; k++) scope.set(k, 'post')
  }
  return { scope }
}

// ---------- verb–object attachment ----------

type Role = 'buy' | 'sell' | 'hold' | 'avoid' | 'advise' | 'none'

interface Verb {
  i: number
  end: number
  role: Role
  phrase: string
}

function verbsIn(toks: Tok[], c: Clause, lex: RuleLexicon): Verb[] {
  const groups: [Role, string[]][] = [
    ['sell', [...lex.sellWords, 'rotate out of', 'move out of', 'get out of', 'pull out of', 'cash out']],
    ['avoid', lex.negations.filter((n) => !PARTICLES.some((p) => n === p) && !/\bnot\b|n't|never|cannot|no need/.test(n))],
    ['hold', HOLD_VERBS],
    ['buy', [...lex.buyWords, ...SWAP_VERBS]],
    ['advise', ADVISE_VERBS],
  ]
  const out: Verb[] = []
  for (let i = c.start; i < c.end; i++) {
    for (const [role, words] of groups) {
      const h = findAll(toks, i, Math.min(c.end, i + 6), words, true).find((x) => x.start === i)
      if (h) {
        out.push({ i, end: h.end, role, phrase: h.phrase })
        i = h.end - 1
        break
      }
    }
  }
  return out
}

interface Attached {
  mention: Mention
  role: Role
  verb: Verb | null
  /** Money direction from prepositions: 'source' (from / before into), 'dest' (into / after for). */
  dir: 'source' | 'dest' | null
  negated: 'particle' | 'avoid' | 'post' | null
}

function attach(toks: Tok[], c: Clause, mentions: Mention[], verbs: Verb[], neg: Negation): Attached[] {
  return mentions.map((m) => {
    const left = verbs.filter((v) => v.end <= m.start).at(-1)
    const verb = left ?? verbs.find((v) => v.i >= m.end && v.role !== 'avoid') ?? null
    let role: Role = verb?.role ?? 'none'
    let dir: Attached['dir'] = null
    const lo = Math.max(verb && verb.end <= m.start ? verb.end : c.start, m.start - 4)
    const swap = !!verb && SWAP_VERBS.some((s) => toks[verb.i].forms.includes(s))
    const markers = swap ? ['for', 'with', 'into', 'to'] : ['into', 'to', 'toward', 'towards', 'in favor of']
    // The nearest direction word before the asset decides: "from VXUS into QQQ" → VXUS source, QQQ destination.
    for (let k = m.start - 1; k >= lo && !dir; k--) {
      if (FROM.some((p) => matchAt(toks, k, m.start, p) > 0)) dir = 'source'
      else if ((swap ? markers : INTO).some((p) => matchAt(toks, k, m.start, p) > 0) && (!verb || swap || isIn(toks[verb.i], MOVE_VERBS) || verb.role === 'buy')) dir = verb || toks[k].w === 'into' ? 'dest' : null
    }
    // "move cash into X" / "swap X for Y": an asset before the destination word is the source.
    if (!dir && verb && verb.end <= m.start && (isIn(toks[verb.i], MOVE_VERBS) || swap)) {
      for (let k = m.end; k < c.end; k++) {
        if (markers.some((p) => matchAt(toks, k, c.end, p) > 0)) {
          dir = 'source'
          break
        }
      }
    }
    if (dir === 'source' && (role === 'buy' || role === 'none' || role === 'sell')) role = 'sell'
    else if (dir === 'dest' && (role === 'buy' || role === 'none' || role === 'sell')) role = 'buy'
    if (role === 'buy' && isIn(toks[verb?.i ?? -1], SWAP_VERBS) && !dir) role = 'sell'
    const negated = neg.scope.get(m.start) ?? (verb && verb.end <= m.start ? neg.scope.get(verb.i) : undefined) ?? null
    return { mention: m, role, verb, dir, negated }
  })
}

// ---------- shared reading of a text ----------

interface ClauseReading {
  c: Clause
  verbs: Verb[]
  neg: Negation
  items: Attached[]
  recommends: boolean
}

function readClauses(text: string, u: Universe, lex: RuleLexicon) {
  const { toks, sentEnd, sentQuestion } = tokenize(norm(text))
  const clauses = clausesOf(toks, sentEnd, sentQuestion)
  const cuesBySentence = sentEnd.map((e, si) => findAll(toks, si ? sentEnd[si - 1] : 0, e, lex.recommendCues).length > 0)
  const all = findMentions(toks, u.assets)
  const out: ClauseReading[] = []
  let lastQuestionTopic: Mention[] = []
  for (const c of clauses) {
    const verbs = verbsIn(toks, c, lex)
    const neg = negationIn(toks, c, lex)
    let mentions = all.filter((m) => m.start >= c.start && m.start < c.end)
    // Coreference: "it", "the position", "more" in a clause that acts on something but names nothing.
    if (!mentions.length && (verbs.length || neg.scope.size)) {
      const prev = all.filter((m) => m.end <= c.start)
      const anaphor = findAll(toks, c.start, c.end, ANAPHORS).find((h) => verbs.some((v) => v.i < h.start) || toks[h.start].w !== 'more')
      const bareAvoid = verbs.some((v) => v.role === 'avoid') && !verbs.some((v) => v.role !== 'avoid')
      const elliptic = ELLIPTIC.some((p) => matchAt(toks, c.start, c.end, p) > 0)
      if (prev.length && (anaphor || bareAvoid || elliptic)) {
        const at = anaphor?.start ?? Math.min(c.end - 1, verbs.at(-1)?.end ?? c.start)
        if (anaphor && toks[anaphor.start].w === 'them') {
          const lastSent = prev.at(-1)!.asset && toks[prev.at(-1)!.start].sent
          mentions = prev.filter((m) => toks[m.start].sent === lastSent).map((m) => ({ ...m, start: at, end: at + 1 }))
        } else {
          const ref = elliptic && lastQuestionTopic.length ? lastQuestionTopic : [prev.at(-1)!]
          mentions = ref.map((m) => ({ ...m, start: at, end: at + 1 }))
        }
        if (elliptic) for (let k = c.start; k < c.end; k++) neg.scope.set(k, 'post')
      }
    }
    const items = attach(toks, c, mentions, verbs, neg)
    if (c.question) lastQuestionTopic = all.filter((m) => toks[m.start].sent === c.sent)
    // Is this clause a recommendation?
    let first = c.start
    while (first < c.end && (isIn(toks[first], FILLERS) || toks[first].w === 'let' || toks[first].w === 'us')) first++
    const head = toks[first]
    const imperative = !!head && (head.tags.has('Imperative') || ((head.tags.has('Infinitive') || verbs.some((v) => v.i === first)) && !isIn(head, SUBJECTS) && !head.tags.has('Gerund')))
    const firstPerson = findAll(toks, c.start, c.end, FIRST_PERSON_ACTION).length > 0
    const clauseCue = findAll(toks, c.start, c.end, lex.recommendCues).length > 0
    const past = verbs.length > 0 && verbs.every((v) => toks[v.i].tags.has('PastTense') && !toks[v.i].tags.has('Infinitive'))
    const recommends = !c.cond && !past && (!c.question || imperative) && (imperative || firstPerson || clauseCue || cuesBySentence[c.sent])
    out.push({ c, verbs, neg, items, recommends })
  }
  return { toks, clauses: out, mentions: all, sentEnd }
}

// ---------- answer scan ----------

/** Stance of an asset from its role, negation and whether the clause recommends anything. */
function stanceOf(a: Attached, r: ClauseReading): Stance {
  const transparentVerb = !a.verb || ADVISE_VERBS.some((v) => a.verb!.phrase === v)
  if (a.negated) {
    if (a.role === 'sell' || a.role === 'hold') return 'mention'
    if (a.role === 'avoid') return 'avoid'
    if (a.role === 'buy' || a.role === 'advise') return 'avoid'
    // A plain mention is advised against by "avoid", "rather than" or a post-negation; a bare "not" only when no other verb is in between.
    return a.negated !== 'particle' || transparentVerb ? 'avoid' : 'mention'
  }
  if (a.role === 'avoid') return r.c.cond ? 'mention' : 'avoid'
  if (a.role === 'hold' || a.role === 'none') return 'mention'
  if (!r.recommends) return 'mention'
  return a.role === 'advise' ? 'buy' : a.role
}

export function scanAnswerNlp(answer: string, u: Universe, lex: RuleLexicon, investorName: string): AnswerScan {
  const { toks, clauses } = readClauses(answer, u, lex)
  const stances: AnswerScan['stances'] = []
  const unknownBuys: AnswerScan['unknownBuys'] = []
  const quote = (c: Clause) => answer.slice(toks[c.start].start, toks[c.end - 1].end).trim()
  for (const r of clauses) {
    for (const a of r.items) {
      let stance = stanceOf(a, r)
      // Cash named with a buy word is the funding source ("put your cash to work"), unless money goes into it.
      if (a.mention.asset.kind === 'cash' && stance === 'buy' && a.dir !== 'dest') stance = 'sell'
      stances.push({ ticker: a.mention.asset.ticker, stance, clause: quote(r.c) })
    }
    if (r.recommends) {
      for (const v of r.verbs.filter((v) => v.role === 'buy' && !r.neg.scope.has(v.i))) {
        for (const name of namesAfter(toks, v.end, r.c.end, u.assets, lex, investorName)) unknownBuys.push({ name, clause: quote(r.c) })
      }
    }
  }
  return { stances, unknownBuys }
}

/** Capitalised names that are the object of a verb ("buy Rivian and Lucid") and match no known asset. */
function namesAfter(toks: Tok[], from: number, to: number, assets: Asset[], lex: RuleLexicon, investorName: string): string[] {
  const stop = new Set([...lex.stopWords, investorName].map((s) => s.toLowerCase()))
  const skip = ['a', 'an', 'the', 'some', 'more', 'shares', 'share', 'of', 'stock', 'in', 'into', 'on', 'both', 'position', 'positions', 'additional', 'few']
  const known = findMentions(toks, assets, from, to)
  const out: string[] = []
  let k = from
  while (k < to && (isIn(toks[k], skip) || toks[k].tags.has('Value') || toks[k].tags.has('Money'))) k++
  while (k < to) {
    const parts: string[] = []
    while (k < to && /^[A-Z]/.test(toks[k].text) && !known.some((m) => k >= m.start && k < m.end) && !stop.has(toks[k].w) && !toks[k].forms.some((f) => stop.has(f))) {
      parts.push(toks[k].text)
      k++
      if (/[,;:.!?]/.test(toks[k - 1].post)) break
    }
    if (parts.length && parts.join(' ').length >= 3) out.push(parts.join(' '))
    const known0 = known.find((m) => m.start === k)
    if (known0) k = known0.end
    if (k < to && ['and', 'or', '&'].includes(toks[k].w)) {
      k++
      continue
    }
    if (parts.length && k < to && /,/.test(toks[k - 1]?.post ?? '') && /^[A-Z]/.test(toks[k].text)) continue
    break
  }
  return out
}

// ---------- request reading ----------

export interface NlpReading extends RuleReading {
  /** How sure the reading is, from 0 to 1, and why. */
  confidence: number
  confidenceNotes: string[]
}

/** Amounts in a request after numbers are normalised to digits: "$20,000", "10 grand", "40 percent", "a third". */
function quantities(toks: Tok[], text: string) {
  const out: { start: number; end: number; usd?: number; percent?: number; all?: boolean }[] = []
  const at = (pos: number) => toks.findIndex((t) => t.end > pos)
  const add = (re: RegExp, f: (m: RegExpExecArray) => Omit<(typeof out)[number], 'start' | 'end'> | null) => {
    for (const m of text.matchAll(re)) {
      const v = f(m as RegExpExecArray)
      if (v) out.push({ start: at(m.index ?? 0), end: at((m.index ?? 0) + m[0].length - 1) + 1, ...v })
    }
  }
  const mult = (s?: string) => (!s ? 1 : /^(k|grand|thousand)$/i.test(s) ? 1e3 : /^(m|mm|million)$/i.test(s) ? 1e6 : 1)
  add(/(\d+(?:\.\d+)?)\s?(?:%|percent\b|per cent\b)/gi, (m) => ({ percent: Number(m[1]) }))
  add(/\$\s?(\d[\d,]*(?:\.\d+)?)\s?(k|m|mm|thousand|million|grand)?\b/gi, (m) => ({ usd: Number(m[1].replace(/,/g, '')) * mult(m[2]) }))
  add(/(?<![$\d.,])(\d[\d,]*(?:\.\d+)?)\s?(k|grand|thousand|million)?\s?(dollars|bucks|usd)\b/gi, (m) => ({ usd: Number(m[1].replace(/,/g, '')) * mult(m[2]) }))
  add(/(?<![$\d.,])(\d[\d,]*(?:\.\d+)?)\s?(k|grand)\b(?!\s?(?:dollars|bucks|usd))/gi, (m) => ({ usd: Number(m[1].replace(/,/g, '')) * mult(m[2]) }))
  for (const [w, p] of FRACTIONS) add(new RegExp(`\\b${w}\\b`, 'gi'), () => ({ percent: p }))
  for (const w of ALL_OF) add(new RegExp(`\\b${w}\\b`, 'gi'), () => ({ percent: 100, all: true }))
  // Keep the longest, earliest match per position.
  return out
    .filter((q) => q.start >= 0)
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((q, k, xs) => !xs.slice(0, k).some((p) => q.start < p.end && q.start >= p.start))
}

/** "forty" → "40", "fifty thousand" → "50000"; keeps everything else as written. */
function digitize(q: string): string {
  const doc = nlp(q)
  const numbers = doc.numbers()
  ;(numbers.ifNo('#Ordinal') as typeof numbers).toNumber()
  return doc.text()
}

export function readRequestNlp(question: string, u: Universe, objectives: Objective[], lex: RuleLexicon, investorName: string): NlpReading {
  const text = norm(digitize(norm(question).trim()))
  const evidence: string[] = []
  const notes: string[] = []
  const { toks, clauses, mentions } = readClauses(text, u, lex)
  const lower = text.toLowerCase()
  const anyNeg = (i: number) => clauses.some((r) => r.c.start <= i && i < r.c.end && r.neg.scope.has(i))

  // Assets
  const known = [...new Map(mentions.map((m) => [m.asset.id, m.asset])).values()]
  const unknown = unknownNames(toks, u.assets, lex, investorName)
  if (known.length) evidence.push(`assets named: ${known.map((a) => a.ticker).join(', ')}`)
  if (unknown.length) evidence.push(`unrecognised names: ${unknown.join(', ')}`)

  // Roles of each asset in the request (buy / sell / hold / advised against)
  const roles = clauses.flatMap((r) =>
    r.items.map((a) => ({ a, r, role: (a.negated ? (a.role === 'buy' || a.role === 'none' ? 'avoid' : 'hold') : a.role) as Role })),
  )

  // Request type
  const actionVerbs = clauses.some((r) => r.verbs.length)
  const lowerStart = lower.replace(/^[^a-z]+/, '')
  const isQuestion = clauses.some((r) => r.c.question) || WH.some((w) => toks[0]?.w === w && toks[1]?.w !== 'not') || lex.adviceStarters.some((s) => lowerStart.startsWith(s.toLowerCase() + ' '))
  const polite = findAll(toks, 0, Math.min(toks.length, 4), POLITE).length > 0 || clauses.some((r) => findAll(toks, r.c.start, Math.min(r.c.end, r.c.start + 3), POLITE).length > 0)
  const desire = findAll(toks, 0, toks.length, DESIRE).length > 0
  const firstVerb = toks.find((t) => t.tags.has('Verb'))
  const imperative = !!firstVerb && firstVerb.i === 0 && (firstVerb.tags.has('Imperative') || firstVerb.tags.has('Infinitive'))

  // Risk lean
  let implied_risk: RiskLean = 'neutral'
  const leanHits: { level: Level; word: string }[] = []
  for (const level of ['very_aggressive', 'very_conservative', 'aggressive', 'conservative', 'moderate'] as Level[]) {
    for (const h of findAll(toks, 0, toks.length, lex.riskWords[level])) {
      if (!anyNeg(h.start)) leanHits.push({ level, word: h.phrase })
    }
  }
  // "too aggressive / too risky" is a complaint, i.e. a wish for less risk.
  const complaint = findAll(toks, 0, toks.length, ['too aggressive', 'too risky', 'too volatile', 'too much risk'])
  for (const h of complaint) {
    for (let k = leanHits.length - 1; k >= 0; k--) if (h.phrase.includes(leanHits[k].word)) leanHits.splice(k, 1)
    leanHits.push({ level: 'conservative', word: h.phrase })
  }
  const qs = quantities(toks, text)
  const risky = (a: Asset) => a.kind === 'stock' || (a.tailProb ?? 0) > 0 || a.sigma >= 0.3
  const buyRisky = roles.filter((x) => (x.role === 'buy' || (x.role === 'none' && !x.a.negated)) && risky(x.a.mention.asset) && !x.r.c.cond)
  const bigBet = buyRisky.find((x) => qs.some((q) => q.percent && !q.all && q.percent >= lex.bigPercent && q.start >= x.r.c.start && q.start < x.r.c.end))
  const up = leanHits.filter((h) => h.level === 'aggressive' || h.level === 'very_aggressive')
  const down = leanHits.filter((h) => h.level === 'conservative' || h.level === 'very_conservative')
  const pick = (lvls: Level[]) => leanHits.find((h) => lvls.includes(h.level))
  if (up.length && down.length) {
    implied_risk = 'moderate'
    evidence.push(`mixed signals (“${up[0].word}”, “${down[0].word}”) → moderate`)
  } else if (bigBet) {
    implied_risk = 'very_aggressive'
    evidence.push(`a large share into ${bigBet.a.mention.asset.ticker} → very aggressive`)
  } else {
    const h = pick(['very_aggressive']) ?? pick(['very_conservative']) ?? pick(['aggressive']) ?? pick(['conservative']) ?? pick(['moderate'])
    if (h) {
      implied_risk = h.level
      evidence.push(`“${h.word}” → ${h.level.replace('_', ' ')}`)
    } else if (buyRisky.length) {
      implied_risk = 'aggressive'
      evidence.push(`buying a volatile asset (${buyRisky[0].a.mention.asset.ticker}) → aggressive`)
    }
  }

  // Objective: which metric the request is about, in which direction (negation flips it).
  let objective: string | null = null
  const cashSource = roles.some((x) => x.a.mention.asset.kind === 'cash' && (x.a.dir === 'source' || x.role === 'sell' || (x.role === 'buy' && x.a.dir !== 'dest')))
  const metricHits = (Object.keys(lex.metricWords) as (keyof RuleLexicon['metricWords'])[])
    .map((m) => ({ m, hits: findAll(toks, 0, toks.length, lex.metricWords[m]) }))
    .filter((x) => x.hits.length && !(x.m === 'cash' && cashSource && x.hits.every((h) => isIn(toks[h.start], ['cash']))))
  const ups = findAll(toks, 0, toks.length, lex.increaseWords)
  const downs = findAll(toks, 0, toks.length, lex.decreaseWords)
  const directed = ups.length + downs.length > 0
  const statusQuestion = isQuestion && !directed && !actionVerbs && !desire
  if (metricHits.length && !statusQuestion) {
    const { m, hits } = metricHits[0]
    const negUp = ups.filter((h) => anyNeg(h.start)).length
    const negDown = downs.filter((h) => anyNeg(h.start)).length
    const upN = ups.length - negUp + negDown
    const downN = downs.length - negDown + negUp
    let direction: 'up' | 'down' = upN > downN ? 'up' : downN > upN ? 'down' : m === 'volatility' ? 'down' : 'up'
    if (m === 'volatility' && !(upN > downN)) direction = 'down'
    if (m !== 'volatility' && !ups.length && !downs.length && hits.every((h) => anyNeg(h.start))) direction = 'down'
    objective = objectives.find((o) => o.metric === m && o.direction === direction)?.id ?? null
    if (objective) evidence.push(`talks about ${m} going ${direction} → ${objective}`)
    else notes.push(`${m} going ${direction} matches no objective`)
  }
  if (!objective && complaint.length && !metricHits.length) {
    objective = objectives.find((o) => o.metric === 'volatility' && o.direction === 'down')?.id ?? null
    if (objective) evidence.push(`“${complaint[0].phrase}” → ${objective}`)
  }
  if (!objective && !metricHits.length) {
    const g = findAll(toks, 0, toks.length, lex.generalWords).find((h) => !anyNeg(h.start))
    const general = g ? objectives.find((o) => o.metric === 'none') : undefined
    if (general) {
      objective = general.id
      evidence.push(`“${g!.phrase}” → ${general.id}`)
    }
  }
  if (implied_risk === 'neutral' && objective && !(isQuestion && !directed && !actionVerbs && !desire)) {
    const o = objectives.find((x) => x.id === objective)
    if (o && o.lean !== 'neutral') {
      implied_risk = o.lean
      evidence.push(`goal ${o.id} → ${o.lean.replace('_', ' ')}`)
    }
  }

  // Explicit trades: a buy/sell of a named asset with an amount in the same clause, outside any "if".
  const requested_trades: RuleReading['requested_trades'] = []
  for (const x of roles) {
    if ((x.role !== 'buy' && x.role !== 'sell') || x.r.c.cond) continue
    const inClause = qs.filter((q) => q.start >= x.r.c.start && q.start < x.r.c.end && !isIn(toks[q.start - 1], MARKET_MOVES) && !isIn(toks[q.start - 2], MARKET_MOVES))
    const q = inClause.find((q) => !q.all) ?? (x.role === 'sell' ? inClause.find((q) => q.all) : undefined)
    if (!q) continue
    const t = x.a.mention.asset.ticker
    if (requested_trades.some((r) => r.ticker === t)) continue
    requested_trades.push({ ticker: t, side: x.role === 'buy' ? 'BUY' : 'SELL', usd: q.usd ?? 0, percent: q.usd ? 0 : (q.percent ?? 0) })
  }
  if (requested_trades.length) evidence.push(`explicit amounts: ${requested_trades.map((r) => `${r.side.toLowerCase()} ${r.usd ? `$${r.usd.toLocaleString()}` : `${r.percent}%`} ${r.ticker}`).join(', ')}`)

  const signal = known.length || unknown.length || objective || implied_risk !== 'neutral' || actionVerbs || STATUS_WORDS.some((w) => lower.includes(w))
  const request_type: RuleReading['request_type'] =
    isQuestion && !polite ? (known.length || unknown.length || objective || implied_risk !== 'neutral' || actionVerbs ? 'advice' : 'other') : desire || polite || imperative || actionVerbs || (signal && !STATUS_WORDS.some((w) => lower.includes(w))) ? 'suggestion' : 'other'
  evidence.unshift(request_type === 'advice' ? 'a question → advice' : request_type === 'suggestion' ? 'an instruction or wish → suggestion' : 'no investing action → other')

  // Confidence: how much of the reading rests on clear signals.
  let confidence = 1
  if (!known.length && !unknown.length && !objective && request_type !== 'other') {
    confidence -= 0.5
    notes.push('no asset and no goal found')
  }
  if (up.length && down.length) {
    confidence -= 0.2
    notes.push('mixed risk signals')
  }
  if (metricHits.length > 1) {
    confidence -= 0.15
    notes.push(`several topics: ${metricHits.map((x) => x.m).join(', ')}`)
  }
  if (clauses.some((r) => r.c.cond)) {
    confidence -= 0.1
    notes.push('conditional request')
  }

  const rules: RuleReading = { request_type, objective, implied_risk, known, unknown, requested_trades, evidence }
  return { ...rules, confidence: Math.max(0, Math.round(confidence * 100) / 100), confidenceNotes: notes }
}

/** Unknown names in a request: after a lead word ("invest in SpaceX"), or a capitalised name mid-sentence ("my friend says Rivian…"). */
function unknownNames(toks: Tok[], assets: Asset[], lex: RuleLexicon, investorName: string): string[] {
  const stop = new Set([...lex.stopWords, investorName].map((s) => s.toLowerCase()))
  const known = findMentions(toks, assets)
  const out: string[] = []
  const push = (n: string) => n.length >= 3 && !out.some((o) => o.toLowerCase() === n.toLowerCase()) && out.push(n)
  for (const h of findAll(toks, 0, toks.length, lex.assetLeadWords)) for (const n of namesAfter(toks, h.end, toks.length, assets, lex, investorName)) push(n)
  toks.forEach((t, i) => {
    const sentenceStart = i === 0 || toks[i - 1].sent !== t.sent
    if (!/^[A-Z][a-z]/.test(t.text) || sentenceStart || t.tags.has('Person') || t.tags.has('Pronoun')) return
    if (known.some((m) => i >= m.start && i < m.end) || stop.has(t.w) || t.forms.some((f) => stop.has(f))) return
    if (!(t.tags.has('ProperNoun') || t.tags.has('Organization') || t.tags.has('Noun'))) return
    push(t.text)
  })
  return out
}
