/**
 * Signal Detectors
 * Pattern recognition from event streams
 */

import { Event, EventType, Signal, SignalType } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export interface DetectorResult {
  type: SignalType;
  confidence: number;
  strength: number;
  urgency: number;
  description: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  sourceEventIds: string[];
}

/**
 * Detect volume spikes from events
 */
export function detectVolumeSurge(events: Event[], windowMs: number): DetectorResult[] {
  const results: DetectorResult[] = [];
  const now = Date.now();
  const cutoff = now - windowMs;

  // Group volume events by token
  const tokenVolumes = new Map<string, Event[]>();

  for (const event of events) {
    if (event.type === EventType.VOLUME_SPIKE && event.timestamp > cutoff) {
      const key = event.tokenAddress || 'unknown';
      if (!tokenVolumes.has(key)) {
        tokenVolumes.set(key, []);
      }
      tokenVolumes.get(key)!.push(event);
    }
  }

  // Analyze each token's volume pattern
  for (const [tokenAddr, volumeEvents] of tokenVolumes) {
    if (volumeEvents.length >= 2) {
      const latest = volumeEvents[volumeEvents.length - 1];
      const multiplier = (latest.data.multiplier as number) || 1;

      results.push({
        type: SignalType.VOLUME_SURGE,
        confidence: Math.min(0.95, 0.5 + (multiplier - 1) * 0.15),
        strength: Math.min(1.0, multiplier / 5),
        urgency: volumeEvents.length > 3 ? 0.8 : 0.5,
        description: `Volume spike ${multiplier.toFixed(1)}x average`,
        tokenAddress: tokenAddr,
        tokenSymbol: latest.tokenSymbol,
        sourceEventIds: volumeEvents.map(e => e.id)
      });
    }
  }

  return results;
}

/**
 * Detect early momentum from price and volume
 */
export function detectEarlyMomentum(events: Event[], windowMs: number): DetectorResult[] {
  const results: DetectorResult[] = [];
  const now = Date.now();
  const cutoff = now - windowMs;

  // Group by token
  const tokenEvents = new Map<string, Event[]>();

  for (const event of events) {
    if (event.timestamp > cutoff && event.tokenAddress) {
      const key = event.tokenAddress;
      if (!tokenEvents.has(key)) {
        tokenEvents.set(key, []);
      }
      tokenEvents.get(key)!.push(event);
    }
  }

  // Look for price increase + volume increase pattern
  for (const [tokenAddr, evts] of tokenEvents) {
    const priceEvents = evts.filter(e => e.type === EventType.PRICE_CHANGE);
    const volumeEvents = evts.filter(e => e.type === EventType.VOLUME_SPIKE);

    if (priceEvents.length > 0 && volumeEvents.length > 0) {
      const latestPrice = priceEvents[priceEvents.length - 1];
      const priceChange = (latestPrice.data.changePercent as number) || 0;

      if (priceChange > 5) {
        results.push({
          type: SignalType.EARLY_MOMENTUM,
          confidence: 0.6,
          strength: Math.min(1.0, Math.abs(priceChange) / 20),
          urgency: 0.7,
          description: `Price +${priceChange.toFixed(1)}% with volume`,
          tokenAddress: tokenAddr,
          tokenSymbol: latestPrice.tokenSymbol,
          sourceEventIds: [...priceEvents.map(e => e.id), ...volumeEvents.map(e => e.id)]
        });
      }
    }
  }

  return results;
}

/**
 * Detect liquidity pulls (large withdrawals)
 */
export function detectLiquidityPull(events: Event[], windowMs: number): DetectorResult[] {
  const results: DetectorResult[] = [];
  const now = Date.now();
  const cutoff = now - windowMs;

  for (const event of events) {
    if (event.type === EventType.LIQUIDITY_CHANGE && event.timestamp > cutoff) {
      const changePercent = (event.data.changePercent as number) || 0;

      if (changePercent < -15) {
        results.push({
          type: SignalType.LIQUIDITY_PULL,
          confidence: 0.75,
          strength: Math.min(1.0, Math.abs(changePercent) / 30),
          urgency: changePercent < -30 ? 0.9 : 0.6,
          description: `Liquidity dropped ${Math.abs(changePercent).toFixed(1)}%`,
          tokenAddress: event.tokenAddress,
          tokenSymbol: event.tokenSymbol,
          sourceEventIds: [event.id]
        });
      }
    }
  }

  return results;
}

/**
 * Detect price exhaustion (rapid rise then stall)
 */
export function detectPriceExhaustion(events: Event[], windowMs: number): DetectorResult[] {
  const results: DetectorResult[] = [];
  const now = Date.now();
  const cutoff = now - windowMs;

  // Group price changes by token
  const tokenPrices = new Map<string, Event[]>();

  for (const event of events) {
    if (event.type === EventType.PRICE_CHANGE && event.timestamp > cutoff && event.tokenAddress) {
      const key = event.tokenAddress;
      if (!tokenPrices.has(key)) {
        tokenPrices.set(key, []);
      }
      tokenPrices.get(key)!.push(event);
    }
  }

  for (const [tokenAddr, priceEvents] of tokenPrices) {
    if (priceEvents.length >= 3) {
      const sorted = priceEvents.sort((a, b) => a.timestamp - b.timestamp);
      const recent = sorted.slice(-3);

      const changes = recent.map(e => (e.data.changePercent as number) || 0);
      const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;

      // If average change is very low after previous spikes, might be exhaustion
      if (avgChange < 2 && sorted.slice(0, -3).some(e => ((e.data.changePercent as number) || 0) > 10)) {
        results.push({
          type: SignalType.PRICE_EXHAUSTION,
          confidence: 0.55,
          strength: 0.6,
          urgency: 0.4,
          description: 'Price momentum slowing after spike',
          tokenAddress: tokenAddr,
          tokenSymbol: recent[0].tokenSymbol,
          sourceEventIds: recent.map(e => e.id)
        });
      }
    }
  }

  return results;
}

/**
 * Detect dormancy (no activity for extended period)
 */
export function detectDormancy(events: Event[], allTokens: string[], windowMs: number): DetectorResult[] {
  const results: DetectorResult[] = [];
  const now = Date.now();
  const cutoff = now - windowMs;

  // Get tokens with recent activity
  const activeTokens = new Set<string>();
  for (const event of events) {
    if (event.timestamp > cutoff && event.tokenAddress) {
      activeTokens.add(event.tokenAddress);
    }
  }

  // Tokens without activity are dormant
  for (const tokenAddr of allTokens) {
    if (!activeTokens.has(tokenAddr)) {
      results.push({
        type: SignalType.DORMANCY,
        confidence: 0.7,
        strength: 0.5,
        urgency: 0.2,
        description: 'No recent activity detected',
        tokenAddress: tokenAddr,
        sourceEventIds: []
      });
    }
  }

  return results;
}

/**
 * Detect hype burst from social signals
 */
export function detectHypeBurst(events: Event[], windowMs: number): DetectorResult[] {
  const results: DetectorResult[] = [];
  const now = Date.now();
  const cutoff = now - windowMs;

  const socialEvents = events.filter(e =>
    (e.type === EventType.MENTION_SPIKE || e.type === EventType.SENTIMENT_SHIFT) &&
    e.timestamp > cutoff
  );

  // Group by token
  const tokenSocial = new Map<string, Event[]>();
  for (const event of socialEvents) {
    const key = event.tokenAddress || 'general';
    if (!tokenSocial.has(key)) {
      tokenSocial.set(key, []);
    }
    tokenSocial.get(key)!.push(event);
  }

  for (const [tokenAddr, socEvents] of tokenSocial) {
    if (socEvents.length >= 2) {
      results.push({
        type: SignalType.HYPE_BURST,
        confidence: 0.5,
        strength: Math.min(1.0, socEvents.length / 5),
        urgency: 0.65,
        description: `${socEvents.length} social signals detected`,
        tokenAddress: tokenAddr !== 'general' ? tokenAddr : undefined,
        sourceEventIds: socEvents.map(e => e.id)
      });
    }
  }

  return results;
}

/**
 * Run all detectors and aggregate results
 */
export function runAllDetectors(events: Event[], trackedTokens: string[], windowMs: number): DetectorResult[] {
  const results: DetectorResult[] = [];

  results.push(...detectVolumeSurge(events, windowMs));
  results.push(...detectEarlyMomentum(events, windowMs));
  results.push(...detectLiquidityPull(events, windowMs));
  results.push(...detectPriceExhaustion(events, windowMs));
  results.push(...detectHypeBurst(events, windowMs));
  results.push(...detectDormancy(events, trackedTokens, windowMs));

  logger.debug('Signal detection complete', { signalsGenerated: results.length });

  return results;
}
