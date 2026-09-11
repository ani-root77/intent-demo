# INTENT: Presentation Guide for the Ideathon Panel

> **One sentence:** INTENT is an independent trust layer that checks autonomous investment actions against the investor's intent, hard constraints and modeled long-term outcome.
>
> **Line to remember:** *AI can make the decision. It should never be the judge of its own decision.*

This guide is built from our master reference document and the team's discussion about what INTENT is. The demo app in this repo is designed to back up every claim below.

---

## 1. Get the story straight first (team alignment)

In our team chat there was real confusion about whether INTENT is "an AI" or "an LLM". The judges will ask the same thing. Everyone on the team should give **the same answer**.

### What INTENT is, in one breath
> "INTENT is the validation layer between the investor and whatever AI agent they use. The agent proposes. INTENT checks the proposal against the investor's locked intent and hard limits, and runs a quantitative simulation of what it does to their long-term goal. If it fails, INTENT sends back structured feedback and the agent has to revise. That loop continues until INTENT gives a clear ALLOW, or it escalates to a human. The investor always approves last."

### The three pieces, and what to call each one

| Piece | Is it AI? | Say this | Don't say this |
|---|---|---|---|
| **Policy engine + AgentGuard** (the decision) | **No. Deterministic.** Same proposal + same limits = same decision, every time | "rule-based", "deterministic", "enforcement" | "our AI decides" |
| **Financial Twin** (the simulation) | **No. Statistical.** It's a Monte Carlo simulation, not a trained model | "quantitative simulation", "scenario modeling", "modeled goal-success likelihood" | "AI prediction", "it predicts the market" |
| **Intent parser** (optional) | **Optional AI.** It turns natural language into structured intent | "optional helper that can never override hard limits" | "an LLM judges the agent" |

> **Watch out:** in the chat one teammate described INTENT as "also an AI model in the sense that it uses modelling". That's a fair intuition, but **don't say it to the judges**. Our whole differentiator is that INTENT is *not* a second AI grading the first. Say "quantitative simulation" instead.

### What "structured feedback" means
It's **not** a chat message and **not** an LLM talking to an LLM. It's a machine-readable object: which checks failed, the observed vs. allowed values, and the limits a revision has to meet (for example, "max single stock: $15,000"). The demo shows the exact JSON. **INTENT never suggests the replacement investment.** The agent has to come up with it.

### Our credibility comes from the separation
We are **not** building an AI agent. We're building the layer that makes *any* agent accountable to the investor. Other teams will most likely ship "agent + safety check" as one bundle, which means the AI is still grading its own homework.

**How to say it subtly (never name or attack other teams):**
- "INTENT works with whichever agent the investor uses: a vendor's, a startup's, or the firm's own."
- "If the same system builds the proposal and approves it, the AI is still grading its own homework. We separated the two on purpose."
- "We're not trying to make the agent smarter. We're making it accountable."
- **In the demo:** switch the **Connected agent** dropdown live and say "the agent just changed. The protection didn't."

---

## 2. Run-sheet

### Standard slot (8 min pitch + demo, then Q&A)

| Time | Section | Who | Slides / screen |
|---|---|---|---|
| 0:00–0:30 | Hook | Speaker A | Slide 1 |
| 0:30–1:45 | Problem: from advice to action, intent drift | Speaker A | Slides 2–3 |
| 1:45–2:45 | Solution + architecture + separation | Speaker B | Slides 4, 10 |
| 2:45–6:15 | **Live demo** (scenario 1, then 2, mention 3) | Speaker C drives, Speaker B narrates | App |
| 6:15–7:15 | Why Fidelity + feasibility | Speaker A | Slides 8–9 |
| 7:15–8:00 | Vision + close | Speaker A | Slides 11–12 |

### Short slot (5 min)
Hook (20 s) → Problem (50 s) → Solution (40 s) → Demo scenario 1 only, jumping straight to the verify and outcome steps (2 min) → Protect in one sentence plus one click to show BLOCK (30 s) → Close (20 s).

> Assign speakers based on who is strongest at each part. Whoever drives the demo should have rehearsed the key presses at least 5 times.

---

## 3. Slide-by-slide speaker notes

**Slide 1: Title**
"INTENT: a trust layer for autonomous investing." Pause. "AI should never be the judge of its own decisions."

**Slide 2: Problem**
"Today AI analyzes investments. The next step is AI agents that *act* for investors. So who checks the AI when it acts?"
"A trade doesn't have to be fraudulent to be wrong. If an investor says 'increase my AI exposure' and the agent puts a big chunk into one AI stock, the trade is legitimate. It still breaks her risk limits and puts her retirement goal at risk. We call this **intent drift**."

**Slide 3: Why existing approaches fall short**
"Prompts are guidance, not enforcement. Fraud detection looks for suspicious transactions, but this transaction isn't suspicious. It's just wrong *for this investor*. Nothing checks investor-specific intent and long-term impact."

**Slide 4: Solution**
"The AI agent proposes. The Financial Twin models the consequences. INTENT verifies independently. The investor keeps final approval. It's *Generate → Verify → Revise → Verify* instead of *AI → Execute*."

**Slides 5–7: Scenario, loop, Protect** → **go to the live demo** (section 4). If there's no time for the demo, walk through these slides using screenshots from the app.

**Slide 8: Why Fidelity**
"This fits naturally with what a long-term wealth manager cares about: investor goals, portfolio context, retirement outcomes, advisor oversight and responsible AI. INTENT doesn't replace agents or advisors. It lets firms give agents more autonomy *safely*." (Framing: **don't** say "AI is dangerous". Say "AI expands what investors can do, and INTENT provides the trust layer when it gains autonomy.")

**Slide 9: MVP feasibility**
"What you just saw is a working prototype: a synthetic portfolio, a mocked agent, a deterministic verifier with 8 checks, a real 5,000-path Monte Carlo twin, and a trust dashboard with an audit trail. The agent is deliberately mocked because it's interchangeable. That's the point."

**Slide 10: Differentiation**
"Not a smarter financial agent. An independent layer that makes autonomous financial decisions accountable." (Show the "How INTENT differs" table from the app's *How it works* tab.)

**Slide 11: Vision**
"Any agent, any vendor, one standard of accountability to the investor."

**Slide 12: Close**
"AI proposes → INTENT verifies → AI revises → the investor stays in control. AI can make the decision. It should never be the judge of its own decision. Thank you."

---

## 4. Live demo script (click by click)

**Before you start:** app open in full-screen browser (F11), scenario 1, step 1, *Hard constraints* reset. Zoom so the loop diagram and the three panels fit on screen.

### Scenario 1: Intent drift (the main story, about 2.5 min)

| Step | Press | Point at | Say |
|---|---|---|---|
| 1 | (start) | Maya's card, left | "Meet Maya: 35, $300k, wants to retire at 55 with $2.5 million, moderate risk. She tells her AI agent: *increase my AI exposure*." |
| 2 | `→` | JSON card + teal arc | "INTENT turns that into structured intent and **locks** it: her objective plus her hard limits. The agent can read these but can't change them." |
| 3 | `→` | Agent card | "This is a third-party agent. We mock it because INTENT doesn't care which agent it is. It proposes $35,000 into one AI stock. That sounds reasonable." |
| 4 | `→` | Checks animating, then the Twin panel | "INTENT recalculates independently, with no AI in this step. Single stock 11.7% vs a 5% limit. Tech 31.7% vs 30%. Cash drops below her $20k buffer. And the Financial Twin shows her modeled goal likelihood falling from **75% to 66%**. Decision: **REVISE**." |
| 5 | `→` | Orange feedback arc + JSON | "This is the key part. INTENT doesn't pick a better investment. It sends structured feedback: what failed and the limits a revision has to meet. The agent has to fix its own proposal." |
| 6 | `→` | Agent card v2 | "The agent revises: $15,000 into a diversified AI ETF." |
| 7 | `→` | All green | "Verified again from scratch. Everything passes, and goal likelihood stays around **76%**. **ALLOW**." |
| 8 | `→` | Investor dashboard | "Only now does Maya see it, in plain terms: what happens to her money, and what INTENT stopped. The first proposal would have cut her bad-case outcome at 55 from about $2.07M to $1.71M. She approves. Even an ALLOW doesn't execute on its own." Click **Approve**, then point at the audit trail: "Every step is logged and hash-chained." |

### Scenario 2: Protect (about 45 s)
Press `2`, then `→` through the steps.
"Now a controlled attack. An untrusted *URGENT MARKET ALERT* gets into the agent's inputs, and the agent tries to move **40%** of the portfolio into two AI stocks. INTENT flags it: not requested by Maya, driven by an untrusted source, an abnormally large move, every limit broken, and goal likelihood would fall to **47%**. **BLOCK**. Nothing executes, and Maya gets a plain-English explanation."
Caveat to say out loud: "We don't claim to detect every prompt injection. INTENT blocked this because the *action* breaks Maya's policy and goal, whatever caused it."

### Scenario 3: The agent keeps failing (15 s, or save it for Q&A)
Press `3`, then jump to the end on the progress bar.
"If the agent keeps failing, and here it improves each time but never complies, INTENT caps the retries at 3 and escalates to a human. Unclear authorization never quietly becomes approval."

### Power move (if a judge is sceptical, or there's time)
In **Hard constraints**, change *Max single stock* from 5 to 15 and replay scenario 1. The checks and decisions recompute live.
"The limits belong to the investor, not the agent. Change them and enforcement changes immediately. The agent's prompt was never involved."

> **About the numbers:** our reference document used 76% → 63% as illustrative figures. The demo **calculates** its numbers from transparent assumptions: current plan 75%, concentrated proposal 66%, revised 76%, attack 47%. When the app is on screen, quote the app's numbers and always call them "modeled goal likelihood".

---

## 5. Language guardrails

| ✅ Say | ❌ Avoid |
|---|---|
| "modeled goal-success likelihood", "scenario-based" | "INTENT predicts 76%" |
| "deterministic verification", "enforcement" | "our AI checks their AI" |
| "AI expands what investors can do. INTENT makes autonomy trustworthy" | "AI is dangerous" |
| "reduces specific autonomy and alignment risks" | "guarantees better returns", "eliminates risk" |
| "a controlled attack scenario" | "we detect all prompt injections / fraud" |
| "concept demo, fictional investor, simulated" | presenting it as a Fidelity product or real advice |
| "works with any agent" | "our agent" |

---

## 6. Judge Q&A bank, and whether the demo can show it

Legend: ✅ the demo shows it directly · 🟡 the demo supports it partly · 🗣️ answer verbally

| # | Likely question | Short answer | Demo? |
|---|---|---|---|
| 1 | Why not just put the rules in the agent's prompt? | A prompt is guidance, not enforcement. INTENT recalculates exposure and impact *outside* the agent's reasoning. | ✅ Verify card is marked "deterministic, no AI". Edit a hard constraint live |
| 2 | Is INTENT itself an AI or an LLM? | No. The decision core is deterministic, the Twin is a statistical simulation, and only the optional intent parser uses AI. The parser can't override limits. | ✅ Verify card label + *How it works* → Separation of duties |
| 3 | How does "structured feedback" work? Is it one LLM talking to another? | It's a JSON contract: violations, observed vs. limit, and constraints for the revision. | ✅ Feedback card (scenario 1, step 5) |
| 4 | Why doesn't INTENT propose the better alternative itself? | Then it would become the advisor, and we'd be back to an AI judging its own ideas. The verifier only verifies. | ✅ Feedback note "does not suggest investments" |
| 5 | What if the agent never gets it right? | Retries are capped, then HUMAN_REVIEW. It's never silently approved. | ✅ Scenario 3 |
| 6 | How is the Financial Twin calculated? Is 75% a prediction? | A 5,000-path seeded Monte Carlo with transparent assumptions. It compares portfolios under the same scenarios. It's a likelihood, not a forecast. | ✅ Twin panel → "Transparent assumptions" |
| 7 | Where would real assumptions come from, and how do you validate them? | The firm's own capital-market assumptions. Back-test and calibrate, and keep them versioned in the audit log. | 🟡 Assumptions visible; the validation process is verbal |
| 8 | How do you protect against manipulation or prompt injection? | We check the *action* against intent, policy, anomaly and source trust. We don't claim universal detection. | ✅ Scenario 2 |
| 9 | Does INTENT guarantee better returns? | No. It reduces specific alignment and autonomy risks. Market risk remains. | 🗣️ (footer disclaimer) |
| 10 | Different investors have different limits. How is that handled? | The limits are per-investor policy, owned by the investor or advisor, and editable only by them. | ✅ Edit the Hard constraints panel live |
| 11 | How does it plug into existing agents? | Through an API: the agent sends a proposal to `POST /v1/verify` and gets back a decision, feedback and an audit ID. | ✅ Connected-agent dropdown + *How it works* → API contract |
| 12 | Couldn't the agent game it, for example by splitting one big trade into small ones? | Checks run on the *resulting portfolio*, not on individual trades, so splitting doesn't avoid the position or sector limits. In production you'd add rolling-window anomaly checks. | 🟡 Checks visibly use the after-trade portfolio. The rolling window is verbal |
| 13 | What if Maya wants the risky trade anyway? | She's the authority. She can change her policy, or approve an override with explicit acknowledgement, which gets logged. The agent can't do either. | 🟡 Editing the constraints shows it. The override flow is verbal |
| 14 | Won't it block too much and annoy users? | REVISE is the default, not BLOCK. The agent fixes the proposal, so the user still gets what they asked for. The thresholds are configurable. | ✅ Scenario 1 (REVISE → ALLOW) |
| 15 | How is this different from robo-advisor risk checks or pre-trade compliance? | Those check static rules on transactions. INTENT checks faithfulness to *this investor's* stated intent plus the long-term goal impact, and sits in front of *third-party autonomous agents*. | ✅ *How it works* → comparison table |
| 16 | What if the intent parser misreads the request? | The structured intent is shown and locked, and the investor can confirm it. The parser can't loosen hard limits. Ambiguity goes to HUMAN_REVIEW. | ✅ Parse card (step 2) |
| 17 | Who is accountable if something goes wrong? | Every proposal, check, revision and approval is logged in a tamper-evident audit trail, and the investor gives the final approval. | ✅ Audit trail |
| 18 | Latency and scale? | The deterministic checks take milliseconds. 5,000 paths run in the browser in well under a second, and a server with caching is faster. | 🟡 It's visibly instant in the demo. Scaling is verbal |
| 19 | Regulation (suitability, best interest, supervision)? | INTENT produces the evidence trail supervisors need, and keeps a human in the loop. We don't claim it makes anyone compliant by itself. | 🗣️ |
| 20 | Business model, and who pays? | B2B: firms deploying investment agents license INTENT, priced per verification or per account. The value is trust, oversight and fewer escalations. | 🗣️ |
| 21 | Why Fidelity? | Long-term goals, portfolio context, retirement planning, advisor oversight, and responsible autonomous AI. | 🗣️ |
| 22 | What's actually built vs. mocked? | Mocked: the agent, the investor, the tickers. Real and live: the 8 checks, the decisions, the feedback, the Monte Carlo twin, the retry loop, the audit chain. | ✅ Header badge + README table |
| 23 | Why a Financial Twin when you already have rules? | Rules say whether an action is *allowed*. The Twin says whether it *helps or hurts the goal*. Scenario 3 v2 passed the cash, sector and risk rules but still cut goal likelihood by more than 5 pts. | ✅ Scenario 3, v2 verify card |
| 24 | How do you handle multi-step or gradual drift over time? | Each proposal is verified against the current locked intent and the resulting portfolio. Next step: cumulative drift monitoring over a time window. | 🗣️ |
| 25 | How would you measure success? | Intent-drift catches, the revise-to-allow rate, goal likelihood preserved, time to approval, and escalation rate. | 🗣️ |
| 26 | Who sets the limits in the first place? | The risk questionnaire and advisor set the defaults. The investor confirms them. Only humans can edit them. | 🟡 Hard constraints panel |

**Coverage:** of 26 likely questions, the demo **directly answers 15**, **partly supports 5**, and **6 are verbal-only** (returns guarantee, regulation, business model, Why Fidelity, drift over time, success metrics). Prepare one confident sentence for each of those.

---

## 7. Pre-flight checklist and fallback

- [ ] `npm install` and `npm run build` done the day before. Test `npm run preview` offline.
- [ ] Laptop charged, notifications off, browser zoom set, F11 full screen.
- [ ] Scenario 1 at step 1, constraints reset (click **Reset**).
- [ ] Screen-record one full run of scenarios 1 and 2 as a **backup video**.
- [ ] Put 3 screenshots in the deck (verify REVISE, feedback JSON, investor dashboard) in case the demo can't be shown.
- [ ] Every speaker can give the "what INTENT is, in one breath" answer (section 1) word for word.
- [ ] Rehearse Q&A questions 1, 2, 5, 6, 8 and 15 out loud. They are the most likely.

---

*Concept demo for an ideathon. Fictional investor, fictional tickers, simulated outcomes. Not financial advice and not an official product of any firm.*
