/**
 * Signal Layer
 * Converts events into scored signals with confidence and decay
 */

import { Event, Signal } from '../../types/index.js';

export interface SignalConfig {
  windowSizeMs: number;
  decayHalfLifeMs: number;
  minConfidence: number;
}

export interface ISignalLayer {
  /**
   * Process new events and generate signals
   */
  processEvents(events: Event[]): Signal[];

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

  constructor(config: SignalConfig) {
    this.config = config;
  }

  processEvents(events: Event[]): Signal[] {
    // Add to rolling window
    this.eventWindow.push(...events);

    // Trim old events
    const cutoff = Date.now() - this.config.windowSizeMs;
    this.eventWindow = this.eventWindow.filter(e => e.timestamp > cutoff);

    // TODO: Analyze patterns
    // TODO: Generate signals with confidence scores
    // TODO: Apply decay to existing signals

    const newSignals: Signal[] = [];
    return newSignals;
  }

  updateSignals(): Signal[] {
    const now = Date.now();

    // Remove expired signals
    this.activeSignals = this.activeSignals.filter(s => s.expiresAt > now);

    // Apply decay
    this.activeSignals.forEach(signal => {
      // TODO: Apply decay formula
    });

    return this.activeSignals;
  }

  getActiveSignals(): Signal[] {
    return [...this.activeSignals];
  }
}
