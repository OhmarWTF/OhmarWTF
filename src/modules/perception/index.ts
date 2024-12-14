/**
 * Perception Layer
 * Pulls market and social data, normalizes into Event format
 */

import { Event } from '../../types/index.js';
import { SolanaMonitor } from './solana.js';
import { MarketMonitor } from './market.js';
import { TwitterMonitor } from './twitter.js';
import { JsonStore } from '../../utils/persistence.js';
import { logger } from '../../utils/logger.js';

export interface PerceptionConfig {
  solanaRpcUrl: string;
  twitterEnabled: boolean;
  pollIntervalMs: number;
}

export interface IPerceptionLayer {
  /**
   * Initialize connections and data sources
   */
  initialize(): Promise<void>;

  /**
   * Poll for new events
   * Returns array of normalized events
   */
  poll(): Promise<Event[]>;

  /**
   * Add token to tracking list
   */
  trackToken(address: string, symbol?: string): Promise<void>;

  /**
   * Cleanup and close connections
   */
  shutdown(): Promise<void>;
}

export class PerceptionLayer implements IPerceptionLayer {
  private config: PerceptionConfig;

  // Monitors
  private solana: SolanaMonitor;
  private market: MarketMonitor;
  private twitter: TwitterMonitor;

  // Event persistence
  private eventStore: JsonStore;
  private eventCount: number = 0;

  constructor(config: PerceptionConfig) {
    this.config = config;

    // Initialize monitors
    this.solana = new SolanaMonitor({
      rpcUrl: config.solanaRpcUrl,
      pollIntervalMs: config.pollIntervalMs
    });

    this.market = new MarketMonitor({
      pollIntervalMs: config.pollIntervalMs
    });

    this.twitter = new TwitterMonitor({
      enabled: config.twitterEnabled
    });

    // Event storage
    this.eventStore = new JsonStore('data/events');
  }

  async initialize(): Promise<void> {
    logger.info('Initializing perception layer...');

    // Initialize event storage
    await this.eventStore.initialize();

    // Initialize monitors
    await this.solana.initialize();
    await this.market.initialize();
    await this.twitter.initialize();

    // Load or create initial tracking list
    await this.loadTrackedTokens();

    logger.info('Perception layer initialized', {
      trackedTokens: this.solana.getTrackedTokenCount()
    });
  }

  async poll(): Promise<Event[]> {
    const events: Event[] = [];

    // Poll Solana on-chain data
    const solanaEvents = await this.solana.poll();
    events.push(...solanaEvents);

    // Poll market data for tracked tokens
    const trackedTokens = this.solana.getTrackedTokens();
    const tokenAddresses = trackedTokens.map(t => t.address);

    if (tokenAddresses.length > 0) {
      const marketEvents = await this.market.poll(tokenAddresses);
      events.push(...marketEvents);
    }

    // Poll Twitter if enabled
    const twitterEvents = await this.twitter.poll();
    events.push(...twitterEvents);

    // Persist events to disk
    if (events.length > 0) {
      await this.persistEvents(events);
      this.eventCount += events.length;
    }

    return events;
  }

  async trackToken(address: string, symbol?: string): Promise<void> {
    await this.solana.trackToken(address, symbol);
    await this.saveTrackedTokens();
  }

  /**
   * Get list of tracked token addresses
   */
  getTrackedTokenAddresses(): string[] {
    return this.solana.getTrackedTokens().map(t => t.address);
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down perception layer...');

    await this.solana.shutdown();
    await this.market.shutdown();
    await this.twitter.shutdown();

    logger.info('Perception layer shutdown complete', {
      totalEventsGenerated: this.eventCount
    });
  }

  /**
   * Persist events to disk
   */
  private async persistEvents(events: Event[]): Promise<void> {
    try {
      // Append to daily events file
      const date = new Date().toISOString().split('T')[0];
      const filename = `events_${date}.jsonl`;

      for (const event of events) {
        await this.eventStore.append(filename, event);
      }

    } catch (error) {
      logger.error('Failed to persist events', { error });
    }
  }

  /**
   * Load tracked tokens from disk
   */
  private async loadTrackedTokens(): Promise<void> {
    try {
      const tokens = await this.eventStore.read<Array<{ address: string; symbol?: string }>>('tracked_tokens.json');

      if (tokens && tokens.length > 0) {
        for (const token of tokens) {
          await this.solana.trackToken(token.address, token.symbol);
        }
        logger.info('Loaded tracked tokens', { count: tokens.length });
      } else {
        // Add some default tokens to track for testing
        await this.addDefaultTokens();
      }

    } catch (error) {
      logger.warn('No tracked tokens found, starting fresh', { error });
      await this.addDefaultTokens();
    }
  }

  /**
   * Save tracked tokens to disk
   */
  private async saveTrackedTokens(): Promise<void> {
    try {
      const tokens = this.solana.getTrackedTokens().map(t => ({
        address: t.address,
        symbol: t.symbol
      }));

      await this.eventStore.write('tracked_tokens.json', tokens);

    } catch (error) {
      logger.error('Failed to save tracked tokens', { error });
    }
  }

  /**
   * Add some default tokens for initial testing
   */
  private async addDefaultTokens(): Promise<void> {
    // Add a few well-known Solana tokens for testing
    const defaultTokens = [
      // BONK - popular meme coin
      { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK' },
      // WIF - dogwifhat
      { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF' }
    ];

    for (const token of defaultTokens) {
      try {
        await this.trackToken(token.address, token.symbol);
      } catch (error) {
        logger.warn('Failed to add default token', { token, error });
      }
    }

    logger.info('Added default tokens for tracking', { count: defaultTokens.length });
  }
}
