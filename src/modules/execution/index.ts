/**
 * Execution Layer
 * Turns approved intents into DEX trades (or simulates them)
 */

import { Intent, TradeResult, Position } from '../../types/index.js';
import { PaperTradingSimulator } from './simulator.js';
import { logger } from '../../utils/logger.js';

export interface ExecutionConfig {
  walletPrivateKey?: string;
  solanaRpcUrl: string;
  maxSlippagePct: number;
  dexProgramId?: string;
  paperMode: boolean;
  initialCapital: number;
}

export interface IExecutionLayer {
  /**
   * Initialize wallet and DEX connection
   */
  initialize(): Promise<void>;

  /**
   * Execute an approved intent
   */
  execute(intent: Intent): Promise<TradeResult>;

  /**
   * Get current wallet balance or simulated capital
   */
  getBalance(): Promise<number>;

  /**
   * Get current positions
   */
  getPositions(): Position[];

  /**
   * Update position prices
   */
  updatePositions(prices: Map<string, number>): void;

  /**
   * Cleanup connections
   */
  shutdown(): Promise<void>;
}

export class ExecutionLayer implements IExecutionLayer {
  private config: ExecutionConfig;
  private simulator?: PaperTradingSimulator;

  constructor(config: ExecutionConfig) {
    this.config = config;

    if (config.paperMode) {
      this.simulator = new PaperTradingSimulator({
        initialCapital: config.initialCapital,
        slippagePct: config.maxSlippagePct
      });
    }
  }

  async initialize(): Promise<void> {
    if (this.config.paperMode) {
      logger.info('Paper trading mode enabled', {
        initialCapital: this.config.initialCapital
      });
    } else {
      // TODO: Initialize real Solana wallet and DEX connection
      logger.warn('Real trading not yet implemented - using paper mode');
      this.simulator = new PaperTradingSimulator({
        initialCapital: this.config.initialCapital,
        slippagePct: this.config.maxSlippagePct
      });
    }
  }

  async execute(intent: Intent): Promise<TradeResult> {
    if (this.simulator) {
      return await this.simulator.execute(intent);
    }

    // TODO: Real DEX execution
    throw new Error('Real trading not implemented');
  }

  async getBalance(): Promise<number> {
    if (this.simulator) {
      return this.simulator.getCapital();
    }

    // TODO: Query real wallet balance
    return 0;
  }

  getPositions(): Position[] {
    if (this.simulator) {
      return this.simulator.getPositions();
    }

    // TODO: Query real positions
    return [];
  }

  updatePositions(prices: Map<string, number>): void {
    if (this.simulator) {
      this.simulator.updatePositions(prices);
    }
  }

  async shutdown(): Promise<void> {
    if (this.simulator) {
      const final = this.simulator.getTotalValue();
      const initial = this.config.initialCapital;
      const pnl = final - initial;
      const pnlPct = (pnl / initial) * 100;

      logger.info('Paper trading session complete', {
        initialCapital: initial,
        finalValue: final,
        pnl,
        pnlPct: pnlPct.toFixed(2) + '%',
        trades: this.simulator.getTradeHistory().length
      });
    }
  }
}
