// DEV set for request reading: used while building and tuning the readers.
import type { RequestCase } from './types'

const AI = 'increase_ai_exposure'
const RISK = 'reduce_risk'
const CASH = 'raise_cash'
const GROW = 'long_term_growth_moderate'

export const REQUESTS_DEV: RequestCase[] = [
  { text: 'Increase my AI exposure', type: 'suggestion', objective: AI, lean: 'aggressive', assets: [], trades: [] },
  { text: 'Should I buy more NVDA today?', type: 'advice', objective: [null, AI], lean: 'aggressive', assets: ['NVDA'], trades: [] },
  { text: 'Put 40% of my portfolio into Bitcoin', type: 'suggestion', objective: null, lean: 'very_aggressive', assets: ['IBIT'], trades: [{ ticker: 'IBIT', side: 'BUY', percent: 40 }] },
  { text: 'Should I invest in SpaceX?', type: 'advice', objective: null, lean: ['aggressive', 'neutral'], assets: [], unknown: ['SpaceX'], trades: [] },
  { text: 'Do something smart with my money', type: 'suggestion', objective: [GROW, null], lean: ['moderate', 'neutral'], assets: [], trades: [] },
  { text: "I'm worried, the market keeps falling. Make my portfolio safer.", type: 'suggestion', objective: RISK, lean: 'conservative', assets: [], trades: [] },
  { text: 'sell all of my amd shares', type: 'suggestion', objective: [null, RISK], lean: ['neutral', 'conservative'], assets: ['AMD'], trades: [{ ticker: 'AMD', side: 'SELL', percent: 100 }] },
  { text: 'I need $25,000 in cash for my daughter’s tuition', type: 'suggestion', objective: CASH, lean: 'conservative', assets: [], optAssets: ['CASH'], trades: null },
  { text: 'Shift ten thousand dollars from VXUS into QQQ', type: 'suggestion', objective: [null, AI], lean: ['aggressive', 'moderate', 'neutral'], assets: ['VXUS', 'QQQ'], trades: [{ ticker: 'VXUS', side: 'SELL', usd: 10000 }, { ticker: 'QQQ', side: 'BUY', usd: 10000 }] },
  { text: "I don't want more crypto", type: 'suggestion', objective: [null, RISK], lean: ['neutral', 'conservative'], assets: ['IBIT'], trades: [] },
  { text: 'Is Tesla a good buy?', type: 'advice', objective: null, lean: ['aggressive', 'neutral'], assets: ['TSLA'], trades: [] },
  { text: 'How am I doing toward my goal?', type: ['advice', 'other'], objective: [null, GROW], lean: 'neutral', assets: [], trades: [] },
  { text: 'Hello', type: 'other', objective: null, lean: 'neutral', assets: [], trades: [] },
  { text: 'Grow my portfolio steadily toward retirement', type: 'suggestion', objective: GROW, lean: 'moderate', assets: [], trades: [] },
  { text: 'Buy fifteen grand of Microsoft', type: 'suggestion', objective: [null, AI], lean: 'aggressive', assets: ['MSFT'], trades: [{ ticker: 'MSFT', side: 'BUY', usd: 15000 }] },
  { text: 'Should I get into Palantir?', type: 'advice', objective: null, lean: ['aggressive', 'neutral'], assets: [], unknown: ['Palantir'], trades: [] },
  { text: 'Lower my volatility please', type: 'suggestion', objective: RISK, lean: 'conservative', assets: [], trades: [] },
  { text: 'I want as much growth as possible, put everything into tech', type: 'suggestion', objective: AI, lean: 'very_aggressive', assets: [], trades: [] },
  { text: 'Would bonds be safer for me?', type: 'advice', objective: [RISK, null], lean: 'conservative', assets: ['BND'], trades: [] },
  { text: 'Trim a third of my Google position', type: 'suggestion', objective: [null, CASH, RISK], lean: ['neutral', 'conservative'], assets: ['GOOGL'], trades: [{ ticker: 'GOOGL', side: 'SELL', percent: 33.3 }] },
  { text: "Don't buy anything risky, but I'd like a bit more income", type: 'suggestion', objective: [RISK, null], lean: 'conservative', assets: [], trades: [] },
  { text: 'What about chip stocks?', type: 'advice', objective: [null, AI], lean: ['aggressive', 'neutral'], assets: ['SMH'], trades: [] },
  { text: 'Keep things balanced and diversified', type: 'suggestion', objective: [GROW, RISK], lean: 'moderate', assets: [], trades: [] },
  { text: 'If NVDA drops another 10% should I buy the dip?', type: 'advice', objective: [null, AI], lean: 'aggressive', assets: ['NVDA'], trades: [] },
  { text: 'Use my cash to buy VOO', type: 'suggestion', objective: [null, GROW], lean: ['neutral', 'moderate'], assets: ['VOO'], optAssets: ['CASH'], trades: [] },
  { text: 'I lost my job and might need to withdraw soon', type: 'suggestion', objective: CASH, lean: 'conservative', assets: [], trades: [] },
  { text: 'yolo half my account into tsla', type: 'suggestion', objective: null, lean: 'very_aggressive', assets: ['TSLA'], trades: [{ ticker: 'TSLA', side: 'BUY', percent: 50 }] },
  { text: 'Is my allocation too aggressive for someone retiring in 3 years?', type: 'advice', objective: [RISK, null], lean: ['conservative', 'neutral'], assets: [], trades: [] },
  { text: 'Can you add some exposure to artificial intelligence companies?', type: ['suggestion', 'advice'], objective: AI, lean: 'aggressive', assets: [], trades: [] },
  { text: 'Not Bitcoin. Something safer, like treasuries.', type: 'suggestion', objective: [RISK, null], lean: 'conservative', assets: ['TLT'], optAssets: ['IBIT'], trades: [] },
]
