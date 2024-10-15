# ohmarwtf

> An autonomous AI agent that lives inside Solana meme coin markets

## What is this?

ohmarwtf is not a trading bot. It's an autonomous agent that:

- **Watches** markets and social signals
- **Decides** what to do based on internal conviction
- **Acts** independently by trading on Solana DEXs
- **Remembers** outcomes and learns from them
- **Expresses** its thoughts publicly on Twitter

The goal is not profit optimization alone. The goal is to create something that feels alive.

## Core Principles

- **Autonomy first** - No human in the loop during execution
- **Emergent behavior** - Decisions emerge from state, not hard rules
- **Public persona** - Internal state is reflected in tweets
- **Continuous evolution** - Behavior adapts based on lived outcomes

## Architecture

The agent consists of 9 core modules working in a continuous loop:

```
Perception → Signals → State → Decision → Risk → Execution
                ↓                                    ↓
            Expression ← ← ← ← ← ← ← ← ← ← ← ← Memory
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete system design.

## Project Status

**Current Phase**: Phase 1 Complete ✅

- ✅ **Phase 0**: Foundation - TypeScript project structure, module skeletons
- ✅ **Phase 1**: Perception MVP - Solana RPC, market data, event generation

**Capabilities**:
- Real-time Solana token monitoring (BONK, WIF)
- Market data from DexScreener (prices, volume, liquidity)
- Event generation and persistence to disk
- Heartbeat monitoring and health checks

**Next Phase**: Phase 2 - Signals and State (pattern detection and personality)

See [ROADMAP.md](./ROADMAP.md) for implementation plan.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Solana wallet (for live trading)
- Twitter API credentials (optional)

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Configuration

Required for basic operation:
- `SOLANA_RPC_URL` - Solana RPC endpoint
- `DATA_DIR` - Where to store logs and state

Required for live trading:
- `WALLET_PRIVATE_KEY` - Solana wallet private key (keep secret!)

Optional:
- Twitter API credentials (for public expression)
- Risk limits (defaults are conservative)
- Timing parameters (defaults work for most cases)

See `.env.example` for full list.

### Running

Development mode (with hot reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

### What to Expect

The agent currently:
- Connects to Solana mainnet RPC
- Tracks BONK and WIF tokens (configurable)
- Fetches real-time prices from DexScreener
- Generates events (heartbeat, price changes, volume spikes)
- Persists events to `data/events/events_YYYY-MM-DD.jsonl`
- Logs to console and `data/logs/agent.log`
- Does NOT trade yet (execution layer is stubbed)
- Does NOT tweet yet (expression logs locally)

As you implement remaining phases, autonomous trading and tweeting will activate.

## Project Structure

```
ohmarwtf/
├── src/
│   ├── types/              # Shared data schemas
│   ├── modules/
│   │   ├── perception/     # Market and social data ingestion
│   │   ├── signals/        # Pattern detection and scoring
│   │   ├── state/          # Agent psychological state
│   │   ├── decision/       # Intent formation
│   │   ├── risk/           # Guardrails and limits
│   │   ├── execution/      # DEX trading
│   │   ├── memory/         # Experience storage
│   │   └── expression/     # Tweet generation
│   ├── utils/              # Logging, persistence
│   ├── config/             # Configuration
│   ├── orchestrator.ts     # Main loop
│   └── index.ts            # Entry point
├── data/                   # Runtime data (gitignored)
│   ├── logs/
│   ├── memory/
│   └── state/
├── ARCHITECTURE.md         # System design
├── ROADMAP.md             # Implementation phases
└── README.md              # This file
```

## Development

### Build

```bash
npm run build
```

Output in `dist/`

### Lint

```bash
npm run lint
```

### Clean

```bash
npm run clean
```

## Safety

This agent trades with real money. Safety mechanisms:

1. **Hard risk limits** - Max position size, daily loss, total exposure
2. **Safe mode** - Triggered automatically on loss threshold
3. **Kill switch** - `Ctrl+C` or `SIGTERM` stops immediately
4. **Paper trading** - Phase 3 simulates trades before going live
5. **Conservative defaults** - Start small, scale cautiously

**IMPORTANT**:
- Start with minimal capital (0.1-0.5 SOL)
- Test thoroughly in paper mode first
- Monitor constantly during initial runs
- Never share private keys

## Roadmap

- [x] **Phase 0**: Foundation - Runnable skeleton ✅
- [x] **Phase 1**: Perception - Read Solana markets ✅
- [ ] **Phase 2**: Signals & State - Pattern detection and personality
- [ ] **Phase 3**: Decision - Paper trading with simulated fills
- [ ] **Phase 4**: Execution - Real trades with guardrails
- [ ] **Phase 5**: Personality - Narrative continuity and learning
- [ ] **Phase 6**: Dashboard - Web-based monitoring

See [ROADMAP.md](./ROADMAP.md) for details.

## Contributing

This is an experimental autonomous agent. Contributions welcome:

- Implement roadmap phases
- Add new signal detectors
- Improve decision logic
- Enhance expression variety
- Fix bugs, improve logging

Open an issue or PR.

## License

ISC

## Disclaimer

This is experimental software. It trades with real money based on autonomous decisions. Use at your own risk. Not financial advice.

The agent's tweets are its own thoughts, not recommendations.

---

**ohmarwtf** - watching, deciding, acting, remembering
