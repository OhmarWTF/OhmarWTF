/**
 * TradeResult - outcome of execution
 * Produced by execution layer, stored in memory
 */

export enum TradeStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  FILLED = 'filled',
  PARTIAL = 'partial',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum TradeDirection {
  BUY = 'buy',
  SELL = 'sell'
}

export interface TradeResult {
  id: string;
  timestamp: number;
  intentId: string;

  // Trade details
  tokenAddress: string;
  tokenSymbol: string;
  direction: TradeDirection;

  // Execution
  status: TradeStatus;
  requestedAmount: number;
  filledAmount?: number;
  price?: number;
  slippage?: number;
  gasUsed?: number;

  // Outcomes
  txSignature?: string;
  error?: string;

  // Attribution
  triggeredBySignals: string[];
  agentMoodAtTime: string;
}

export interface Position {
  tokenAddress: string;
  tokenSymbol: string;
  amount: number;
  averageEntryPrice: number;
  currentPrice?: number;
  unrealizedPnL?: number;
  unrealizedPnLPct?: number;
  openedAt: number;
  lastUpdatedAt: number;
  entryIntentId: string;
  tradeIds: string[];
}
