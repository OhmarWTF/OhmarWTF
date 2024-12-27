/**
 * Operator Dashboard Server
 * Web interface for monitoring agent state and controlling operations
 */

import express, { Request, Response } from 'express';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { AgentState, Position, TradeResult, Signal, Event, MemoryEntry } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DashboardConfig {
  port: number;
  enabled: boolean;
}

export interface DashboardData {
  state: AgentState | null;
  positions: Position[];
  recentTrades: TradeResult[];
  signals: Signal[];
  recentEvents: Event[];
  recentMemories: MemoryEntry[];
  capital: number;
  totalPnL: number;
  dailyPnL: number;
  safeMode: boolean;
  tradingPaused: boolean;
}

export class DashboardServer {
  private config: DashboardConfig;
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  // Data store (updated by orchestrator)
  private data: DashboardData = {
    state: null,
    positions: [],
    recentTrades: [],
    signals: [],
    recentEvents: [],
    recentMemories: [],
    capital: 0,
    totalPnL: 0,
    dailyPnL: 0,
    safeMode: false,
    tradingPaused: false
  };

  // Control callbacks
  private onPauseCallback?: () => void;
  private onResumeCallback?: () => void;
  private onSafeModeCallback?: (enabled: boolean) => void;

  constructor(config: DashboardConfig) {
    this.config = config;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Get current state
    this.app.get('/api/state', (_req: Request, res: Response) => {
      res.json(this.data.state);
    });

    // Get positions
    this.app.get('/api/positions', (_req: Request, res: Response) => {
      res.json(this.data.positions);
    });

    // Get recent trades
    this.app.get('/api/trades', (_req: Request, res: Response) => {
      res.json(this.data.recentTrades);
    });

    // Get signals
    this.app.get('/api/signals', (_req: Request, res: Response) => {
      res.json(this.data.signals);
    });

    // Get recent events
    this.app.get('/api/events', (_req: Request, res: Response) => {
      res.json(this.data.recentEvents);
    });

    // Get memories
    this.app.get('/api/memories', (_req: Request, res: Response) => {
      res.json(this.data.recentMemories);
    });

    // Get full dashboard data
    this.app.get('/api/dashboard', (_req: Request, res: Response) => {
      res.json(this.data);
    });

    // Control: Pause trading
    this.app.post('/api/control/pause', (_req: Request, res: Response) => {
      if (this.onPauseCallback) {
        this.onPauseCallback();
        this.data.tradingPaused = true;
        this.broadcast({ type: 'control', action: 'pause' });
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Pause callback not configured' });
      }
    });

    // Control: Resume trading
    this.app.post('/api/control/resume', (_req: Request, res: Response) => {
      if (this.onResumeCallback) {
        this.onResumeCallback();
        this.data.tradingPaused = false;
        this.broadcast({ type: 'control', action: 'resume' });
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Resume callback not configured' });
      }
    });

    // Control: Toggle safe mode
    this.app.post('/api/control/safemode', (req: Request, res: Response) => {
      const { enabled } = req.body;
      if (this.onSafeModeCallback) {
        this.onSafeModeCallback(enabled);
        this.data.safeMode = enabled;
        this.broadcast({ type: 'control', action: 'safemode', enabled });
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Safe mode callback not configured' });
      }
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.debug('Dashboard client connected');
      this.clients.add(ws);

      // Send initial data
      ws.send(JSON.stringify({ type: 'init', data: this.data }));

      ws.on('close', () => {
        logger.debug('Dashboard client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error: Error) => {
        logger.error('WebSocket error', { error: error.message });
        this.clients.delete(ws);
      });
    });
  }

  private broadcast(message: unknown): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Dashboard disabled');
      return;
    }

    return new Promise((resolve) => {
      this.server.listen(this.config.port, () => {
        logger.info(`Dashboard server running on http://localhost:${this.config.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Dashboard server stopped');
        resolve();
      });
    });
  }

  /**
   * Update dashboard data (called by orchestrator)
   */
  updateData(updates: Partial<DashboardData>): void {
    this.data = { ...this.data, ...updates };
    this.broadcast({ type: 'update', data: this.data });
  }

  /**
   * Set control callbacks
   */
  setControlCallbacks(callbacks: {
    onPause?: () => void;
    onResume?: () => void;
    onSafeMode?: (enabled: boolean) => void;
  }): void {
    this.onPauseCallback = callbacks.onPause;
    this.onResumeCallback = callbacks.onResume;
    this.onSafeModeCallback = callbacks.onSafeMode;
  }
}
