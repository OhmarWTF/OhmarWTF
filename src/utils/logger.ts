/**
 * Structured logging with Winston
 * Logs both to console and file with different levels
 */

import winston from 'winston';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || 'data/logs';

// Custom format for cleaner output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console output
    new winston.transports.Console({
      format: consoleFormat
    }),
    // File output - all logs
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'agent.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    // File output - errors only
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'errors.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

// Structured log methods for specific events
export const log = {
  cycle: (cycle: number) => {
    logger.info('Cycle start', { cycle });
  },

  event: (event: { type: string; source: string; [key: string]: unknown }) => {
    logger.debug('Event', event);
  },

  signal: (signal: { type: string; confidence: number; [key: string]: unknown }) => {
    logger.info('Signal', signal);
  },

  state: (state: { mood: string; confidence: number; riskAppetite: number }) => {
    logger.debug('State update', state);
  },

  intent: (intent: { type: string; reason: string; [key: string]: unknown }) => {
    logger.info('Intent formed', intent);
  },

  trade: (trade: { status: string; symbol?: string; [key: string]: unknown }) => {
    logger.info('Trade', trade);
  },

  tweet: (mode: string, text: string) => {
    logger.info('Tweet', { mode, text });
  },

  error: (context: string, error: Error | unknown) => {
    logger.error(context, { error: error instanceof Error ? error.message : String(error) });
  },

  memory: (action: string, details: unknown) => {
    logger.debug('Memory', { action, details });
  }
};
