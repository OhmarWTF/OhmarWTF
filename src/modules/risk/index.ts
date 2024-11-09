/**
 * Risk and Guardrails
 * Enforces hard limits - the only deterministic rules
 */

import { Intent, Position, TradeResult } from '../../types/index.js';

export interface RiskConfig {
  maxPositionSizePct: number;      // Max % of capital per position
  maxDailyLossPct: number;         // Max daily loss before safe mode
  maxTotalExposurePct: number;     // Max % of capital in positions
  minCapitalReserve: number;       // Min SOL to keep liquid
  dailyTradeLimit?: number;        // Optional max trades per day
}

export interface RiskCheckResult {
  approved: boolean;
  reason?: string;
  adjustedSizePct?: number;
}

export interface IRiskGuardrails {
  /**
   * Check if intent is allowed
   * Can modify intent size if needed
   */
  checkIntent(intent: Intent, positions: Position[], capital: number): RiskCheckResult;

  /**
   * Record trade for daily limits
   */
  recordTrade(trade: TradeResult): void;

  /**
   * Check if should enter safe mode
   */
  shouldEnterSafeMode(): boolean;

  /**
   * Reset daily counters (call at day boundary)
   */
  resetDaily(): void;
}

export class RiskGuardrails implements IRiskGuardrails {
  private config: RiskConfig;
  private dailyTrades: TradeResult[] = [];
  private dailyPnL: number = 0;

  constructor(config: RiskConfig) {
    this.config = config;
  }

  checkIntent(intent: Intent, positions: Position[], capital: number): RiskCheckResult {
    // WAIT and WATCH always allowed
    if (intent.type === 'wait' || intent.type === 'watch') {
      return { approved: true };
    }

    // Check daily trade limit
    if (this.config.dailyTradeLimit && this.dailyTrades.length >= this.config.dailyTradeLimit) {
      return { approved: false, reason: 'Daily trade limit reached' };
    }

    // Check if safe mode should be active
    if (this.shouldEnterSafeMode()) {
      return { approved: false, reason: 'Safe mode active due to losses' };
    }

    // Check position size limits for ENTER and ADD
    if (intent.type === 'enter' || intent.type === 'add') {
      if (!intent.sizePct) {
        return { approved: false, reason: 'No size specified' };
      }

      const maxAllowed = this.config.maxPositionSizePct;
      if (intent.sizePct > maxAllowed) {
        return {
          approved: true,
          adjustedSizePct: maxAllowed,
          reason: `Size reduced from ${intent.sizePct}% to ${maxAllowed}%`
        };
      }
    }

    // Check total exposure
    const currentExposure = this.calculateExposure(positions, capital);
    if (intent.type === 'enter' && currentExposure >= this.config.maxTotalExposurePct) {
      return { approved: false, reason: 'Maximum exposure reached' };
    }

    return { approved: true };
  }

  recordTrade(trade: TradeResult): void {
    this.dailyTrades.push(trade);

    // Update daily PnL if trade has PnL info
    // TODO: Calculate actual PnL from trade
  }

  shouldEnterSafeMode(): boolean {
    const lossPct = Math.abs(this.dailyPnL);
    return lossPct >= this.config.maxDailyLossPct;
  }

  resetDaily(): void {
    this.dailyTrades = [];
    this.dailyPnL = 0;
  }

  private calculateExposure(positions: Position[], capital: number): number {
    const totalValue = positions.reduce((sum, pos) => {
      return sum + (pos.amount * (pos.currentPrice || pos.averageEntryPrice));
    }, 0);

    return (totalValue / capital) * 100;
  }
}
