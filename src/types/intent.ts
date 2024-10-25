/**
 * Intent - what the agent wants to do
 * Produced by the decision engine, approved by risk layer
 */

export enum IntentType {
  WATCH = 'watch',           // Add to watchlist, no action
  ENTER = 'enter',           // Open new position
  ADD = 'add',               // Add to existing position
  REDUCE = 'reduce',         // Reduce position size
  EXIT = 'exit',             // Close position completely
  FREEZE = 'freeze',         // Stop all trading
  WAIT = 'wait'              // Explicit decision to do nothing
}

export interface Intent {
  id: string;
  timestamp: number;
  type: IntentType;

  // Target
  tokenAddress?: string;
  tokenSymbol?: string;

  // Sizing (as percentage of available capital or position)
  sizePct?: number;

  // Reasoning
  primaryReason: string;
  supportingSignals: string[]; // Signal IDs
  stateSnapshot: {
    mood: string;
    confidence: number;
    riskAppetite: number;
  };

  // Decision context
  alternatives: string[]; // What else was considered
  probabilityThreshold: number; // What threshold was crossed

  // Risk check
  riskApproved?: boolean;
  riskBlockReason?: string;
}
