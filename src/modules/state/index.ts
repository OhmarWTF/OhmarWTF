/**
 * State Layer
 * Maintains agent's psychological state and risk appetite
 */

import { AgentState, TradeResult, Mood, OperationalMode } from '../../types/index.js';

export interface StateConfig {
  baseRiskAppetite: number;
  moodUpdateIntervalMs: number;
}

export interface IStateLayer {
  /**
   * Get current agent state
   */
  getState(): AgentState;

  /**
   * Update state based on trade outcomes
   */
  updateFromTrade(trade: TradeResult): void;

  /**
   * Update state based on time and conditions
   */
  tick(): void;

  /**
   * Manually adjust operational mode
   */
  setMode(mode: OperationalMode): void;
}

export class StateLayer implements IStateLayer {
  private state: AgentState;
  private config: StateConfig;

  constructor(config: StateConfig) {
    this.config = config;

    // Initialize with neutral state
    this.state = {
      timestamp: Date.now(),
      confidence: 0.5,
      suspicion: 0.5,
      conviction: 0.5,
      fatigue: 0,
      aggression: 0.3,
      regret: 0,
      primaryMood: Mood.NEUTRAL,
      riskAppetite: config.baseRiskAppetite,
      mode: OperationalMode.OBSERVING,
      recentWinStreak: 0,
      recentLossStreak: 0,
      daysSinceLastTrade: 0,
      tokenConvictions: new Map()
    };
  }

  getState(): AgentState {
    return { ...this.state };
  }

  updateFromTrade(trade: TradeResult): void {
    const isWin = trade.status === 'filled' && (trade.filledAmount || 0) > 0;
    const isLoss = trade.status === 'failed' || trade.error;

    if (isWin) {
      this.state.confidence = Math.min(0.95, this.state.confidence + 0.08);
      this.state.regret = Math.max(0, this.state.regret - 0.05);
      this.state.conviction = Math.min(0.95, this.state.conviction + 0.06);
      this.state.recentWinStreak++;
      this.state.recentLossStreak = 0;
      this.state.riskAppetite = Math.min(0.9, this.state.riskAppetite + 0.03);
    } else if (isLoss) {
      this.state.confidence = Math.max(0.1, this.state.confidence - 0.12);
      this.state.regret = Math.min(0.9, this.state.regret + 0.15);
      this.state.suspicion = Math.min(0.9, this.state.suspicion + 0.1);
      this.state.recentLossStreak++;
      this.state.recentWinStreak = 0;
      this.state.riskAppetite = Math.max(0.1, this.state.riskAppetite - 0.08);
    }

    // Update mood based on new parameters
    this.updateMood();

    this.state.lastTradeTimestamp = trade.timestamp;
    this.state.timestamp = Date.now();
  }

  tick(): void {
    const now = Date.now();

    // Update days since last trade
    if (this.state.lastTradeTimestamp) {
      const daysSince = (now - this.state.lastTradeTimestamp) / (1000 * 60 * 60 * 24);
      this.state.daysSinceLastTrade = daysSince;

      // Fatigue increases without activity
      if (daysSince > 2) {
        this.state.fatigue = Math.min(0.9, this.state.fatigue + 0.02);
      }
    }

    // Natural decay of extreme emotions
    this.state.regret *= 0.98;
    this.state.suspicion *= 0.99;
    this.state.aggression *= 0.97;

    // Confidence slowly returns to baseline
    const baseline = 0.5;
    this.state.confidence += (baseline - this.state.confidence) * 0.05;

    // Conviction decays without reinforcement
    this.state.conviction *= 0.95;

    // Update mood
    this.updateMood();

    this.state.timestamp = now;
  }

  setMode(mode: OperationalMode): void {
    this.state.mode = mode;
    this.state.timestamp = Date.now();
  }

  /**
   * Calculate mood from psychological parameters
   */
  private updateMood(): void {
    const s = this.state;

    // Determine primary mood based on dominant parameters
    if (s.regret > 0.6) {
      s.primaryMood = Mood.REGRETFUL;
    } else if (s.fatigue > 0.7) {
      s.primaryMood = Mood.FATIGUED;
    } else if (s.suspicion > 0.6) {
      s.primaryMood = Mood.SUSPICIOUS;
    } else if (s.confidence > 0.7 && s.conviction > 0.6) {
      s.primaryMood = Mood.CONFIDENT;
    } else if (s.aggression > 0.6 && s.confidence > 0.5) {
      s.primaryMood = Mood.AGGRESSIVE;
    } else if (s.conviction > 0.7) {
      s.primaryMood = Mood.OBSESSED;
    } else if (s.confidence < 0.4) {
      s.primaryMood = Mood.CAUTIOUS;
    } else {
      s.primaryMood = Mood.NEUTRAL;
    }

    // Determine secondary mood
    const params = [
      { mood: Mood.REGRETFUL, value: s.regret },
      { mood: Mood.SUSPICIOUS, value: s.suspicion },
      { mood: Mood.CAUTIOUS, value: s.confidence < 0.5 ? 0.8 : 0 },
      { mood: Mood.FATIGUED, value: s.fatigue }
    ];

    const sorted = params
      .filter(p => p.mood !== s.primaryMood)
      .sort((a, b) => b.value - a.value);

    if (sorted.length > 0 && sorted[0].value > 0.4) {
      s.secondaryMood = sorted[0].mood;
    } else {
      s.secondaryMood = undefined;
    }
  }

  /**
   * Adjust conviction for a specific token
   */
  adjustTokenConviction(tokenAddress: string, delta: number): void {
    const current = this.state.tokenConvictions.get(tokenAddress) || 0.5;
    const newConviction = Math.max(0, Math.min(1, current + delta));
    this.state.tokenConvictions.set(tokenAddress, newConviction);
    this.state.timestamp = Date.now();
  }

  /**
   * Set internal monologue
   */
  setMonologue(thought: string): void {
    this.state.internalMonologue = thought;
    this.state.timestamp = Date.now();
  }
}
