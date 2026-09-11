# INTENT: A Trust Layer for Autonomous Investing

> **AI can make the decision. It should never be the judge of its own decision.**

INTENT is an independent trust layer that sits between **any** AI investment agent and the investor. Every action the agent proposes is checked against the investor's intent, hard constraints, risk profile and modeled long-term outcome. Only then can it reach the investor for approval.

This repo is the **interactive concept demo** for our ideathon pitch. It's a mock-up: the AI agent is scripted, the investor is fictional, and no trades are executed. The INTENT side (policy checks, Financial Twin simulation, decisions, feedback, audit trail) is computed live in the browser.

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
- **Live demo:** the loop diagram (Investor → AI Agent → INTENT → Outcome, with the feedback loop), a step-by-step feed, the investor's hard constraints, the Financial Twin chart, and a hash-chained audit trail.
- **How it works:** the "bring any agent" architecture, the `POST /v1/verify` API contract, separation of duties, a comparison with other approaches, the four decisions, and the non-negotiable principles.

### Scenarios
| # | Scenario | What happens | Final decision |
|---|---|---|---|
| 1 | **Intent drift** | Maya: "Increase my AI exposure." The agent proposes $35k in one AI stock. INTENT finds 5 violations (single stock 11.7% vs 5%, tech 31.7% vs 30%, cash $10k vs $20k, risk band, goal likelihood 75% → 66%) and returns **REVISE** with structured feedback. The agent revises to a $15k diversified AI ETF, which passes (goal likelihood 76%). | **ALLOW** → Maya approves |
| 2 | **Protect (attack)** | An untrusted "URGENT MARKET ALERT" makes the agent try to move 40% ($120k) into two AI stocks. Context trust, intent alignment and anomaly checks fail. Goal likelihood would fall 75% → 47%. | **BLOCK**, nothing executed |
| 3 | **Agent keeps failing** | The agent keeps proposing a single stock ($35k → $25k → $18k). It improves, but never complies. After 3 attempts INTENT escalates. | **HUMAN REVIEW** |

### Try it live
The **Hard constraints** panel is editable. Change a limit (for example, raise *Max single stock* to 15%) and every check, decision and step recomputes immediately. This shows that the constraints are enforced outside the agent and are owned by the investor.

The **Connected agent** dropdown swaps the agent vendor. The protection stays the same, because INTENT doesn't depend on which agent is used.

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
│   ├── engine/            ← the INTENT logic (framework-free TypeScript)
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
