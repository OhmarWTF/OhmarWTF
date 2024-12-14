/**
 * Signal Layer
 * Converts events into scored signals with confidence and decay
 */

import { Event, Signal, SignalType } from '../../types/index.js';
import { runAllDetectors } from './detectors.js';
import { logger } from '../../utils/logger.js';

export interface SignalConfig {
  windowSizeMs: number;
  decayHalfLifeMs: number;
  minConfidence: number;
}

export interface ISignalLayer {
  /**
   * Process new events and generate signals
   */
  processEvents(events: Event[], trackedTokens?: string[]): Signal[];

  /**
   * Update existing signals (decay, expiration)
   */
  updateSignals(): Signal[];

  /**
   * Get currently active signals
   */
  getActiveSignals(): Signal[];
}

export class SignalLayer implements ISignalLayer {
  private config: SignalConfig;
  private activeSignals: Signal[] = [];
  private eventWindow: Event[] = [];
  private signalIdCounter: number = 0;

  constructor(config: SignalConfig) {
    this.config = config;
  }

  processEvents(events: Event[], trackedTokens: string[] = []): Signal[] {
    // Add to rolling window
    this.eventWindow.push(...events);

    // Trim old events
    const cutoff = Date.now() - this.config.windowSizeMs;
    this.eventWindow = this.eventWindow.filter(e => e.timestamp > cutoff);

    // Run pattern detectors
    const detectorResults = runAllDetectors(this.eventWindow, trackedTokens, this.config.windowSizeMs);

    // Convert detector results to signals
    const newSignals: Signal[] = [];
    const now = Date.now();

    for (const result of detectorResults) {
      // Skip if below minimum confidence
      if (result.confidence < this.config.minConfidence) {
        continue;
      }

      // Check if similar signal already exists
      const existing = this.activeSignals.find(s =>
        s.type === result.type &&
        s.tokenAddress === result.tokenAddress &&
        s.expiresAt > now
      );

      if (existing) {
        // Reinforce existing signal
        existing.confidence = Math.min(0.99, existing.confidence + 0.1);
        existing.strength = Math.max(existing.strength, result.strength);
        existing.expiresAt = now + this.config.decayHalfLifeMs * 3;
        existing.sourceEventIds.push(...result.sourceEventIds);
      } else {
        // Create new signal
        const signal: Signal = {
          id: `signal_${now}_${this.signalIdCounter++}`,
          timestamp: now,
          type: result.type,
          tokenAddress: result.tokenAddress,
          tokenSymbol: result.tokenSymbol,
          confidence: result.confidence,
          strength: result.strength,
          urgency: result.urgency,
          description: result.description,
          sourceEventIds: result.sourceEventIds,
          expiresAt: now + this.config.decayHalfLifeMs * 3,
          decayRate: 0.5 // Half-life decay
        };

        this.activeSignals.push(signal);
        newSignals.push(signal);
      }
    }

    if (newSignals.length > 0) {
      logger.debug('New signals generated', { count: newSignals.length });
    }

    return newSignals;
  }

  updateSignals(): Signal[] {
    const now = Date.now();

    // Remove expired signals
    this.activeSignals = this.activeSignals.filter(s => s.expiresAt > now);

    // Apply exponential decay to confidence
    for (const signal of this.activeSignals) {
      const age = now - signal.timestamp;
      const halfLives = age / this.config.decayHalfLifeMs;

      // Exponential decay: confidence *= 0.5^(age/halfLife)
      const decayFactor = Math.pow(signal.decayRate, halfLives);
      signal.confidence *= decayFactor;

      // Remove if confidence drops too low
      if (signal.confidence < this.config.minConfidence) {
        signal.expiresAt = now - 1; // Mark for removal
      }
    }

    // Final filter
    this.activeSignals = this.activeSignals.filter(s =>
      s.expiresAt > now && s.confidence >= this.config.minConfidence
    );

    return this.activeSignals;
  }

  getActiveSignals(): Signal[] {
    return [...this.activeSignals];
  }

  /**
   * Get signals for a specific token
   */
  getSignalsForToken(tokenAddress: string): Signal[] {
    return this.activeSignals.filter(s => s.tokenAddress === tokenAddress);
  }

  /**
   * Get strongest signal for a token
   */
  getStrongestSignal(tokenAddress?: string): Signal | undefined {
    let signals = this.activeSignals;
    if (tokenAddress) {
      signals = signals.filter(s => s.tokenAddress === tokenAddress);
    }

    if (signals.length === 0) return undefined;

    return signals.reduce((strongest, current) =>
      current.confidence * current.strength > strongest.confidence * strongest.strength
        ? current
        : strongest
    );
  }
}
