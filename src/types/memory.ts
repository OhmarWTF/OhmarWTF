/**
 * MemoryEntry - stored experience
 * Used for learning and narrative continuity
 */

export enum MemoryType {
  TRADE = 'trade',
  PATTERN = 'pattern',
  MISTAKE = 'mistake',
  SUCCESS = 'success',
  OBSERVATION = 'observation',
  NARRATIVE = 'narrative'
}

export enum MemoryImportance {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: MemoryType;
  importance: MemoryImportance;

  // Content
  summary: string;
  detail?: string;

  // Linked entities
  tokenAddress?: string;
  tradeId?: string;
  signalIds?: string[];

  // Outcome data
  outcome?: 'win' | 'loss' | 'neutral' | 'unknown';
  pnl?: number;
  pnlPct?: number;

  // Learning
  lessonLearned?: string;
  shouldAvoidPattern?: boolean;
  shouldRepeatPattern?: boolean;

  // Emotional context
  emotionalState?: string;

  // Decay and retrieval
  accessCount: number;
  lastAccessedAt: number;
  decayFactor: number;
}

export interface MemoryQuery {
  type?: MemoryType;
  tokenAddress?: string;
  timeRange?: { start: number; end: number };
  minImportance?: MemoryImportance;
  limit?: number;
}
