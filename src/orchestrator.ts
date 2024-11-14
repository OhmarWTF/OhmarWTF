/**
 * Orchestrator - The main loop
 * Coordinates all modules and manages the agent lifecycle
 */

import { Config } from './config/index.js';
import { logger, log } from './utils/logger.js';
import { PerceptionLayer } from './modules/perception/index.js';
import { SignalLayer } from './modules/signals/index.js';
import { StateLayer } from './modules/state/index.js';
import { DecisionEngine } from './modules/decision/index.js';
import { RiskGuardrails } from './modules/risk/index.js';
import { ExecutionLayer } from './modules/execution/index.js';
import { MemorySystem } from './modules/memory/index.js';
import { ExpressionLayer, TweetMode } from './modules/expression/index.js';
import { Event, Position, OperationalMode } from './types/index.js';

export class Orchestrator {
  private config: Config;
  private running: boolean = false;
  private cycle: number = 0;

  // Modules
  private perception: PerceptionLayer;
  private signals: SignalLayer;
  private state: StateLayer;
  private decision: DecisionEngine;
  private risk: RiskGuardrails;
  private execution: ExecutionLayer;
  private memory: MemorySystem;
  private expression: ExpressionLayer;

  // State
  private positions: Position[] = [];
  private capital: number = 0;

  // Timing
  private lastPerceptionPoll: number = 0;
  private lastStateSave: number = 0;

  constructor(config: Config) {
    this.config = config;

    // Initialize modules
    this.perception = new PerceptionLayer({
      solanaRpcUrl: config.solana.rpcUrl,
      twitterEnabled: config.twitter.enabled,
      pollIntervalMs: config.perception.pollIntervalMs
    });

    this.signals = new SignalLayer({
      windowSizeMs: config.signals.windowSizeMs,
      decayHalfLifeMs: config.signals.decayHalfLifeMs,
      minConfidence: config.signals.minConfidence
    });

    this.state = new StateLayer({
      baseRiskAppetite: config.state.baseRiskAppetite,
      moodUpdateIntervalMs: config.state.moodUpdateIntervalMs
    });

    this.decision = new DecisionEngine({
      intentCooldownMs: config.decision.intentCooldownMs,
      minSignalConfidence: config.decision.minSignalConfidence,
      probabilisticThresholds: config.decision.probabilisticThresholds
    });

    this.risk = new RiskGuardrails({
      maxPositionSizePct: config.risk.maxPositionSizePct,
      maxDailyLossPct: config.risk.maxDailyLossPct,
      maxTotalExposurePct: config.risk.maxTotalExposurePct,
      minCapitalReserve: config.risk.minCapitalReserve,
      dailyTradeLimit: config.risk.dailyTradeLimit
    });

    this.execution = new ExecutionLayer({
      walletPrivateKey: config.solana.walletPrivateKey || '',
      solanaRpcUrl: config.solana.rpcUrl,
      maxSlippagePct: config.execution.maxSlippagePct,
      dexProgramId: config.execution.dexProgramId
    });

    this.memory = new MemorySystem({
      shortTermWindowMs: config.memory.shortTermWindowMs,
      maxShortTermEntries: config.memory.maxShortTermEntries,
      persistenceDir: config.memory.persistenceDir
    });

    this.expression = new ExpressionLayer({
      twitterEnabled: config.twitter.enabled,
      twitterApiKey: config.twitter.apiKey,
      twitterApiSecret: config.twitter.apiSecret,
      twitterAccessToken: config.twitter.accessToken,
      twitterAccessSecret: config.twitter.accessSecret,
      minTweetIntervalMs: config.expression.minTweetIntervalMs,
      maxDailyTweets: config.expression.maxDailyTweets
    });
  }

  /**
   * Initialize all modules
   */
  async initialize(): Promise<void> {
    logger.info('Initializing ohmarwtf agent...');

    try {
      await this.perception.initialize();
      await this.execution.initialize();
      await this.expression.initialize();
      await this.memory.load();

      // Get initial capital
      this.capital = await this.execution.getBalance();
      logger.info(`Initial capital: ${this.capital} SOL`);

      logger.info('Agent initialized successfully');
    } catch (error) {
      log.error('Initialization failed', error);
      throw error;
    }
  }

  /**
   * Start the main loop
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Agent already running');
      return;
    }

    this.running = true;
    logger.info('Agent started');

    // Initial state setup
    this.state.setMode(OperationalMode.OBSERVING);

    // Main loop
    while (this.running) {
      try {
        await this.tick();
        await this.sleep(this.config.orchestrator.tickIntervalMs);
      } catch (error) {
        log.error('Tick error', error);
        // Continue running despite errors
      }
    }
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    logger.info('Stopping agent...');
    this.running = false;

    // Persist state
    await this.memory.persist();

    // Cleanup
    await this.perception.shutdown();
    await this.execution.shutdown();

    logger.info('Agent stopped');
  }

  /**
   * One cycle of the main loop
   */
  private async tick(): Promise<void> {
    this.cycle++;
    log.cycle(this.cycle);

    const now = Date.now();

    // 1. Perception - poll for events
    let newEvents: Event[] = [];
    if (now - this.lastPerceptionPoll >= this.config.orchestrator.perceptionPollMs) {
      newEvents = await this.perception.poll();
      this.lastPerceptionPoll = now;

      if (newEvents.length > 0) {
        logger.debug(`Perceived ${newEvents.length} events`);
      }
    }

    // 2. Signals - process events and update signals
    if (newEvents.length > 0) {
      const newSignals = this.signals.processEvents(newEvents);
      newSignals.forEach(signal => log.signal({
        type: signal.type,
        confidence: signal.confidence,
        token: signal.tokenSymbol
      }));
    }

    const activeSignals = this.signals.updateSignals();

    // 3. State - update agent state
    this.state.tick();
    const agentState = this.state.getState();

    log.state({
      mood: agentState.primaryMood,
      confidence: agentState.confidence,
      riskAppetite: agentState.riskAppetite
    });

    // 4. Decision - form intent
    const intent = this.decision.decide(activeSignals, agentState, this.positions);

    if (intent) {
      log.intent({
        type: intent.type,
        reason: intent.primaryReason,
        token: intent.tokenSymbol
      });

      // 5. Risk - check intent
      const riskCheck = this.risk.checkIntent(intent, this.positions, this.capital);

      if (riskCheck.approved) {
        intent.riskApproved = true;

        // Apply size adjustment if needed
        if (riskCheck.adjustedSizePct) {
          intent.sizePct = riskCheck.adjustedSizePct;
        }

        // 6. Execution - execute if not WAIT or WATCH
        if (intent.type !== 'wait' && intent.type !== 'watch') {
          const tweet = this.expression.compose(TweetMode.PRE_TRADE, {
            state: agentState,
            intent,
            signals: activeSignals
          });

          if (tweet) {
            await this.expression.post(tweet);
          }

          const tradeResult = await this.execution.execute(intent);

          // 7. Memory - record trade
          this.memory.recordTrade(tradeResult);
          this.risk.recordTrade(tradeResult);

          // Update state from trade outcome
          this.state.updateFromTrade(tradeResult);

          // Post trade tweet
          const postTradeTweet = this.expression.compose(TweetMode.POST_MORTEM, {
            state: this.state.getState(),
            trade: tradeResult
          });

          if (postTradeTweet) {
            await this.expression.post(postTradeTweet);
          }

          log.trade({
            status: tradeResult.status,
            symbol: tradeResult.tokenSymbol,
            direction: tradeResult.direction
          });
        }
      } else {
        intent.riskApproved = false;
        intent.riskBlockReason = riskCheck.reason;
        logger.warn(`Intent blocked by risk: ${riskCheck.reason}`);
      }
    }

    // 8. Ambient expression - occasionally tweet observations
    if (Math.random() < 0.05 && this.expression.canTweet()) { // 5% chance per tick
      const ambientTweet = this.expression.compose(TweetMode.AMBIENT, {
        state: agentState,
        signals: activeSignals
      });

      if (ambientTweet) {
        await this.expression.post(ambientTweet);
      }
    }

    // 9. Persist state periodically
    if (now - this.lastStateSave >= this.config.orchestrator.stateSaveIntervalMs) {
      await this.memory.persist();
      this.lastStateSave = now;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
