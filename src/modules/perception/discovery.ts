/**
 * Token Discovery
 * Discovers trending and new tokens on Solana DEXs
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger.js';

export interface TrendingToken {
  address: string;
  symbol: string;
  name: string;
  priceUSD: number;
  volume24h: number;
  priceChange24h: number;
  liquidity: number;
  marketCap?: number;
  age?: number; // hours since creation
}

export class TokenDiscovery {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'ohmarwtf/1.0'
      }
    });
  }

  /**
   * Get trending tokens from DexScreener
   */
  async getTrendingTokens(limit: number = 10): Promise<TrendingToken[]> {
    try {
      // DexScreener trending/boosted endpoint for Solana
      const url = 'https://api.dexscreener.com/latest/dex/search?q=SOL';
      const response = await this.httpClient.get(url);

      if (!response.data?.pairs) {
        return [];
      }

      const tokens: TrendingToken[] = [];
      const seenAddresses = new Set<string>();

      for (const pair of response.data.pairs) {
        // Only Solana tokens
        if (pair.chainId !== 'solana') continue;

        const baseToken = pair.baseToken;
        const address = baseToken.address;

        // Skip if already seen or not enough data
        if (seenAddresses.has(address)) continue;
        if (!pair.priceUsd || !pair.volume?.h24) continue;

        seenAddresses.add(address);

        tokens.push({
          address,
          symbol: baseToken.symbol,
          name: baseToken.name,
          priceUSD: parseFloat(pair.priceUsd),
          volume24h: parseFloat(pair.volume.h24 || '0'),
          priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
          liquidity: parseFloat(pair.liquidity?.usd || '0'),
          marketCap: pair.marketCap ? parseFloat(pair.marketCap) : undefined,
          age: pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60) : undefined
        });

        if (tokens.length >= limit) break;
      }

      // Sort by volume
      tokens.sort((a, b) => b.volume24h - a.volume24h);

      logger.info('Discovered trending tokens', { count: tokens.length });

      return tokens;

    } catch (error: any) {
      logger.error('Failed to discover trending tokens', { error: error.message });
      return [];
    }
  }

  /**
   * Get tokens with significant price movement
   */
  async getMovingTokens(minChangePercent: number = 20): Promise<TrendingToken[]> {
    try {
      const url = 'https://api.dexscreener.com/latest/dex/tokens/solana';
      const response = await this.httpClient.get(url);

      if (!response.data?.pairs) {
        return [];
      }

      const tokens: TrendingToken[] = [];
      const seenAddresses = new Set<string>();

      for (const pair of response.data.pairs) {
        const baseToken = pair.baseToken;
        const address = baseToken.address;
        const priceChange = parseFloat(pair.priceChange?.h24 || '0');

        if (seenAddresses.has(address)) continue;
        if (Math.abs(priceChange) < minChangePercent) continue;

        seenAddresses.add(address);

        tokens.push({
          address,
          symbol: baseToken.symbol,
          name: baseToken.name,
          priceUSD: parseFloat(pair.priceUsd || '0'),
          volume24h: parseFloat(pair.volume?.h24 || '0'),
          priceChange24h: priceChange,
          liquidity: parseFloat(pair.liquidity?.usd || '0')
        });
      }

      tokens.sort((a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h));

      logger.info('Discovered moving tokens', { count: tokens.length });

      return tokens;

    } catch (error: any) {
      logger.error('Failed to discover moving tokens', { error: error.message });
      return [];
    }
  }

  /**
   * Get new token listings
   */
  async getNewTokens(maxAgeHours: number = 24): Promise<TrendingToken[]> {
    try {
      const url = 'https://api.dexscreener.com/latest/dex/search?q=SOL';
      const response = await this.httpClient.get(url);

      if (!response.data?.pairs) {
        return [];
      }

      const now = Date.now();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      const tokens: TrendingToken[] = [];
      const seenAddresses = new Set<string>();

      for (const pair of response.data.pairs) {
        if (pair.chainId !== 'solana') continue;
        if (!pair.pairCreatedAt) continue;

        const age = now - pair.pairCreatedAt;
        if (age > maxAgeMs) continue;

        const baseToken = pair.baseToken;
        const address = baseToken.address;

        if (seenAddresses.has(address)) continue;

        seenAddresses.add(address);

        tokens.push({
          address,
          symbol: baseToken.symbol,
          name: baseToken.name,
          priceUSD: parseFloat(pair.priceUsd || '0'),
          volume24h: parseFloat(pair.volume?.h24 || '0'),
          priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
          liquidity: parseFloat(pair.liquidity?.usd || '0'),
          age: age / (1000 * 60 * 60) // hours
        });
      }

      tokens.sort((a, b) => (a.age || 0) - (b.age || 0));

      logger.info('Discovered new tokens', { count: tokens.length });

      return tokens;

    } catch (error: any) {
      logger.error('Failed to discover new tokens', { error: error.message });
      return [];
    }
  }
}
