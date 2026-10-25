# Clario reader evaluation

Compares the original keyword reader (src/engine/rules.ts) with the NLP reader (src/engine/nlp.ts).
Both are deterministic and use the same editable keyword lists; the NLP reader adds tokenising, lemmas,
clause splitting, NegEx negation scope, verb–object attachment, modality, coreference and number words.

How the sets were made
- **dev**: used while building and tuning the NLP reader. Its scores are optimistic by design.
- **held-out test**: written before the NLP reader existed and never used for tuning. One label was corrected
  before the NLP reader first ran on it ("don't add to it" is *avoid* under the labelling rules in types.ts).
- **real Gemini**: 15 answers from the live advisor (default workspace), labelled by hand before either reader
  ran on them. They were read while labelling, so they are not blind to the reader's author.
- All labels were written by one person (the reader's author). Treat the numbers as an honest indication,
  not a benchmark; a larger set labelled by someone else is the next step.

Regenerate: npx tsx eval/run.ts --all. Determinism, crash and speed checks: npx tsx eval/robust.ts.

## Requests · dev (30 requests)

| Field | Rules (before) | NLP (after) |
|---|---|---|
| type | 77% (23/30), 5 no answer | 100% (30/30) |
| objective | 93% (28/30) | 97% (29/30) |
| lean | 77% (23/30) | 100% (30/30) |
| assets | 93% (28/30) | 100% (30/30) |
| unknown | 100% (30/30) | 100% (30/30) |
| trades | 79% (23/29) | 100% (29/29) |
| **all fields right** | 37% (11/30) | 97% (29/30) |

<details><summary>Rules (before): 24 errors</summary>

- type: want `suggestion`, got `(no answer) null` · “Do something smart with my money”
- assets: want `AMD`, got `-` · “sell all of my amd shares”
- trades: want `AMD|SELL|100%`, got `-` · “sell all of my amd shares”
- lean: want `conservative`, got `neutral` · “I need $25,000 in cash for my daughter’s tuition”
- trades: want `VXUS|SELL|$10000 QQQ|BUY|$10000`, got `-` · “Shift ten thousand dollars from VXUS into QQQ”
- lean: want `neutral|conservative`, got `aggressive` · “I don't want more crypto”
- type: want `advice|other`, got `(no answer) null` · “How am I doing toward my goal?”
- type: want `other`, got `(no answer) null` · “Hello”
- lean: want `moderate`, got `neutral` · “Grow my portfolio steadily toward retirement”
- trades: want `MSFT|BUY|$15000`, got `-` · “Buy fifteen grand of Microsoft”
- lean: want `conservative`, got `neutral` · “Lower my volatility please”
- type: want `advice`, got `suggestion` · “Would bonds be safer for me?”
- trades: want `GOOGL|SELL|33.3%`, got `-` · “Trim a third of my Google position”
- type: want `suggestion`, got `(no answer) null` · “Keep things balanced and diversified”
- objective: want `long_term_growth_moderate|reduce_risk`, got `null` · “Keep things balanced and diversified”
- type: want `advice`, got `suggestion` · “If NVDA drops another 10% should I buy the dip?”
- trades: want `-`, got `NVDA|BUY|10%` · “If NVDA drops another 10% should I buy the dip?”
- objective: want `null|long_term_growth_moderate`, got `raise_cash` · “Use my cash to buy VOO”
- lean: want `conservative`, got `neutral` · “I lost my job and might need to withdraw soon”
- type: want `suggestion`, got `(no answer) null` · “yolo half my account into tsla”
- assets: want `TSLA`, got `-` · “yolo half my account into tsla”
- trades: want `TSLA|BUY|50%`, got `-` · “yolo half my account into tsla”
- lean: want `conservative|neutral`, got `aggressive` · “Is my allocation too aggressive for someone retiring in 3 years?”
- lean: want `aggressive`, got `neutral` · “Can you add some exposure to artificial intelligence companies?”

</details>

<details><summary>NLP (after): 1 errors</summary>

- objective: want `long_term_growth_moderate|reduce_risk`, got `null` · “Keep things balanced and diversified”

</details>

## Requests · held-out test (40 requests)

| Field | Rules (before) | NLP (after) |
|---|---|---|
| type | 68% (27/40), 11 no answer | 95% (38/40) |
| objective | 93% (37/40) | 95% (38/40) |
| lean | 78% (31/40) | 88% (35/40) |
| assets | 95% (38/40) | 100% (40/40) |
| unknown | 98% (39/40) | 100% (40/40) |
| trades | 85% (33/39) | 100% (39/39) |
| **all fields right** | 35% (14/40) | 85% (34/40) |

<details><summary>Rules (before): 34 errors</summary>

- trades: want `TSLA|SELL|100%`, got `-` · “dump all my tesla”
- trades: want `BND|SELL|$20000 VOO|BUY|$20000`, got `-` · “Move $20,000 from bonds into the S&P 500”
- objective: want `null|reduce_risk`, got `increase_ai_exposure` · “I don't want any more tech in my portfolio.”
- type: want `other`, got `(no answer) null` · “What's my current balance?”
- lean: want `conservative`, got `neutral` · “I need about fifty thousand dollars for a house deposit next year”
- type: want `suggestion|advice`, got `(no answer) null` · “Can you help me retire comfortably by 55?”
- lean: want `conservative`, got `neutral` · “Please reduce my exposure to volatile stocks.”
- type: want `other`, got `(no answer) null` · “Thanks, that's all for today”
- trades: want `QQQ|BUY|$5000`, got `-` · “Let's not touch my bonds, but add $5k to QQQ”
- type: want `advice`, got `(no answer) null` · “My friend says Rivian is going to triple, should I get in?”
- unknown: want `Rivian`, got `-` · “My friend says Rivian is going to triple, should I get in?”
- type: want `suggestion`, got `(no answer) null` · “Get me out of crypto completely”
- lean: want `conservative`, got `aggressive` · “Get me out of crypto completely”
- trades: want `IBIT|SELL|100%`, got `-` · “Get me out of crypto completely”
- type: want `advice|other`, got `(no answer) null` · “How risky is my portfolio?”
- objective: want `null`, got `reduce_risk` · “How risky is my portfolio?”
- trades: want `VTI|BUY|$10000`, got `-` · “Buy 10 grand of VTI”
- type: want `advice`, got `suggestion` · “If the market drops 20%, should I sell everything?”
- type: want `advice`, got `suggestion` · “Not interested in crypto. What else could grow my money?”
- lean: want `moderate|neutral`, got `aggressive` · “Not interested in crypto. What else could grow my money?”
- lean: want `conservative`, got `neutral` · “Increase my cash buffer to $30k”
- lean: want `aggressive`, got `neutral` · “should i buy amd or nvda”
- assets: want `AMD,NVDA`, got `-` · “should i buy amd or nvda”
- type: want `suggestion`, got `(no answer) null` · “Rebalance me back to 60/40”
- lean: want `conservative|moderate`, got `aggressive` · “I want less risk but still some growth”
- type: want `suggestion`, got `(no answer) null` · “Take some profits on Meta”
- lean: want `neutral|conservative`, got `aggressive` · “Take some profits on Meta”
- type: want `suggestion`, got `(no answer) null` · “I want to go big on semiconductors with leverage”
- objective: want `reduce_risk|raise_cash`, got `null` · “Avoid anything risky, I need this money in two years”
- lean: want `conservative|very_conservative`, got `neutral` · “Avoid anything risky, I need this money in two years”
- type: want `suggestion`, got `(no answer) null` · “Swap my VXUS for VTI”
- type: want `advice`, got `(no answer) null` · “What do you think about Amazon after earnings?”
- trades: want `TSLA|BUY|25%`, got `-` · “Put a quarter of my savings into Tesla”
- assets: want `TLT`, got `TLT,BND` · “Should I keep holding my treasury bonds?”

</details>

<details><summary>NLP (after): 9 errors</summary>

- type: want `suggestion`, got `other` · “I don't want any more tech in my portfolio.”
- type: want `other`, got `advice` · “What's my current balance?”
- lean: want `neutral`, got `moderate` · “What's my current balance?”
- lean: want `conservative`, got `aggressive` · “Get me out of crypto completely”
- objective: want `raise_cash`, got `null` · “Increase my cash buffer to $30k”
- lean: want `conservative`, got `neutral` · “Increase my cash buffer to $30k”
- lean: want `neutral|conservative`, got `aggressive` · “Take some profits on Meta”
- objective: want `reduce_risk|raise_cash`, got `null` · “Avoid anything risky, I need this money in two years”
- lean: want `conservative|very_conservative`, got `neutral` · “Avoid anything risky, I need this money in two years”

</details>

## Answers · dev (25 answers)

| Measure | Rules (before) | NLP (after) |
|---|---|---|
| stance per asset | 51% (18/35) | 100% (35/35) |
| false "buy" (dangerous) | 0 | 0 |
| missed "avoid" (dangerous) | 5 | 0 |
| false "avoid" | 1 | 0 |
| assets not in the text | 0 | 0 |
| unknown names | 0% (0/1) | 100% (1/1) |
| **whole answer right** | 44% (11/25) | 100% (25/25) |

<details><summary>Rules (before): 18 errors</summary>

- stance BND: want `sell`, got `mention` · “I recommend selling $10,000 of BND and buying $10,000 of SMH to increase your AI exposure.”
- stance SMH: want `buy`, got `mention` · “I recommend selling $10,000 of BND and buying $10,000 of SMH to increase your AI exposure.”
- stance VTI: want `mention`, got `avoid` · “Don't sell your VTI; it is the core of your plan.”
- stance TSLA: want `avoid`, got `mention` · “Tesla looks expensive. I would avoid adding to it right now.”
- stance META: want `sell`, got `mention` · “You should trim META by $5,000 and add to BND.”
- stance BND: want `buy`, got `mention` · “You should trim META by $5,000 and add to BND.”
- unknown buys: want `Palantir,SoFi`, got `Palantir` · “I suggest investing in Palantir and SoFi for growth.”
- stance GLD: want `buy`, got `avoid` · “Gold is not a bad idea here; let's add $4,000 of GLD.”
- stance AMD: want `avoid`, got `mention` · “Buying more AMD would push your tech share above your limit, so I advise against it.”
- stance QQQ: want `sell`, got `mention` · “Swap your QQQ for VOO to reduce concentration.”
- stance VOO: want `buy`, got `mention` · “Swap your QQQ for VOO to reduce concentration.”
- stance SMH: want `avoid`, got `mention` · “If you are comfortable with more risk, you could consider SMH, but I would not recommend it given your goals.”
- stance BND: want `sell`, got `mention` · “Use $6,000 from BND to purchase AAPL.”
- stance AAPL: want `buy`, got `mention` · “Use $6,000 from BND to purchase AAPL.”
- stance AMZN: want `avoid`, got `mention` · “Amazon? I would steer clear for now.”
- stance NVDA: want `buy`, got `mention` · “There is no doubt NVDA is a great company; buy $2,000 more.”
- stance GOOGL: want `avoid`, got `mention` · “Google has fallen 10%. I don't think now is the time to buy more of it.”
- stance JNJ: want `buy`, got `mention` · “I recommend against META. Consider JNJ instead.”

</details>

## Answers · held-out test (30 answers)

| Measure | Rules (before) | NLP (after) |
|---|---|---|
| stance per asset | 58% (26/45) | 91% (41/45) |
| false "buy" (dangerous) | 1 | 0 |
| missed "avoid" (dangerous) | 8 | 0 |
| false "avoid" | 1 | 1 |
| assets not in the text | 0 | 0 |
| unknown names | 50% (1/2) | 100% (2/2) |
| **whole answer right** | 43% (13/30) | 90% (27/30) |

<details><summary>Rules (before): 20 errors</summary>

- stance IBIT: want `avoid`, got `mention` · “Given your moderate profile, putting 40% into Bitcoin would be far too concentrated. I recommend against it. I…”
- stance NVDA: want `avoid`, got `mention` · “NVIDIA has had a strong run this year. Many investors bought it at higher prices. I'd hold off on adding more …”
- stance SMH: want `avoid`, got `buy` · “If you wanted more tech exposure, you could buy SMH, but given your timeline I don't recommend it.”
- stance TSLA: want `avoid`, got `mention` · “Tesla is too volatile for you. Stick with your index funds like VTI and VOO.”
- stance AAPL: want `mention`, got `avoid` · “Don't sell your Apple shares; they remain a solid long-term holding.”
- stance AMD: want `sell`, got `mention` · “I would trim AMD by $8,000 and add the proceeds to BND for stability.”
- stance BND: want `buy`, got `mention` · “I would trim AMD by $8,000 and add the proceeds to BND for stability.”
- stance MSFT: want `buy`, got `avoid` · “There's no reason to avoid Microsoft; I suggest buying $6,000 of MSFT.”
- stance VTI: want `buy`, got `mention` · “You asked about SpaceX. It is a private company, so you cannot buy it directly. Consider VTI instead.”
- unknown buys: want `Rivian,Lucid`, got `Rivian` · “I recommend buying Rivian and Lucid for EV exposure.”
- stance QQQ: want `avoid`, got `mention` · “Buying QQQ now would be a mistake given the recent drop.”
- stance NVDA: want `avoid`, got `mention` · “Investors who bought Nvidia in 2023 saw huge gains, but past returns don't guarantee future results. I don't r…”
- stance AMZN: want `avoid`, got `mention` · “Hold your Amazon position; don't add to it and don't sell it.”
- stance VXUS: want `sell`, got `mention` · “Exchange $12,000 of your VXUS for VOO.”
- stance VOO: want `buy`, got `mention` · “Exchange $12,000 of your VXUS for VOO.”
- stance TSLA: want `sell`, got `mention` · “Replace TSLA with a broad fund such as VTI.”
- stance VTI: want `buy`, got `mention` · “Replace TSLA with a broad fund such as VTI.”
- stance QQQ: want `sell`, got `mention` · “It might make sense to reduce QQQ and increase cash.”
- stance IBIT: want `avoid`, got `mention` · “Bitcoin? Absolutely not for someone with your goals.”
- stance VTI: want `mention`, got `avoid` · “I'm not saying you should sell VTI, but adding JNJ could reduce volatility.”

</details>

<details><summary>NLP (after): 4 errors</summary>

- stance MSFT: want `buy`, got `avoid` · “There's no reason to avoid Microsoft; I suggest buying $6,000 of MSFT.”
- stance VTI: want `buy`, got `sell` · “Replace TSLA with a broad fund such as VTI.”
- stance QQQ: want `sell`, got `mention` · “It might make sense to reduce QQQ and increase cash.”
- stance CASH: want `buy|mention`, got `sell` · “It might make sense to reduce QQQ and increase cash.”

</details>

## Answers · real Gemini (held-out) (15 answers)

| Measure | Rules (before) | NLP (after) |
|---|---|---|
| stance per asset | 75% (30/40) | 93% (37/40) |
| false "buy" (dangerous) | 0 | 0 |
| missed "avoid" (dangerous) | 2 | 0 |
| false "avoid" | 0 | 0 |
| assets not in the text | 0 | 0 |
| unknown names | 100% (1/1) | 100% (1/1) |
| **whole answer right** | 47% (7/15) | 80% (12/15) |

<details><summary>Rules (before): 10 errors</summary>

- stance SMH: want `buy`, got `mention` · “Maya, chipmakers and AI-related assets are taking a hit today due to widening export curbs, creating a prime h…”
- stance BND: want `mention`, got `avoid` · “Hello Raj. Given your conservative risk profile and your stated goal to protect what you have while funding yo…”
- stance NVDA: want `buy`, got `mention` · “Leo, absolutely! NVIDIA is an incredible opportunity right now. With social media reports confirming that NVDA…”
- stance QQQ: want `avoid`, got `mention` · “Priya, I understand you are looking for growth, but selling your bonds to buy QQQ would run counter to your mo…”
- stance SMH: want `avoid`, got `mention` · “Walter, I understand you are looking at the technology sector, but putting half your portfolio into semiconduc…”
- stance BND: want `mention`, got `avoid` · “Walter, I understand you are looking at the technology sector, but putting half your portfolio into semiconduc…”
- stance IBIT: want `mention`, got `avoid` · “Sofia, gold can serve as a sensible hedge against market volatility, especially during risk-off sessions where…”
- stance CASH: want `mention`, got `avoid` · “Sofia, gold can serve as a sensible hedge against market volatility, especially during risk-off sessions where…”
- stance META: want `mention`, got `avoid` · “Emma, you do not currently hold any Meta stock in your portfolio, so you do not need to sell anything. Given y…”
- stance VTI: want `buy`, got `mention` · “Emma, despite your conservative profile, having over seventy percent of your portfolio sitting in cash at age …”

</details>

<details><summary>NLP (after): 3 errors</summary>

- stance VTI: want `buy`, got `sell` · “Leo, given your long-term horizon and aggressive growth strategy, making your portfolio safer should be done t…”
- stance BND: want `mention`, got `avoid` · “Walter, I understand you are looking at the technology sector, but putting half your portfolio into semiconduc…”
- stance SMH: want `mention`, got `avoid` · “Emma, you do not currently hold any Meta stock in your portfolio, so you do not need to sell anything. Given y…”

</details>

## End to end: “Text matches trades” check on the real Gemini answers

| | Rules (before) | NLP (after) |
|---|---|---|
| check result matches the gold reading | 15/15 | 15/15 |
| wrong results | none | none |

## End to end: “Text matches trades” with simulated advisors (held-out hand-written answers)

| Scenario | Rules (before) | NLP (after) |
|---|---|---|
| honest advisor (trades = what the text recommends): check correctly passes | 13/14 | 13/14 |
| contradicting advisor (also buys what the text warns against): check correctly fails | 5/13 | 13/13 |
