/**
 * Market Data Monitor
 * Fetches price, volume, and liquidity data from DEX aggregators
 */

import axios, { AxiosInstance } from 'axios';
import { Event, EventSource, EventType } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export interface MarketConfig {
  dexScreenerApiUrl?: string;
  jupiterApiUrl?: string;
  pollIntervalMs: number;
}

export interface TokenPrice {
  address: string;
  symbol: string;
  priceUSD: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  timestamp: number;
}

export interface PriceHistory {
  prices: number[];
  timestamps: number[];
  maxSize: number;
}

/**
 * Market data fetcher
 * Uses public APIs to get token prices and volumes
 */
export class MarketMonitor {
  private config: MarketConfig;
  private httpClient: AxiosInstance;

  // Price tracking
  private priceHistory: Map<string, PriceHistory> = new Map();
  private lastPrices: Map<string, TokenPrice> = new Map();

  // Thresholds for event generation
  private readonly PRICE_CHANGE_THRESHOLD = 0.05; // 5% change (more sensitive)
  private readonly VOLUME_SPIKE_MULTIPLIER = 2; // 2x average volume (more sensitive)

  // Always generate price updates for learning
  private lastPriceUpdate: Map<string, number> = new Map();
  private readonly PRICE_UPDATE_INTERVAL = 60000; // Generate price update event every 60s

  constructor(config: MarketConfig) {
    this.config = config;
    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'ohmarwtf/1.0'
      }
    });
  }

  /**
   * Initialize market monitor
   */
  async initialize(): Promise<void> {
    logger.info('Market monitor initialized');
  }

  /**
   * Poll market data for tracked tokens
   */
  async poll(tokenAddresses: string[]): Promise<Event[]> {
    const events: Event[] = [];

    for (const address of tokenAddresses) {
      const tokenEvents = await this.pollToken(address);
      events.push(...tokenEvents);
    }

    return events;
  }

  /**
   * Fetch market data for a single token
   */
  private async pollToken(address: string): Promise<Event[]> {
    const events: Event[] = [];

    try {
      // Try DexScreener first (more reliable for meme coins)
      const price = await this.fetchFromDexScreener(address);

      if (!price) {
        return events;
      }

      // Store in history
      this.updatePriceHistory(address, price);

      // Check for significant price changes
      const lastPrice = this.lastPrices.get(address);

      if (lastPrice) {
        const priceChangePercent = (price.priceUSD - lastPrice.priceUSD) / lastPrice.priceUSD;

        if (Math.abs(priceChangePercent) >= this.PRICE_CHANGE_THRESHOLD) {
          events.push({
            id: `price_change_${address}_${Date.now()}`,
            timestamp: Date.now(),
            source: EventSource.SOLANA_MARKET,
            type: EventType.PRICE_CHANGE,
            tokenAddress: address,
            tokenSymbol: price.symbol,
            data: {
              oldPrice: lastPrice.priceUSD,
              newPrice: price.priceUSD,
              changePercent: priceChangePercent * 100,
              volume24h: price.volume24h
            }
          });
        }

        // Check for volume spikes
        const avgVolume = this.getAverageVolume(address);
        if (avgVolume > 0 && price.volume24h > avgVolume * this.VOLUME_SPIKE_MULTIPLIER) {
          events.push({
            id: `volume_spike_${address}_${Date.now()}`,
            timestamp: Date.now(),
            source: EventSource.SOLANA_MARKET,
            type: EventType.VOLUME_SPIKE,
            tokenAddress: address,
            tokenSymbol: price.symbol,
            data: {
              currentVolume: price.volume24h,
              averageVolume: avgVolume,
              multiplier: price.volume24h / avgVolume,
              priceUSD: price.priceUSD
            }
          });
        }

        // Check for liquidity changes
        if (lastPrice.liquidity > 0) {
          const liquidityChange = (price.liquidity - lastPrice.liquidity) / lastPrice.liquidity;

          if (Math.abs(liquidityChange) >= 0.20) { // 20% liquidity change
            events.push({
              id: `liquidity_change_${address}_${Date.now()}`,
              timestamp: Date.now(),
              source: EventSource.SOLANA_MARKET,
              type: EventType.LIQUIDITY_CHANGE,
              tokenAddress: address,
              tokenSymbol: price.symbol,
              data: {
                oldLiquidity: lastPrice.liquidity,
                newLiquidity: price.liquidity,
                changePercent: liquidityChange * 100
              }
            });
          }
        }
      }

      // Update last price
      this.lastPrices.set(address, price);

      // Always generate periodic price update events for learning
      const lastUpdate = this.lastPriceUpdate.get(address) || 0;
      const now = Date.now();

      if (now - lastUpdate >= this.PRICE_UPDATE_INTERVAL) {
        events.push({
          id: `price_update_${address}_${now}`,
          timestamp: now,
          source: EventSource.SOLANA_MARKET,
          type: EventType.PRICE_UPDATE,
          tokenAddress: address,
          tokenSymbol: price.symbol,
          data: {
            priceUSD: price.priceUSD,
            priceChange24h: price.priceChange24h,
            volume24h: price.volume24h,
            liquidity: price.liquidity
          }
        });

        this.lastPriceUpdate.set(address, now);
        logger.debug('Price update', {
          symbol: price.symbol,
          price: price.priceUSD.toFixed(6),
          volume24h: price.volume24h.toFixed(0),
          liquidity: price.liquidity.toFixed(0)
        });
      }

    } catch (error) {
      logger.error('Failed to poll token market data', { address, error });
    }

    return events;
  }

  /**
   * Fetch price from DexScreener API
   */
  private async fetchFromDexScreener(address: string): Promise<TokenPrice | null> {
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
      const response = await this.httpClient.get(url);

      if (response.data?.pairs && response.data.pairs.length > 0) {
        // Get the pair with highest liquidity
        const pairs = response.data.pairs.sort((a: any, b: any) =>
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        );

        const topPair = pairs[0];

        return {
          address,
          symbol: topPair.baseToken.symbol,
          priceUSD: parseFloat(topPair.priceUsd || '0'),
          priceChange24h: parseFloat(topPair.priceChange?.h24 || '0'),
          volume24h: parseFloat(topPair.volume?.h24 || '0'),
          liquidity: parseFloat(topPair.liquidity?.usd || '0'),
          timestamp: Date.now()
        };
      }

      return null;

    } catch (error: any) {
      // Rate limiting or API errors are expected
      if (error.response?.status === 429) {
        logger.warn('DexScreener rate limit hit', { address });
      } else {
        logger.debug('DexScreener fetch failed', { address, error: error.message });
      }
      return null;
    }
  }

  /**
   * Update price history for a token
   */
  private updatePriceHistory(address: string, price: TokenPrice): void {
    let history = this.priceHistory.get(address);

    if (!history) {
      history = {
        prices: [],
        timestamps: [],
        maxSize: 100 // Keep last 100 data points
      };
      this.priceHistory.set(address, history);
    }

    history.prices.push(price.priceUSD);
    history.timestamps.push(price.timestamp);

    // Trim if exceeds max size
    if (history.prices.length > history.maxSize) {
      history.prices.shift();
      history.timestamps.shift();
    }
  }

  /**
   * Calculate average volume for a token
   */
  private getAverageVolume(address: string): number {
    const history = this.priceHistory.get(address);
    const lastPrice = this.lastPrices.get(address);

    if (!history || !lastPrice) {
      return 0;
    }

    // Simple average of recent volume (simplified - would need to track volume history properly)
    // For now, return current volume as baseline
    return lastPrice.volume24h;
  }

  /**
   * Get current price for a token
   */
  getLastPrice(address: string): TokenPrice | undefined {
    return this.lastPrices.get(address);
  }

  /**
   * Get price history for a token
   */
  getPriceHistory(address: string): PriceHistory | undefined {
    return this.priceHistory.get(address);
  }

  /**
   * Clear tracking data
   */
  clear(): void {
    this.priceHistory.clear();
    this.lastPrices.clear();
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Market monitor shutdown');
  }
}
