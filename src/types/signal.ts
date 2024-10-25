/**
 * Signal - higher level interpretation of events
 * Produced by the signal layer with confidence scoring
 */

export enum SignalType {
  // Market signals
  EARLY_MOMENTUM = 'early_momentum',
  VOLUME_SURGE = 'volume_surge',
  LIQUIDITY_PULL = 'liquidity_pull',
  PRICE_EXHAUSTION = 'price_exhaustion',
  DORMANCY = 'dormancy',

  // Social signals
  HYPE_BURST = 'hype_burst',
  NARRATIVE_SHIFT = 'narrative_shift',
  COMMUNITY_FADE = 'community_fade',

  // Pattern signals
  FAMILIAR_PATTERN = 'familiar_pattern',
  UNUSUAL_BEHAVIOR = 'unusual_behavior',
  FALSE_SIGNAL = 'false_signal'
}

export interface Signal {
  id: string;
  timestamp: number;
  type: SignalType;
  tokenAddress?: string;
  tokenSymbol?: string;

  // Scoring
  confidence: number; // 0-1
  strength: number; // 0-1
  urgency: number; // 0-1

  // Context
  description: string;
  sourceEventIds: string[];

  // Decay
  expiresAt: number;
  decayRate: number;
}
