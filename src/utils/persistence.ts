/**
 * Persistence utilities
 * Simple JSON-based storage before database integration
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';

export class JsonStore {
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  /**
   * Ensure storage directory exists
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.dir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create storage directory', { error });
      throw error;
    }
  }

  /**
   * Write data to JSON file
   */
  async write<T>(filename: string, data: T): Promise<void> {
    const filepath = path.join(this.dir, filename);

    try {
      const json = JSON.stringify(data, this.replacer, 2);
      await fs.writeFile(filepath, json, 'utf-8');
    } catch (error) {
      logger.error(`Failed to write ${filename}`, { error });
      throw error;
    }
  }

  /**
   * Read data from JSON file
   */
  async read<T>(filename: string): Promise<T | null> {
    const filepath = path.join(this.dir, filename);

    try {
      const json = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(json, this.reviver) as T;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      logger.error(`Failed to read ${filename}`, { error });
      throw error;
    }
  }

  /**
   * Append line to JSONL file
   */
  async append(filename: string, data: unknown): Promise<void> {
    const filepath = path.join(this.dir, filename);

    try {
      const line = JSON.stringify(data, this.replacer) + '\n';
      await fs.appendFile(filepath, line, 'utf-8');
    } catch (error) {
      logger.error(`Failed to append to ${filename}`, { error });
      throw error;
    }
  }

  /**
   * Read all lines from JSONL file
   */
  async readLines<T>(filename: string): Promise<T[]> {
    const filepath = path.join(this.dir, filename);

    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      return lines.map(line => JSON.parse(line, this.reviver) as T);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []; // File doesn't exist
      }
      logger.error(`Failed to read lines from ${filename}`, { error });
      throw error;
    }
  }

  /**
   * List all files in directory
   */
  async list(): Promise<string[]> {
    try {
      return await fs.readdir(this.dir);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error('Failed to list files', { error });
      throw error;
    }
  }

  /**
   * Delete file
   */
  async delete(filename: string): Promise<void> {
    const filepath = path.join(this.dir, filename);

    try {
      await fs.unlink(filepath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return; // Already deleted
      }
      logger.error(`Failed to delete ${filename}`, { error });
      throw error;
    }
  }

  /**
   * Custom replacer for JSON.stringify to handle Maps
   */
  private replacer(key: string, value: unknown): unknown {
    if (value instanceof Map) {
      return {
        __type: 'Map',
        value: Array.from(value.entries())
      };
    }
    return value;
  }

  /**
   * Custom reviver for JSON.parse to handle Maps
   */
  private reviver(key: string, value: unknown): unknown {
    if (typeof value === 'object' && value !== null) {
      const obj = value as { __type?: string; value?: unknown };
      if (obj.__type === 'Map') {
        return new Map(obj.value as [unknown, unknown][]);
      }
    }
    return value;
  }
}

/**
 * Create directory structure
 */
export async function ensureDirectories(baseDir: string): Promise<void> {
  const dirs = [
    baseDir,
    path.join(baseDir, 'memory'),
    path.join(baseDir, 'logs'),
    path.join(baseDir, 'state')
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  logger.info('Data directories created', { baseDir });
}
