/**
 * Raw event from the perception layer
 * All external data is normalized into this format
 */

export enum EventSource {
  SOLANA_MARKET = 'solana_market',
  SOLANA_CHAIN = 'solana_chain',
  TWITTER = 'twitter',
  SYSTEM = 'system'
}

export enum EventType {
  // Market events
  PRICE_UPDATE = 'price_update',
  PRICE_CHANGE = 'price_change',
  VOLUME_SPIKE = 'volume_spike',
  LIQUIDITY_CHANGE = 'liquidity_change',
  NEW_TOKEN = 'new_token',
  TOKEN_REVIVAL = 'token_revival',

  // Social events
  MENTION_SPIKE = 'mention_spike',
  SENTIMENT_SHIFT = 'sentiment_shift',
  INFLUENCER_POST = 'influencer_post',

  // System events
  HEARTBEAT = 'heartbeat',
  ERROR = 'error'
}

export interface Event {
  id: string;
  timestamp: number;
  source: EventSource;
  type: EventType;
  tokenAddress?: string;
  tokenSymbol?: string;
  data: Record<string, unknown>;
  raw?: unknown;
}
