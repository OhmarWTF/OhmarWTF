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
    // TODO: Adjust confidence, regret based on outcome
    // TODO: Update win/loss streaks
    // TODO: Adjust risk appetite
    // TODO: Update mood

    this.state.lastTradeTimestamp = trade.timestamp;
    this.state.timestamp = Date.now();
  }

  tick(): void {
    const now = Date.now();

    // Update days since last trade
    if (this.state.lastTradeTimestamp) {
      const daysSince = (now - this.state.lastTradeTimestamp) / (1000 * 60 * 60 * 24);
      this.state.daysSinceLastTrade = daysSince;
    }

    // TODO: Natural decay of emotions over time
    // TODO: Fatigue increases without wins
    // TODO: Recalculate mood

    this.state.timestamp = now;
  }

  setMode(mode: OperationalMode): void {
    this.state.mode = mode;
    this.state.timestamp = Date.now();
  }
}
