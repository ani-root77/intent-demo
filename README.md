# Clario: A Trust Layer for Autonomous Investing

> **AI can make the decision. It should never be the judge of its own decision.**

Clario is an independent trust layer that sits between **any** AI investment agent and the investor. Every action the agent proposes is checked against the investor's intent, hard constraints, risk profile and modeled long-term outcome. Only then can it reach the investor for approval.

This repo is the **interactive concept demo** for our ideathon pitch. It's a mock-up: the AI agent is scripted, the investor is fictional, and no trades are executed. The Clario side (policy checks, Financial Twin simulation, decisions, feedback, audit trail) is computed live in the browser.

For how to pitch it, see [`PRESENTATION_GUIDE.md`](PRESENTATION_GUIDE.md).

---

## Run it locally

### 1. Prerequisites

| Tool | Version | Check with |
|---|---|---|
| Node.js | **20.19+ or 22.12+** (Vite 8 needs one of these) | `node -v` |
| npm | comes with Node | `npm -v` |
| Git | any recent version | `git --version` |

If Node is missing or too old, install the LTS release from [nodejs.org](https://nodejs.org) (or use `nvm` / `fnm`).

### 2. Clone and install

```bash
git clone https://github.com/ani-root77/intent-demo.git
cd intent-demo
npm install
```

### 3. Start the dev server

```bash
npm run dev
```

Open **http://localhost:5173** in Chrome or Edge.

### 4. (Optional) Production build, e.g. for demo day

```bash
npm run build
npm run preview
```

`npm run preview` serves the built app at **http://localhost:4173**. The built files in `dist/` are fully static, so you can also host them on GitHub Pages, Netlify or Vercel.

> **Demo-day tip:** run `npm install` and `npm run build` the night before, while you're on good Wi-Fi. After that the app works offline. Only the Google Fonts are fetched online, and it falls back to system fonts without them.

---

## Investor portal + AI Advisory (the landing page)

The app opens on a mock investor portal (no brand, fictional accounts, simulated market). The **AI advisory** button next to *Contact your team* opens a full-screen advisory window:

- Ask for a **suggestion** ("Increase my AI exposure") or for **advice** ("Should I invest in SpaceX?"). Each question is answered on its own; it is not a chat.
- **Clario off:** the AI advisor's answer exactly as Gemini wrote it.
- **Clario on:** the same answer, plus:
  - a verdict: **Verified**, **Use with caution**, **BLOCKED BY CLARIO: DO NOT FOLLOW**, **Cannot verify**, or **No action recommended**
  - every check as a pass/warn/fail flag, with its numbers
  - the Financial Twin simulation and before/after stats
  - a synthetic "similar investors" cohort
  - what supports the answer and what argues against it
  - the news the AI relied on (verified or not)
  - the exact prompts and raw model output
- If the AI advises against an explicit request ("put 40% into Bitcoin"), Clario simulates the request anyway, so you can see whether the advice holds up.
- **Intent drift:** if a request implies much more or less risk than the saved profile, a side panel asks whether the investor's goal has changed. One request never changes the profile on its own: the investor can start a short **risk review** (3 questions, scored by rules). Only if the result differs from the current profile, and the investor explicitly applies it, are the risk level and matching limits updated. The answer is then re-checked immediately, and the change can be undone.

**What is AI and what is not.** Principle: *the AI never assesses itself, and Clario never asks an AI whether an answer is good.*

| Step | How |
|---|---|
| AI advisor's answer | Gemini (`model`). This is the thing being checked |
| Reading the request | **Rules only, no AI** (`src/engine/rules.ts`): keyword lists, asset names and aliases, amounts. The reading is shown to the investor as an editable card; any correction re-checks the answer instantly. If the rules can't tell what a request is about, the verdict is held until the investor confirms what they meant |
| Reading the answer | **Rules only.** Clario scans the advisor's text for what it tells you to buy, sell or avoid, and for assets it can't model. The advisor's own labels (its verdict, its "unverifiable assets" list) are not used for any decision |
| Checks, simulation, cohort, verdict, drift | **Code only** (`src/engine/advisory.ts`, `guard.ts`, `twin.ts`, `cohort.ts`) |

In the report, every check is marked ⚙ (rule-based) or ◐ (uses Clario's AI reading of the request, cross-checked by rules). The keyword lists are editable under *Settings → Clario rules*, and asset aliases under *Settings → Assets*.

The **Text matches trades** check catches answers whose words and trades disagree. Examples: the text says "buy QQQ and NVDA" but the trades only buy QQQ, or the trades buy something the text advises against.

The signed-in investor is switched from the avatar menu, which also links to the **Clario lab** (Playground, Guided demo, How it works). The portal and the lab share one workspace, so profiles and settings edited in the lab apply to the portal. Portal-specific settings live under *Settings → Market today* and *Settings → AI advisory* (advisor persona, drift sensitivity, prompts). Use the **Gullible** persona to see Clario block bad advice.

---

## Playground (Clario lab)

A proof-of-concept workbench where every parameter is editable, for testing how Clario behaves.

```bash
cp .env.example .env      # set GEMINI_API_KEY (only needed for the live agent)
npm run dev               # UI + API on http://localhost:5173
# or: npm run build && npm start   (UI + API on http://localhost:8787)
```

The key is read only by the server (`server/`). It never reaches the browser.

**Test**
- **Live agent:** Gemini plays the agent; Clario's rules read the request (no AI). Each step streams in as it happens. An animated pipeline shows the flow: investor → rules → intent lock → agent → validator → verifier → decision, with the feedback loop. Every Gemini call is shown with its exact system prompt, user prompt, raw reply and timing. Replay at any speed, or step through.
- **Sandbox:** build a proposal by hand. All 8 checks and the Financial Twin recompute as you type, with no API calls. You can also toggle untrusted context, a mislabelled objective, or the attempt number.

**Customer profiles:** create, duplicate and delete investors. Each profile has:
- personal details and goal
- holdings per asset
- its own hard limits
- its own decision rules: for each check, whether a failure **blocks**, sends it back for **revision**, or is **off**

**Settings**
- **Assets:** add or remove instruments and edit their expected return, volatility, beta, tech share and crash risk.
- **Objectives:** define your own. Each is a metric (tech exposure, volatility, cash, equity, expected return or none) plus a direction. Clario's rules (and the investor) can only choose from this list.
- **Market & simulation:** market volatility, number of simulated paths, seed, and how many paths are drawn.
- **Agent:** model (lists the models your key can use), temperatures, repair attempts, whether the agent sees the limits up front, agent styles, and the system prompt.
- **Import / export:** the whole configuration as JSON, or reset to defaults.

Everything is one *workspace*, autosaved to `data/workspace.json` (git-ignored). `src/engine/config.ts` holds the defaults and the single sanitiser that clamps every user value before the engine sees it.

**Guarantees that hold whatever you configure**
- Clario has no AI parser: requests are read by rules, shown to the investor, and correctable. A request the rules can't read gets no verdict until the investor confirms it.
- The locked intent's goal, risk profile and limits come from the profile, not the model. The intent is frozen and fingerprinted.
- The server sets the attempt counter, the proposal id, the trigger, and context trust. Anything the agent sends for these is ignored.
- Malformed proposals are rejected before verification and don't count as attempts. Examples: unknown ticker, overselling, buys not funded by sells.
- Verification has no AI in it. The same proposal and the same settings always give the same result.

**API for any agent:** these routes use the saved workspace.

| Route | Purpose |
|---|---|
| `POST /v1/intents` `{text, kind?, profile_id?, objective?}` | Parse and lock an intent |
| `POST /v1/intents/:id/context` `{source, text}` | Register content the agent was given (untrusted) |
| `POST /v1/verify` `{intent_id, agent, proposal}` | Verify one proposal. Returns the decision, checks and feedback |
| `GET /v1/intents/:id` | Locked intent and attempt history |

A proposal looks like `{action, summary, rationale, addresses, trades: [{ticker, side: "BUY"|"SELL", usd}]}`.

---

## Presenter controls

| Key / control | Action |
|---|---|
| `→` / `Space` / `PageDown` / **Next** | Next step |
| `←` / `PageUp` | Previous step |
| `1` `2` `3` | Switch scenario |
| `R` | Restart the scenario |
| ▶ button | Autoplay (3 s per step) |
| Progress bar segments | Jump to any step |

Presentation clickers send `PageDown` / `PageUp`, so you can drive the demo with a clicker.

Best viewed at **1440 px wide or more**. At 1920×1080 everything fits on one screen. On a smaller laptop, zoom the browser to 80–90%.

---

## What the demo shows

### Screens
- **Live demo:** the loop diagram (Investor → AI Agent → Clario → Outcome, with the feedback loop), a step-by-step feed, the investor's hard constraints, the Financial Twin chart, and a hash-chained audit trail.
- **How it works:** the "bring any agent" architecture, the `POST /v1/verify` API contract, separation of duties, a comparison with other approaches, the four decisions, and the non-negotiable principles.

### Scenarios
| # | Scenario | What happens | Final decision |
|---|---|---|---|
| 1 | **Intent drift** | Maya: "Increase my AI exposure." The agent proposes $35k in one AI stock. Clario finds 5 violations (single stock 11.7% vs 5%, tech 31.7% vs 30%, cash $10k vs $20k, risk band, goal likelihood 75% → 66%) and returns **REVISE** with structured feedback. The agent revises to a $15k diversified AI ETF, which passes (goal likelihood 76%). | **ALLOW** → Maya approves |
| 2 | **Protect (attack)** | An untrusted "URGENT MARKET ALERT" makes the agent try to move 40% ($120k) into two AI stocks. Context trust, intent alignment and anomaly checks fail. Goal likelihood would fall 75% → 47%. | **BLOCK**, nothing executed |
| 3 | **Agent keeps failing** | The agent keeps proposing a single stock ($35k → $25k → $18k). It improves, but never complies. After 3 attempts Clario escalates. | **HUMAN REVIEW** |

### Try it live
The **Hard constraints** panel is editable. Change a limit (for example, raise *Max single stock* to 15%) and every check, decision and step recomputes immediately. This shows that the constraints are enforced outside the agent and are owned by the investor.

The **Connected agent** dropdown swaps the agent vendor. The protection stays the same, because Clario doesn't depend on which agent is used.

---

## What's real vs. mocked

| Part | Status |
|---|---|
| AI Agent proposals | **Mocked.** Scripted in `src/engine/scenarios.ts` to stand in for any third-party agent |
| Intent parsing | **Mocked.** The structured intent is built from the scenario and the profile |
| Policy / risk checks (8 checks) | **Real, deterministic.** `src/engine/guard.ts` |
| Decision logic (ALLOW / REVISE / BLOCK / HUMAN_REVIEW) | **Real, deterministic.** `src/engine/guard.ts` |
| Structured feedback to the agent | **Real.** Computed from the violations and limits |
| Financial Twin | **Real Monte Carlo.** 5,000 seeded paths, `src/engine/twin.ts` |
| Revision loop and retry cap | **Real.** `buildFlow()` in `src/engine/scenarios.ts` |
| Audit trail | **Real, in-memory.** Hash-chained with FNV-1a (not persisted) |
| Trades, accounts, market data | **None.** Fictional tickers, nothing executed |

### Financial Twin assumptions (editable in `src/engine/model.ts`)
- One-factor market model (market volatility 15%) plus asset-specific risk, rebalanced annually.
- Contributions of $5,000/month, horizon from age 35 to 55, target $2.5M.
- Single stocks (NVAI, CRTX) carry a tail event: a 12% chance per year of a −65% drawdown. This is how the model captures concentration risk.
- The current and proposed portfolios run through **the same** random market scenarios (seed 7), so any difference comes from the portfolio and not from luck.
- The numbers are illustrative. The app always says "modeled goal likelihood" and never "prediction".

---

## Project structure

```
intent-demo/
├── index.html
├── src/
│   ├── engine/            ← the Clario logic (framework-free TypeScript)
│   │   ├── model.ts       ← assets, demo investor (Maya), hard constraints
│   │   ├── twin.ts        ← Financial Twin (seeded Monte Carlo)
│   │   ├── guard.ts       ← 8 checks, decision logic, structured feedback
│   │   └── scenarios.ts   ← mocked agent proposals + the verify/revise loop
│   ├── ui/                ← React components (diagram, feed, panels, audit trail)
│   ├── App.tsx            ← layout, state, keyboard controls
│   └── index.css          ← Tailwind v4
└── PRESENTATION_GUIDE.md  ← how to pitch it to the judges
```

**Stack:** React 19, Vite 8, TypeScript, Tailwind CSS v4, Recharts, Framer Motion, lucide-react.

### Useful edits
- **Change the investor:** `MAYA` in `src/engine/model.ts`
- **Change the default limits:** `DEFAULT_POLICY` in `src/engine/model.ts`
- **Add a scenario:** add an entry to `SCENARIOS` in `src/engine/scenarios.ts` (the intent plus a list of proposals). The loop, checks and UI are generated from it.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm run dev` fails with a Node version error | Upgrade Node to 20.19+ or 22.12+ |
| Port 5173 already in use | Vite picks the next free port. Use the URL it prints |
| Page is blank | Check the browser console. Run `npm install` again, then `npm run dev` |
| Layout looks cramped | Widen the window or zoom out (Ctrl/Cmd −) |

---

*Hackathon concept demo. Fictional investor, fictional tickers, simulated outcomes. Not financial advice, not an official product of any firm, and no real trades are executed.*
