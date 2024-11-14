/**
 * ohmarwtf - Autonomous AI Agent
 * Entry point
 */

import { loadConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { ensureDirectories } from './utils/persistence.js';
import { Orchestrator } from './orchestrator.js';

async function main() {
  try {
    // Load configuration
    const config = loadConfig();

    logger.info('ohmarwtf v1.0 starting...', {
      env: config.env,
      twitterEnabled: config.twitter.enabled
    });

    // Ensure data directories exist
    await ensureDirectories(config.dataDir);

    // Create orchestrator
    const orchestrator = new Orchestrator(config);

    // Initialize
    await orchestrator.initialize();

    // Handle shutdown signals
    const shutdown = async () => {
      logger.info('Shutdown signal received');
      await orchestrator.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Start the agent
    await orchestrator.start();

  } catch (error) {
    logger.error('Fatal error', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

main();
