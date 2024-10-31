/**
 * Configuration management
 * Loads from environment and provides typed config objects
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface Config {
  env: 'development' | 'production';
  dataDir: string;

  // Solana
  solana: {
    rpcUrl: string;
    wsUrl?: string;
    walletPrivateKey?: string;
  };

  // Twitter
  twitter: {
    enabled: boolean;
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    accessSecret?: string;
  };

  // Orchestrator
  orchestrator: {
    tickIntervalMs: number;
    perceptionPollMs: number;
    stateSaveIntervalMs: number;
  };

  // Perception
  perception: {
    pollIntervalMs: number;
  };

  // Signals
  signals: {
    windowSizeMs: number;
    decayHalfLifeMs: number;
    minConfidence: number;
  };

  // State
  state: {
    baseRiskAppetite: number;
    moodUpdateIntervalMs: number;
  };

  // Decision
  decision: {
    intentCooldownMs: number;
    minSignalConfidence: number;
    probabilisticThresholds: boolean;
  };

  // Risk
  risk: {
    maxPositionSizePct: number;
    maxDailyLossPct: number;
    maxTotalExposurePct: number;
    minCapitalReserve: number;
    dailyTradeLimit?: number;
  };

  // Execution
  execution: {
    maxSlippagePct: number;
    dexProgramId: string;
  };

  // Memory
  memory: {
    shortTermWindowMs: number;
    maxShortTermEntries: number;
    persistenceDir: string;
  };

  // Expression
  expression: {
    minTweetIntervalMs: number;
    maxDailyTweets: number;
  };
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue!;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for ${key}: ${value}`);
  }
  return parsed;
}

function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

export function loadConfig(): Config {
  const dataDir = getEnv('DATA_DIR', 'data');

  return {
    env: (getEnv('NODE_ENV', 'development') as 'development' | 'production'),
    dataDir,

    solana: {
      rpcUrl: getEnv('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com'),
      wsUrl: process.env.SOLANA_WS_URL,
      walletPrivateKey: process.env.WALLET_PRIVATE_KEY
    },

    twitter: {
      enabled: getEnvBool('TWITTER_ENABLED', false),
      apiKey: process.env.TWITTER_API_KEY,
      apiSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET
    },

    orchestrator: {
      tickIntervalMs: getEnvNumber('TICK_INTERVAL_MS', 10000), // 10s default
      perceptionPollMs: getEnvNumber('PERCEPTION_POLL_MS', 30000), // 30s default
      stateSaveIntervalMs: getEnvNumber('STATE_SAVE_INTERVAL_MS', 60000) // 1min default
    },

    perception: {
      pollIntervalMs: getEnvNumber('PERCEPTION_POLL_MS', 30000)
    },

    signals: {
      windowSizeMs: getEnvNumber('SIGNAL_WINDOW_MS', 3600000), // 1 hour
      decayHalfLifeMs: getEnvNumber('SIGNAL_DECAY_MS', 1800000), // 30 min
      minConfidence: getEnvNumber('MIN_SIGNAL_CONFIDENCE', 0.3)
    },

    state: {
      baseRiskAppetite: getEnvNumber('BASE_RISK_APPETITE', 0.4),
      moodUpdateIntervalMs: getEnvNumber('MOOD_UPDATE_MS', 300000) // 5 min
    },

    decision: {
      intentCooldownMs: getEnvNumber('INTENT_COOLDOWN_MS', 60000), // 1 min
      minSignalConfidence: getEnvNumber('MIN_DECISION_CONFIDENCE', 0.5),
      probabilisticThresholds: getEnvBool('PROBABILISTIC_THRESHOLDS', true)
    },

    risk: {
      maxPositionSizePct: getEnvNumber('MAX_POSITION_SIZE_PCT', 10),
      maxDailyLossPct: getEnvNumber('MAX_DAILY_LOSS_PCT', 20),
      maxTotalExposurePct: getEnvNumber('MAX_TOTAL_EXPOSURE_PCT', 50),
      minCapitalReserve: getEnvNumber('MIN_CAPITAL_RESERVE', 0.5),
      dailyTradeLimit: process.env.DAILY_TRADE_LIMIT
        ? getEnvNumber('DAILY_TRADE_LIMIT', 0)
        : undefined
    },

    execution: {
      maxSlippagePct: getEnvNumber('MAX_SLIPPAGE_PCT', 5),
      dexProgramId: getEnv('DEX_PROGRAM_ID', '')
    },

    memory: {
      shortTermWindowMs: getEnvNumber('SHORT_TERM_MEMORY_MS', 86400000), // 24 hours
      maxShortTermEntries: getEnvNumber('MAX_SHORT_TERM_ENTRIES', 100),
      persistenceDir: path.join(dataDir, 'memory')
    },

    expression: {
      minTweetIntervalMs: getEnvNumber('MIN_TWEET_INTERVAL_MS', 1800000), // 30 min
      maxDailyTweets: getEnvNumber('MAX_DAILY_TWEETS', 20)
    }
  };
}
