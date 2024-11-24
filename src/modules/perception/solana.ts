/**
 * Solana Perception
 * Monitors on-chain activity and market data
 */

import { Connection, PublicKey, ParsedAccountData } from '@solana/web3.js';
import { getAccount, getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Event, EventSource, EventType } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export interface SolanaConfig {
  rpcUrl: string;
  wsUrl?: string;
  pollIntervalMs: number;
}

export interface TokenData {
  address: string;
  symbol?: string;
  decimals: number;
  supply: bigint;
  lastSeenAt: number;
}

export interface LiquiditySnapshot {
  tokenAddress: string;
  timestamp: number;
  liquidityUSD: number;
  volume24h: number;
}

/**
 * Solana market monitor
 * Generates events from on-chain data
 */
export class SolanaMonitor {
  private connection: Connection;
  private config: SolanaConfig;

  // State tracking
  private trackedTokens: Map<string, TokenData> = new Map();
  private liquiditySnapshots: Map<string, LiquiditySnapshot[]> = new Map();
  private lastPollTime: number = 0;

  constructor(config: SolanaConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000
    });
  }

  /**
   * Initialize connection and verify RPC is reachable
   */
  async initialize(): Promise<void> {
    try {
      const version = await this.connection.getVersion();
      logger.info('Solana RPC connected', {
        rpcUrl: this.config.rpcUrl,
        version: version['solana-core']
      });

      // Get initial slot to confirm connection
      const slot = await this.connection.getSlot();
      logger.info('Current slot', { slot });

    } catch (error) {
      logger.error('Failed to connect to Solana RPC', { error });
      throw error;
    }
  }

  /**
   * Poll for new events
   */
  async poll(): Promise<Event[]> {
    const events: Event[] = [];
    const now = Date.now();

    try {
      // Heartbeat event every poll
      events.push(this.createHeartbeatEvent(now));

      // Poll tracked tokens for changes
      for (const [address, tokenData] of this.trackedTokens) {
        const tokenEvents = await this.pollToken(address, tokenData);
        events.push(...tokenEvents);
      }

      // TODO: Scan for new tokens (Phase 1 enhancement)
      // TODO: Monitor specific DEX pools (Phase 1 enhancement)

      this.lastPollTime = now;

    } catch (error) {
      logger.error('Solana poll error', { error });

      events.push({
        id: `error_${now}`,
        timestamp: now,
        source: EventSource.SOLANA_CHAIN,
        type: EventType.ERROR,
        data: { error: String(error) }
      });
    }

    return events;
  }

  /**
   * Add token to tracking list
   */
  async trackToken(address: string, symbol?: string): Promise<void> {
    try {
      const pubkey = new PublicKey(address);

      // Get mint info
      const mintInfo = await getMint(this.connection, pubkey);

      const tokenData: TokenData = {
        address,
        symbol,
        decimals: mintInfo.decimals,
        supply: mintInfo.supply,
        lastSeenAt: Date.now()
      };

      this.trackedTokens.set(address, tokenData);
      logger.info('Now tracking token', { address, symbol, decimals: mintInfo.decimals });

      // Generate new token event
      const event: Event = {
        id: `new_token_${Date.now()}`,
        timestamp: Date.now(),
        source: EventSource.SOLANA_CHAIN,
        type: EventType.NEW_TOKEN,
        tokenAddress: address,
        tokenSymbol: symbol,
        data: {
          decimals: mintInfo.decimals,
          supply: mintInfo.supply.toString()
        }
      };

    } catch (error) {
      logger.error('Failed to track token', { address, error });
      throw error;
    }
  }

  /**
   * Poll a specific token for changes
   */
  private async pollToken(address: string, tokenData: TokenData): Promise<Event[]> {
    const events: Event[] = [];
    const now = Date.now();

    try {
      const pubkey = new PublicKey(address);
      const mintInfo = await getMint(this.connection, pubkey);

      // Check for supply changes
      if (mintInfo.supply !== tokenData.supply) {
        const change = Number(mintInfo.supply - tokenData.supply) / Math.pow(10, tokenData.decimals);

        events.push({
          id: `supply_change_${address}_${now}`,
          timestamp: now,
          source: EventSource.SOLANA_CHAIN,
          type: EventType.TOKEN_REVIVAL, // Or new type
          tokenAddress: address,
          tokenSymbol: tokenData.symbol,
          data: {
            oldSupply: tokenData.supply.toString(),
            newSupply: mintInfo.supply.toString(),
            change
          }
        });

        // Update tracked data
        tokenData.supply = mintInfo.supply;
      }

      tokenData.lastSeenAt = now;

    } catch (error) {
      logger.error('Failed to poll token', { address, error });
    }

    return events;
  }

  /**
   * Get recent transactions for a token
   * This is a placeholder - full implementation would parse DEX swaps
   */
  async getTokenActivity(address: string, limit: number = 10): Promise<Event[]> {
    const events: Event[] = [];

    try {
      const pubkey = new PublicKey(address);
      const signatures = await this.connection.getSignaturesForAddress(pubkey, { limit });

      // For now, just detect if there's activity
      if (signatures.length > 0) {
        const recentSig = signatures[0];

        events.push({
          id: `activity_${address}_${Date.now()}`,
          timestamp: Date.now(),
          source: EventSource.SOLANA_CHAIN,
          type: EventType.VOLUME_SPIKE,
          tokenAddress: address,
          data: {
            recentTxCount: signatures.length,
            lastTxSignature: recentSig.signature,
            lastTxTime: recentSig.blockTime
          }
        });
      }

    } catch (error) {
      logger.error('Failed to get token activity', { address, error });
    }

    return events;
  }

  /**
   * Create heartbeat event
   */
  private createHeartbeatEvent(timestamp: number): Event {
    return {
      id: `heartbeat_${timestamp}`,
      timestamp,
      source: EventSource.SOLANA_CHAIN,
      type: EventType.HEARTBEAT,
      data: {
        trackedTokens: this.trackedTokens.size,
        lastPollTime: this.lastPollTime
      }
    };
  }

  /**
   * Get tracked token count
   */
  getTrackedTokenCount(): number {
    return this.trackedTokens.size;
  }

  /**
   * List tracked tokens
   */
  getTrackedTokens(): TokenData[] {
    return Array.from(this.trackedTokens.values());
  }

  /**
   * Remove token from tracking
   */
  untrackToken(address: string): void {
    this.trackedTokens.delete(address);
    this.liquiditySnapshots.delete(address);
    logger.info('Stopped tracking token', { address });
  }

  /**
   * Close connection
   */
  async shutdown(): Promise<void> {
    // Connection cleanup if needed
    logger.info('Solana monitor shutdown');
  }
}
