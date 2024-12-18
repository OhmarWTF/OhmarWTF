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
      // No signals - default to wait
      return this.createIntent(IntentType.WAIT, state, [], 'No strong signals detected');
    }

    // Group signals by token
    const signalsByToken = this.groupSignalsByToken(validSignals);

    // Check if we should exit any positions
    for (const position of positions) {
      const exitIntent = this.checkExitConditions(position, signalsByToken, state);
      if (exitIntent) {
        this.lastIntentTime = Date.now();
        return exitIntent;
      }
    }

    // Check if we should reduce positions
    for (const position of positions) {
      const reduceIntent = this.checkReduceConditions(position, signalsByToken, state);
      if (reduceIntent) {
        this.lastIntentTime = Date.now();
        return reduceIntent;
      }
    }

    // Check if we should enter new positions
    const enterIntent = this.checkEnterConditions(signalsByToken, positions, state);
    if (enterIntent) {
      this.lastIntentTime = Date.now();
      return enterIntent;
    }

    // Check if we should add to existing positions
    for (const position of positions) {
      const addIntent = this.checkAddConditions(position, signalsByToken, state);
      if (addIntent) {
        this.lastIntentTime = Date.now();
        return addIntent;
      }
    }

    // Default to wait
    this.lastIntentTime = Date.now();
    return this.createIntent(IntentType.WAIT, state, validSignals, 'Observing market conditions');
  }

  private groupSignalsByToken(signals: Signal[]): Map<string, Signal[]> {
    const grouped = new Map<string, Signal[]>();

    for (const signal of signals) {
      const key = signal.tokenAddress || 'general';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(signal);
    }

    return grouped;
  }

  private checkExitConditions(
    position: Position,
    signalsByToken: Map<string, Signal[]>,
    state: AgentState
  ): Intent | null {
    const signals = signalsByToken.get(position.tokenAddress) || [];

    // Exit on liquidity pull
    const liquidityPull = signals.find(s => s.type === 'liquidity_pull');
    if (liquidityPull && liquidityPull.urgency > 0.7) {
      return this.createIntent(
        IntentType.EXIT,
        state,
        [liquidityPull],
        'Liquidity drying up - exit now',
        position.tokenAddress,
        position.tokenSymbol,
        100
      );
    }

    // Exit on price exhaustion if in profit
    if (position.unrealizedPnLPct && position.unrealizedPnLPct > 10) {
      const exhaustion = signals.find(s => s.type === 'price_exhaustion');
      if (exhaustion) {
        return this.createIntent(
          IntentType.EXIT,
          state,
          [exhaustion],
          'Taking profit - momentum fading',
          position.tokenAddress,
          position.tokenSymbol,
          100
        );
      }
    }

    // Exit if conviction dropped significantly
    const tokenConviction = state.tokenConvictions.get(position.tokenAddress) || 0.5;
    if (tokenConviction < 0.3) {
      return this.createIntent(
        IntentType.EXIT,
        state,
        signals,
        'Lost conviction in this token',
        position.tokenAddress,
        position.tokenSymbol,
        100
      );
    }

    return null;
  }

  private checkReduceConditions(
    position: Position,
    signalsByToken: Map<string, Signal[]>,
    state: AgentState
  ): Intent | null {
    const signals = signalsByToken.get(position.tokenAddress) || [];

    // Reduce if suspicious and in profit
    if (state.primaryMood === 'suspicious' && position.unrealizedPnLPct && position.unrealizedPnLPct > 5) {
      return this.createIntent(
        IntentType.REDUCE,
        state,
        signals,
        'Feeling suspicious - taking some off',
        position.tokenAddress,
        position.tokenSymbol,
        50
      );
    }

    return null;
  }

  private checkEnterConditions(
    signalsByToken: Map<string, Signal[]>,
    positions: Position[],
    state: AgentState
  ): Intent | null {
    // Don't enter if cautious or regretful
    if (state.primaryMood === 'cautious' || state.primaryMood === 'regretful') {
      return null;
    }

    // Find strongest signal
    let strongest: Signal | null = null;
    let strongestScore = 0;

    for (const [tokenAddr, signals] of signalsByToken) {
      // Skip if already have position
      if (positions.some(p => p.tokenAddress === tokenAddr)) {
        continue;
      }

      for (const signal of signals) {
        const score = signal.confidence * signal.strength * signal.urgency;
        if (score > strongestScore) {
          strongestScore = score;
          strongest = signal;
        }
      }
    }

    if (!strongest) {
      return null;
    }

    // Probabilistic threshold based on state
    const baseThreshold = 0.4;
    const adjustedThreshold = baseThreshold * (2 - state.confidence);

    if (strongestScore < adjustedThreshold) {
      return null;
    }

    // Early momentum or volume surge are good entry signals
    if (strongest.type === 'early_momentum' || strongest.type === 'volume_surge') {
      const size = this.calculatePositionSize(state);

      return this.createIntent(
        IntentType.ENTER,
        state,
        [strongest],
        `${strongest.description} - entering position`,
        strongest.tokenAddress,
        strongest.tokenSymbol,
        size
      );
    }

    return null;
  }

  private checkAddConditions(
    position: Position,
    signalsByToken: Map<string, Signal[]>,
    state: AgentState
  ): Intent | null {
    const signals = signalsByToken.get(position.tokenAddress) || [];

    // Only add if confident or aggressive
    if (state.confidence < 0.6 && state.primaryMood !== 'aggressive') {
      return null;
    }

    // Look for reinforcing signals
    const volumeSurge = signals.find(s => s.type === 'volume_surge');
    if (volumeSurge && volumeSurge.confidence > 0.7) {
      return this.createIntent(
        IntentType.ADD,
        state,
        [volumeSurge],
        'Volume confirming - adding to position',
        position.tokenAddress,
        position.tokenSymbol,
        25
      );
    }

    return null;
  }

  private calculatePositionSize(state: AgentState): number {
    // Base size influenced by risk appetite and confidence
    const baseSize = 10;
    const riskMultiplier = state.riskAppetite;
    const confidenceMultiplier = state.confidence;

    return Math.min(20, baseSize * riskMultiplier * confidenceMultiplier);
  }

  private createIntent(
    type: IntentType,
    state: AgentState,
    signals: Signal[],
    reason: string,
    tokenAddress?: string,
    tokenSymbol?: string,
    sizePct?: number
  ): Intent {
    return {
      id: `intent_${Date.now()}`,
      timestamp: Date.now(),
      type,
      tokenAddress,
      tokenSymbol,
      sizePct,
      primaryReason: reason,
      supportingSignals: signals.map(s => s.id),
      stateSnapshot: {
        mood: state.primaryMood,
        confidence: state.confidence,
        riskAppetite: state.riskAppetite
      },
      alternatives: this.generateAlternatives(type, state),
      probabilityThreshold: 0.5
    };
  }

  private generateAlternatives(type: IntentType, state: AgentState): string[] {
    const alternatives: string[] = [];

    switch (type) {
      case IntentType.ENTER:
        alternatives.push('wait for more confirmation', 'watch from sidelines');
        break;
      case IntentType.EXIT:
        alternatives.push('reduce instead of full exit', 'hold and wait');
        break;
      case IntentType.WAIT:
        alternatives.push('force entry on weak signal', 'go dormant');
        break;
    }

    return alternatives;
  }

  canDecide(): boolean {
    const elapsed = Date.now() - this.lastIntentTime;
    return elapsed >= this.config.intentCooldownMs;
  }
}
