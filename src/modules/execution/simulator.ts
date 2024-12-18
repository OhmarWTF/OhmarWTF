/**
 * Paper Trading Simulator
 * Simulates trades without real money
 */

import { Intent, TradeResult, TradeStatus, TradeDirection, Position } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export interface SimulatorConfig {
  initialCapital: number;
  slippagePct: number;
}

export class PaperTradingSimulator {
  private config: SimulatorConfig;
  private capital: number;
  private positions: Map<string, Position> = new Map();
  private tradeHistory: TradeResult[] = [];

  // Mock prices (in real implementation, would fetch from market)
  private mockPrices: Map<string, number> = new Map();

  constructor(config: SimulatorConfig) {
    this.config = config;
    this.capital = config.initialCapital;
  }

  /**
   * Execute an intent in simulation
   */
  async execute(intent: Intent): Promise<TradeResult> {
    const result: TradeResult = {
      id: `sim_trade_${Date.now()}`,
      timestamp: Date.now(),
      intentId: intent.id,
      tokenAddress: intent.tokenAddress || '',
      tokenSymbol: intent.tokenSymbol || '',
      direction: this.getDirection(intent.type),
      status: TradeStatus.PENDING,
      requestedAmount: 0,
      triggeredBySignals: intent.supportingSignals,
      agentMoodAtTime: intent.stateSnapshot.mood
    };

    try {
      switch (intent.type) {
        case 'enter':
          await this.simulateEnter(intent, result);
          break;
        case 'exit':
          await this.simulateExit(intent, result);
          break;
        case 'add':
          await this.simulateAdd(intent, result);
          break;
        case 'reduce':
          await this.simulateReduce(intent, result);
          break;
        default:
          result.status = TradeStatus.CANCELLED;
          result.error = `Cannot execute ${intent.type} in simulator`;
      }

      this.tradeHistory.push(result);

      logger.info('Simulated trade', {
        type: intent.type,
        token: result.tokenSymbol,
        status: result.status,
        amount: result.filledAmount
      });

    } catch (error) {
      result.status = TradeStatus.FAILED;
      result.error = String(error);
      logger.error('Simulation error', { error });
    }

    return result;
  }

  private async simulateEnter(intent: Intent, result: TradeResult): Promise<void> {
    if (!intent.tokenAddress || !intent.sizePct) {
      throw new Error('Missing token address or size');
    }

    const investAmount = this.capital * (intent.sizePct / 100);
    if (investAmount > this.capital) {
      throw new Error('Insufficient capital');
    }

    // Get mock price
    const price = this.getMockPrice(intent.tokenAddress);

    // Apply slippage
    const slippage = this.config.slippagePct / 100;
    const actualPrice = price * (1 + slippage);

    // Calculate amount
    const amount = investAmount / actualPrice;

    // Create position
    const position: Position = {
      tokenAddress: intent.tokenAddress,
      tokenSymbol: intent.tokenSymbol || '',
      amount,
      averageEntryPrice: actualPrice,
      currentPrice: actualPrice,
      unrealizedPnL: 0,
      unrealizedPnLPct: 0,
      openedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      entryIntentId: intent.id,
      tradeIds: [result.id]
    };

    this.positions.set(intent.tokenAddress, position);
    this.capital -= investAmount;

    result.status = TradeStatus.FILLED;
    result.filledAmount = amount;
    result.price = actualPrice;
    result.slippage = slippage * 100;
    result.direction = TradeDirection.BUY;
  }

  private async simulateExit(intent: Intent, result: TradeResult): Promise<void> {
    if (!intent.tokenAddress) {
      throw new Error('Missing token address');
    }

    const position = this.positions.get(intent.tokenAddress);
    if (!position) {
      throw new Error('No position to exit');
    }

    const price = this.getMockPrice(intent.tokenAddress);
    const slippage = this.config.slippagePct / 100;
    const actualPrice = price * (1 - slippage);

    const proceeds = position.amount * actualPrice;
    this.capital += proceeds;

    this.positions.delete(intent.tokenAddress);

    result.status = TradeStatus.FILLED;
    result.filledAmount = position.amount;
    result.price = actualPrice;
    result.slippage = slippage * 100;
    result.direction = TradeDirection.SELL;
  }

  private async simulateAdd(intent: Intent, result: TradeResult): Promise<void> {
    if (!intent.tokenAddress || !intent.sizePct) {
      throw new Error('Missing token address or size');
    }

    const position = this.positions.get(intent.tokenAddress);
    if (!position) {
      throw new Error('No position to add to');
    }

    const investAmount = this.capital * (intent.sizePct / 100);
    const price = this.getMockPrice(intent.tokenAddress);
    const slippage = this.config.slippagePct / 100;
    const actualPrice = price * (1 + slippage);

    const additionalAmount = investAmount / actualPrice;

    // Update position
    const totalCost = (position.amount * position.averageEntryPrice) + investAmount;
    const totalAmount = position.amount + additionalAmount;
    position.averageEntryPrice = totalCost / totalAmount;
    position.amount = totalAmount;
    position.lastUpdatedAt = Date.now();
    position.tradeIds.push(result.id);

    this.capital -= investAmount;

    result.status = TradeStatus.FILLED;
    result.filledAmount = additionalAmount;
    result.price = actualPrice;
    result.slippage = slippage * 100;
    result.direction = TradeDirection.BUY;
  }

  private async simulateReduce(intent: Intent, result: TradeResult): Promise<void> {
    if (!intent.tokenAddress || !intent.sizePct) {
      throw new Error('Missing token address or size');
    }

    const position = this.positions.get(intent.tokenAddress);
    if (!position) {
      throw new Error('No position to reduce');
    }

    const reduceAmount = position.amount * (intent.sizePct / 100);
    const price = this.getMockPrice(intent.tokenAddress);
    const slippage = this.config.slippagePct / 100;
    const actualPrice = price * (1 - slippage);

    const proceeds = reduceAmount * actualPrice;
    this.capital += proceeds;

    position.amount -= reduceAmount;
    position.lastUpdatedAt = Date.now();
    position.tradeIds.push(result.id);

    result.status = TradeStatus.FILLED;
    result.filledAmount = reduceAmount;
    result.price = actualPrice;
    result.slippage = slippage * 100;
    result.direction = TradeDirection.SELL;
  }

  /**
   * Update position prices and PnL
   */
  updatePositions(prices: Map<string, number>): void {
    for (const [addr, position] of this.positions) {
      const currentPrice = prices.get(addr);
      if (currentPrice) {
        position.currentPrice = currentPrice;
        position.unrealizedPnL = (currentPrice - position.averageEntryPrice) * position.amount;
        position.unrealizedPnLPct = ((currentPrice - position.averageEntryPrice) / position.averageEntryPrice) * 100;
        position.lastUpdatedAt = Date.now();
      }
    }
  }

  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getCapital(): number {
    return this.capital;
  }

  getTotalValue(): number {
    let positionValue = 0;
    for (const position of this.positions.values()) {
      positionValue += position.amount * (position.currentPrice || position.averageEntryPrice);
    }
    return this.capital + positionValue;
  }

  getTradeHistory(): TradeResult[] {
    return [...this.tradeHistory];
  }

  private getDirection(intentType: string): TradeDirection {
    return (intentType === 'enter' || intentType === 'add') ? TradeDirection.BUY : TradeDirection.SELL;
  }

  private getMockPrice(tokenAddress: string): number {
    // Return cached price or generate random price
    if (!this.mockPrices.has(tokenAddress)) {
      this.mockPrices.set(tokenAddress, Math.random() * 0.01);
    }

    // Simulate price movement
    const current = this.mockPrices.get(tokenAddress)!;
    const change = (Math.random() - 0.5) * 0.02; // +/- 1% per update
    const newPrice = current * (1 + change);
    this.mockPrices.set(tokenAddress, newPrice);

    return newPrice;
  }

  /**
   * Set mock price for testing
   */
  setMockPrice(tokenAddress: string, price: number): void {
    this.mockPrices.set(tokenAddress, price);
  }
}
