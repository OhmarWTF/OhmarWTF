/**
 * Decision Engine
 * Generates intents based on signals and state
 */

import { Signal, AgentState, Intent, IntentType, Position } from '../../types/index.js';

export interface DecisionConfig {
  intentCooldownMs: number;
  minSignalConfidence: number;
  probabilisticThresholds: boolean;
}

export interface IDecisionEngine {
  /**
   * Decide what to do given current signals and state
   */
  decide(signals: Signal[], state: AgentState, positions: Position[]): Intent | null;

  /**
   * Check if enough time has passed since last intent
   */
  canDecide(): boolean;
}

export class DecisionEngine implements IDecisionEngine {
  private config: DecisionConfig;
  private lastIntentTime: number = 0;

  constructor(config: DecisionConfig) {
    this.config = config;
  }

  decide(signals: Signal[], state: AgentState, positions: Position[]): Intent | null {
    if (!this.canDecide()) {
      return null;
    }

    // Filter signals by confidence
    const validSignals = signals.filter(
      s => s.confidence >= this.config.minSignalConfidence
    );

    if (validSignals.length === 0) {
      return null;
    }

    // TODO: Analyze signals in context of state
    // TODO: Consider existing positions
    // TODO: Apply probabilistic thresholds
    // TODO: Generate intent with reasoning

    // Placeholder
    const intent: Intent = {
      id: `intent_${Date.now()}`,
      timestamp: Date.now(),
      type: IntentType.WAIT,
      primaryReason: 'Waiting for clearer signals',
      supportingSignals: [],
      stateSnapshot: {
        mood: state.primaryMood,
        confidence: state.confidence,
        riskAppetite: state.riskAppetite
      },
      alternatives: [],
      probabilityThreshold: 0.5
    };

    this.lastIntentTime = Date.now();
    return intent;
  }

  canDecide(): boolean {
    const elapsed = Date.now() - this.lastIntentTime;
    return elapsed >= this.config.intentCooldownMs;
  }
}
