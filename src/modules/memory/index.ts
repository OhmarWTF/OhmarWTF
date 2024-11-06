/**
 * Memory System
 * Short and long term memory with narrative continuity
 */

import { MemoryEntry, MemoryQuery, MemoryType, MemoryImportance, TradeResult } from '../../types/index.js';

export interface MemoryConfig {
  shortTermWindowMs: number;
  maxShortTermEntries: number;
  persistenceDir: string;
}

export interface IMemorySystem {
  /**
   * Store a new memory
   */
  store(entry: MemoryEntry): void;

  /**
   * Query memories
   */
  query(query: MemoryQuery): MemoryEntry[];

  /**
   * Get recent short term memories
   */
  getShortTerm(): MemoryEntry[];

  /**
   * Create memory from trade result
   */
  recordTrade(trade: TradeResult, outcome?: 'win' | 'loss', pnl?: number): void;

  /**
   * Persist memories to disk
   */
  persist(): Promise<void>;

  /**
   * Load memories from disk
   */
  load(): Promise<void>;
}

export class MemorySystem implements IMemorySystem {
  private config: MemoryConfig;
  private shortTerm: MemoryEntry[] = [];
  private longTerm: MemoryEntry[] = [];

  constructor(config: MemoryConfig) {
    this.config = config;
  }

  store(entry: MemoryEntry): void {
    // Add to short term
    this.shortTerm.push(entry);

    // Trim if exceeds limit
    if (this.shortTerm.length > this.config.maxShortTermEntries) {
      this.shortTerm.shift();
    }

    // Add important memories to long term
    if (entry.importance === MemoryImportance.HIGH ||
        entry.importance === MemoryImportance.CRITICAL) {
      this.longTerm.push(entry);
    }
  }

  query(query: MemoryQuery): MemoryEntry[] {
    let results = [...this.longTerm, ...this.shortTerm];

    if (query.type) {
      results = results.filter(m => m.type === query.type);
    }

    if (query.tokenAddress) {
      results = results.filter(m => m.tokenAddress === query.tokenAddress);
    }

    if (query.timeRange) {
      results = results.filter(m =>
        m.timestamp >= query.timeRange!.start &&
        m.timestamp <= query.timeRange!.end
      );
    }

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    // Update access tracking
    results.forEach(m => {
      m.accessCount++;
      m.lastAccessedAt = Date.now();
    });

    return results;
  }

  getShortTerm(): MemoryEntry[] {
    return [...this.shortTerm];
  }

  recordTrade(trade: TradeResult, outcome?: 'win' | 'loss', pnl?: number): void {
    const entry: MemoryEntry = {
      id: `mem_${Date.now()}`,
      timestamp: trade.timestamp,
      type: MemoryType.TRADE,
      importance: outcome === 'win'
        ? MemoryImportance.MEDIUM
        : outcome === 'loss'
          ? MemoryImportance.HIGH
          : MemoryImportance.LOW,
      summary: `${trade.direction} ${trade.tokenSymbol} - ${outcome || 'pending'}`,
      tokenAddress: trade.tokenAddress,
      tradeId: trade.id,
      signalIds: trade.triggeredBySignals,
      outcome,
      pnl,
      emotionalState: trade.agentMoodAtTime,
      accessCount: 0,
      lastAccessedAt: Date.now(),
      decayFactor: 1.0
    };

    this.store(entry);
  }

  async persist(): Promise<void> {
    // TODO: Write to disk
  }

  async load(): Promise<void> {
    // TODO: Read from disk
  }
}
