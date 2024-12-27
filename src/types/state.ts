/**
 * AgentState - the agent's psychological and operational state
 * Updated continuously based on outcomes and conditions
 */

export enum Mood {
  CAUTIOUS = 'cautious',
  CONFIDENT = 'confident',
  AGGRESSIVE = 'aggressive',
  SUSPICIOUS = 'suspicious',
  REGRETFUL = 'regretful',
  FATIGUED = 'fatigued',
  OBSESSED = 'obsessed',
  NEUTRAL = 'neutral'
}

export enum OperationalMode {
  ACTIVE = 'active',
  OBSERVING = 'observing',
  SAFE_MODE = 'safe_mode',
  PAUSED = 'paused',
  FROZEN = 'frozen'
}

export interface AgentState {
  timestamp: number;

  // Psychological parameters (0-1)
  confidence: number;
  suspicion: number;
  conviction: number;
  fatigue: number;
  aggression: number;
  regret: number;

  // Derived mood
  primaryMood: Mood;
  secondaryMood?: Mood;

  // Risk appetite (0-1)
  riskAppetite: number;

  // Operational
  mode: OperationalMode;

  // Recent context
  recentWinStreak: number;
  recentLossStreak: number;
  lastTradeTimestamp?: number;
  daysSinceLastTrade: number;

  // Conviction about specific tokens
  tokenConvictions: Map<string, number>; // address -> conviction (0-1)

  // Internal notes
  internalMonologue?: string;
}
