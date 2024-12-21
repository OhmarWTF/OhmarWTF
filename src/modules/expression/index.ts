/**
 * Expression Layer
 * Generates tweets from agent's internal state and actions
 */

import { AgentState, Intent, TradeResult, Signal, MemoryEntry } from '../../types/index.js';
import { generateTweet, addContinuityReference, isRepetitive } from './narrative.js';

export interface ExpressionConfig {
  twitterEnabled: boolean;
  twitterApiKey?: string;
  twitterApiSecret?: string;
  twitterAccessToken?: string;
  twitterAccessSecret?: string;
  minTweetIntervalMs: number;
  maxDailyTweets: number;
}

export enum TweetMode {
  PRE_TRADE = 'pre_trade',
  IN_TRADE = 'in_trade',
  POST_MORTEM = 'post_mortem',
  AMBIENT = 'ambient',
  REFLECTION = 'reflection'
}

export interface ITweetContent {
  text: string;
  mode: TweetMode;
  context?: unknown;
}

export interface IExpressionLayer {
  /**
   * Initialize Twitter client
   */
  initialize(): Promise<void>;

  /**
   * Generate tweet content from current context
   */
  compose(
    mode: TweetMode,
    context: {
      state?: AgentState;
      intent?: Intent;
      trade?: TradeResult;
      signals?: Signal[];
      memory?: MemoryEntry;
    }
  ): ITweetContent | null;

  /**
   * Post a tweet
   */
  post(content: ITweetContent): Promise<boolean>;

  /**
   * Check if can tweet (rate limiting)
   */
  canTweet(): boolean;
}

export class ExpressionLayer implements IExpressionLayer {
  private config: ExpressionConfig;
  private lastTweetTime: number = 0;
  private dailyTweetCount: number = 0;
  private lastResetDay: number = 0;
  private recentTweets: string[] = [];

  constructor(config: ExpressionConfig) {
    this.config = config;
    this.lastResetDay = this.getCurrentDay();
  }

  async initialize(): Promise<void> {
    if (!this.config.twitterEnabled) {
      return;
    }

    // TODO: Initialize Twitter API client
  }

  compose(
    mode: TweetMode,
    context: {
      state?: AgentState;
      intent?: Intent;
      trade?: TradeResult;
      signals?: Signal[];
      memory?: MemoryEntry;
      recentMemories?: MemoryEntry[];
    }
  ): ITweetContent | null {
    if (!this.canTweet()) {
      return null;
    }

    // Generate base tweet
    let text = generateTweet(mode, {
      state: context.state || { primaryMood: 'neutral' } as AgentState,
      intent: context.intent,
      trade: context.trade,
      signals: context.signals,
      recentMemories: context.recentMemories
    });

    if (!text) {
      return null;
    }

    // Add continuity reference occasionally
    if (context.recentMemories && Math.random() < 0.2) {
      text = addContinuityReference(text, context.recentMemories);
    }

    // Check for repetition
    if (isRepetitive(text, this.recentTweets)) {
      return null;
    }

    return { text, mode, context };
  }

  async post(content: ITweetContent): Promise<boolean> {
    if (!this.config.twitterEnabled) {
      console.log(`[TWEET ${content.mode}] ${content.text}`);
      this.updateRateLimit();
      this.recentTweets.push(content.text);
      if (this.recentTweets.length > 20) {
        this.recentTweets.shift();
      }
      return true;
    }

    // TODO: Post to Twitter API
    this.updateRateLimit();
    this.recentTweets.push(content.text);
    if (this.recentTweets.length > 20) {
      this.recentTweets.shift();
    }
    return true;
  }

  canTweet(): boolean {
    this.checkDayReset();

    if (this.dailyTweetCount >= this.config.maxDailyTweets) {
      return false;
    }

    const elapsed = Date.now() - this.lastTweetTime;
    return elapsed >= this.config.minTweetIntervalMs;
  }

  private updateRateLimit(): void {
    this.lastTweetTime = Date.now();
    this.dailyTweetCount++;
  }

  private checkDayReset(): void {
    const currentDay = this.getCurrentDay();
    if (currentDay !== this.lastResetDay) {
      this.dailyTweetCount = 0;
      this.lastResetDay = currentDay;
    }
  }

  private getCurrentDay(): number {
    return Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  }
}
