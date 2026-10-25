// HELD-OUT test set for request reading. Written before the NLP reader; never used for tuning.
import type { RequestCase } from './types'

const AI = 'increase_ai_exposure'
const RISK = 'reduce_risk'
const CASH = 'raise_cash'
const GROW = 'long_term_growth_moderate'

export const REQUESTS_TEST: RequestCase[] = [
  { text: 'Should I put more money into Nvidia right now?', type: 'advice', objective: [null, AI], lean: 'aggressive', assets: ['NVDA'], trades: [] },
  { text: "I'm getting nervous about the market, can we make things safer?", type: ['suggestion', 'advice'], objective: RISK, lean: 'conservative', assets: [], trades: [] },
  { text: 'dump all my tesla', type: 'suggestion', objective: [null, RISK], lean: ['neutral', 'conservative'], assets: ['TSLA'], trades: [{ ticker: 'TSLA', side: 'SELL', percent: 100 }] },
  { text: 'Move $20,000 from bonds into the S&P 500', type: 'suggestion', objective: [null, GROW], lean: ['neutral', 'moderate', 'aggressive'], assets: ['BND', 'VOO'], trades: [{ ticker: 'BND', side: 'SELL', usd: 20000 }, { ticker: 'VOO', side: 'BUY', usd: 20000 }] },
  { text: "I don't want any more tech in my portfolio.", type: 'suggestion', objective: [null, RISK], lean: ['neutral', 'conservative'], assets: [], trades: [] },
  { text: "What's my current balance?", type: 'other', objective: null, lean: 'neutral', assets: [], trades: [] },
  { text: 'Is it a good time to buy gold?', type: 'advice', objective: null, lean: ['neutral', 'conservative'], assets: ['GLD'], trades: [] },
  { text: 'I need about fifty thousand dollars for a house deposit next year', type: 'suggestion', objective: CASH, lean: 'conservative', assets: [], optAssets: ['CASH'], trades: [] },
  { text: 'Put 40% of my portfolio in bitcoin', type: 'suggestion', objective: null, lean: 'very_aggressive', assets: ['IBIT'], trades: [{ ticker: 'IBIT', side: 'BUY', percent: 40 }] },
  { text: 'Can you help me retire comfortably by 55?', type: ['suggestion', 'advice'], objective: GROW, lean: ['moderate', 'neutral'], assets: [], trades: [] },
  { text: 'Should I invest in SpaceX before it IPOs?', type: 'advice', objective: null, lean: ['aggressive', 'neutral'], assets: [], unknown: ['SpaceX'], trades: [] },
  { text: 'I want maximum growth, go all in on AI stocks', type: 'suggestion', objective: AI, lean: 'very_aggressive', assets: [], optAssets: ['BOTZ'], trades: [] },
  { text: 'Sell half of my Apple shares', type: 'suggestion', objective: [null, CASH, RISK], lean: ['neutral', 'conservative'], assets: ['AAPL'], trades: [{ ticker: 'AAPL', side: 'SELL', percent: 50 }] },
  { text: 'Would it be smart to buy some Microsoft and Google?', type: 'advice', objective: [null, AI], lean: 'aggressive', assets: ['MSFT', 'GOOGL'], trades: [] },
  { text: 'Please reduce my exposure to volatile stocks.', type: 'suggestion', objective: RISK, lean: 'conservative', assets: [], trades: [] },
  { text: "Thanks, that's all for today", type: 'other', objective: null, lean: 'neutral', assets: [], trades: [] },
  { text: "Let's not touch my bonds, but add $5k to QQQ", type: 'suggestion', objective: [null, AI], lean: ['aggressive', 'moderate', 'neutral'], assets: ['BND', 'QQQ'], trades: [{ ticker: 'QQQ', side: 'BUY', usd: 5000 }] },
  { text: 'My friend says Rivian is going to triple, should I get in?', type: 'advice', objective: null, lean: ['aggressive', 'neutral'], assets: [], unknown: ['Rivian'], trades: [] },
  { text: "I'd like to diversify more internationally", type: 'suggestion', objective: [GROW, RISK, null], lean: 'moderate', assets: [], optAssets: ['VXUS'], trades: [] },
  { text: 'Get me out of crypto completely', type: 'suggestion', objective: [RISK, null], lean: 'conservative', assets: ['IBIT'], trades: [{ ticker: 'IBIT', side: 'SELL', percent: 100 }] },
  { text: 'How risky is my portfolio?', type: ['advice', 'other'], objective: null, lean: 'neutral', assets: [], trades: [] },
  { text: "I'm 62 and want to protect what I have", type: 'suggestion', objective: RISK, lean: 'conservative', assets: [], trades: [] },
  { text: 'Buy 10 grand of VTI', type: 'suggestion', objective: [null, GROW], lean: ['neutral', 'moderate'], assets: ['VTI'], trades: [{ ticker: 'VTI', side: 'BUY', usd: 10000 }] },
  { text: 'If the market drops 20%, should I sell everything?', type: 'advice', objective: [null, RISK, CASH], lean: ['very_conservative', 'conservative', 'neutral'], assets: [], trades: [] },
  { text: 'Not interested in crypto. What else could grow my money?', type: 'advice', objective: [GROW, null], lean: ['moderate', 'neutral'], assets: [], optAssets: ['IBIT'], trades: [] },
  { text: 'Increase my cash buffer to $30k', type: 'suggestion', objective: CASH, lean: 'conservative', assets: [], optAssets: ['CASH'], trades: null },
  { text: 'should i buy amd or nvda', type: 'advice', objective: [null, AI], lean: 'aggressive', assets: ['AMD', 'NVDA'], trades: [] },
  { text: 'Rebalance me back to 60/40', type: 'suggestion', objective: [GROW, RISK, null], lean: 'moderate', assets: [], trades: [] },
  { text: 'I want less risk but still some growth', type: 'suggestion', objective: RISK, lean: ['conservative', 'moderate'], assets: [], trades: [] },
  { text: 'Take some profits on Meta', type: 'suggestion', objective: [null, CASH, RISK], lean: ['neutral', 'conservative'], assets: ['META'], trades: [] },
  { text: 'Invest my bonus of $15,000', type: 'suggestion', objective: [GROW, null], lean: ['neutral', 'moderate'], assets: [], trades: [] },
  { text: 'Is Johnson & Johnson a safe stock to hold?', type: 'advice', objective: [null, RISK], lean: ['conservative', 'neutral'], assets: ['JNJ'], trades: [] },
  { text: 'I want to go big on semiconductors with leverage', type: 'suggestion', objective: AI, lean: 'very_aggressive', assets: ['SMH'], trades: [] },
  { text: 'Avoid anything risky, I need this money in two years', type: 'suggestion', objective: [RISK, CASH], lean: ['conservative', 'very_conservative'], assets: [], trades: [] },
  { text: 'Swap my VXUS for VTI', type: 'suggestion', objective: null, lean: ['neutral', 'moderate'], assets: ['VXUS', 'VTI'], trades: [] },
  { text: 'What do you think about Amazon after earnings?', type: 'advice', objective: null, lean: ['aggressive', 'neutral'], assets: ['AMZN'], trades: [] },
  { text: 'Put a quarter of my savings into Tesla', type: 'suggestion', objective: null, lean: ['aggressive', 'very_aggressive'], assets: ['TSLA'], trades: [{ ticker: 'TSLA', side: 'BUY', percent: 25 }] },
  { text: 'I have lost faith in big tech, cut it back', type: 'suggestion', objective: [RISK, null], lean: ['conservative', 'neutral'], assets: [], trades: [] },
  { text: 'can u make me more money', type: 'suggestion', objective: [GROW, null], lean: ['moderate', 'aggressive', 'neutral'], assets: [], trades: [] },
  { text: 'Should I keep holding my treasury bonds?', type: 'advice', objective: null, lean: ['neutral', 'conservative'], assets: ['TLT'], trades: [] },
]
