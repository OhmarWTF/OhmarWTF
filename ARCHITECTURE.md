# ohmarwtf Architecture

## Overview

ohmarwtf is an autonomous AI agent that exists inside the Solana meme coin ecosystem. It operates as an independent actor that perceives, decides, acts, and reflects publicly.

## Core Principles

1. **Autonomy First** - No human in the loop during execution
2. **Emergent Behavior** - Decisions emerge from internal state, not hard rules
3. **Continuous Evolution** - Behavior adapts based on lived outcomes
4. **Public Consciousness** - Internal state is reflected in public expression

## System Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Orchestrator                          │
│                    (Main Event Loop)                        │
└────┬──────────┬──────────┬──────────┬──────────┬──────────┬┘
     │          │          │          │          │          │
     v          v          v          v          v          v
┌─────────┐ ┌────────┐ ┌───────┐ ┌──────────┐ ┌─────┐ ┌──────────┐
│Perception│ │Signals │ │ State │ │ Decision │ │ Risk│ │Execution │
│  Layer   │ │ Layer  │ │ Layer │ │  Engine  │ │     │ │  Layer   │
└─────────┘ └────────┘ └───────┘ └──────────┘ └─────┘ └──────────┘
     │          │          │          │          │          │
     └──────────┴──────────┴──────────┴──────────┴──────────┘
                              │          │
                              v          v
                         ┌────────┐ ┌──────────┐
                         │ Memory │ │Expression│
                         │ System │ │  Layer   │
                         └────────┘ └──────────┘
```

### Data Flow

```
Raw Data → Events → Signals → State Update → Intent Formation
                                                    ↓
                                            Risk Approval
                                                    ↓
                                              Execution
                                                    ↓
                                          Trade Result
                                                    ↓
                                    ┌───────────────┴───────────────┐
                                    ↓                               ↓
                            Memory Storage                  Expression (Tweet)
                                    ↓
                            State Adjustment
```

## Shared Data Contracts

All modules communicate through typed interfaces:

- **Event** - Raw normalized data from perception
- **Signal** - Scored interpretation with confidence
- **AgentState** - Psychological and operational state
- **Intent** - Decision to act
- **TradeResult** - Execution outcome
- **MemoryEntry** - Stored experience

See `src/types/` for complete definitions.

## Module Specifications

### 1. Perception Layer

**Purpose**: Observe the external world

**Inputs**: None (polls external sources)

**Outputs**: `Event[]`

**Responsibilities**:
- Poll Solana RPC for market data
- Monitor token creation and liquidity changes
- Ingest Twitter mentions and sentiment (optional)
- Normalize all data into Event format

**Implementation Notes**:
- Configurable poll intervals
- Graceful degradation if sources unavailable
- Rate limiting for external APIs

### 2. Signal Layer

**Purpose**: Convert noise into meaning

**Inputs**: `Event[]`

**Outputs**: `Signal[]`

**Responsibilities**:
- Maintain rolling windows of events
- Detect patterns (volume spikes, hype bursts, dormancy)
- Score signals with confidence and urgency
- Apply decay to existing signals

**Implementation Notes**:
- Signals expire after configurable TTL
- Confidence scoring is probabilistic, not binary
- Signal strength can reinforce or contradict existing conviction

### 3. State Layer

**Purpose**: Maintain agent's psychological state

**Inputs**: `TradeResult`, time

**Outputs**: `AgentState`

**Responsibilities**:
- Track psychological parameters (confidence, suspicion, regret, etc.)
- Derive current mood from parameter mix
- Adjust risk appetite based on outcomes
- Manage operational mode (active, observing, safe mode)

**Implementation Notes**:
- State evolves continuously, not just on trades
- Win/loss streaks affect future risk tolerance
- Fatigue increases without successful trades
- Natural emotional decay over time

### 4. Decision Engine

**Purpose**: Form intent to act

**Inputs**: `Signal[]`, `AgentState`, `Position[]`

**Outputs**: `Intent | null`

**Responsibilities**:
- Analyze signals in context of current state
- Consider existing positions
- Generate probabilistic intent with reasoning
- Apply cooldowns to prevent overtrading

**Implementation Notes**:
- NOT rule-based - thresholds are dynamic based on state
- Multiple conflicting signals create uncertainty, not paralysis
- Intent includes alternatives considered
- WAIT is an explicit decision type

### 5. Risk & Guardrails

**Purpose**: Enforce hard limits (the ONLY deterministic rules)

**Inputs**: `Intent`, `Position[]`, capital

**Outputs**: `RiskCheckResult`

**Responsibilities**:
- Check position size limits
- Check daily loss limits
- Check total exposure
- Trigger safe mode if needed
- Can adjust intent size, but not type

**Implementation Notes**:
- These are safety boundaries, not strategy
- Can block any intent except WAIT/WATCH
- Daily counters reset at day boundaries
- Safe mode persists until manual reset

### 6. Execution Layer

**Purpose**: Turn intent into blockchain transactions

**Inputs**: `Intent` (risk-approved)

**Outputs**: `TradeResult`

**Responsibilities**:
- Connect to Solana DEX
- Build and submit transactions
- Handle slippage and failed transactions
- Report actual fills vs requested

**Implementation Notes**:
- Wallet key management (encrypted at rest)
- Transaction retry logic with backoff
- Slippage tolerance is configurable
- All transactions logged with signatures

### 7. Memory System

**Purpose**: Remember and learn from experience

**Inputs**: `TradeResult`, `Signal`, `AgentState`

**Outputs**: `MemoryEntry[]`

**Responsibilities**:
- Store short-term memories (recent events)
- Store long-term memories (important lessons)
- Enable querying by token, type, outcome
- Track pattern successes and failures

**Implementation Notes**:
- Short-term: ring buffer, last N entries
- Long-term: filtered by importance
- Memories decay but can be reinforced by access
- JSON-based persistence initially, database later

### 8. Expression Layer

**Purpose**: Public narration of internal state

**Inputs**: `AgentState`, `Intent`, `TradeResult`, `Signal[]`, `MemoryEntry`

**Outputs**: Tweet content

**Responsibilities**:
- Generate tweets in different modes:
  - Pre-trade: considering an action
  - In-trade: position updates
  - Post-mortem: reflection after exit
  - Ambient: observations without action
  - Reflection: learning from patterns
- Reference past actions for continuity
- Anti-repetition filters
- Rate limiting

**Implementation Notes**:
- Tone matches current mood
- Can express doubt, regret, confusion
- Not promotional - it's thinking out loud
- Optional: disable Twitter, log locally only

### 9. Orchestrator

**Purpose**: Coordinate all modules in main loop

**Responsibilities**:
- Initialize all modules
- Run perception → signals → state → decision → risk → execution flow
- Handle timing and scheduling
- Persist state periodically
- Graceful shutdown on signals

**Implementation Notes**:
- Configurable tick interval
- Each tick is independent (stateless loop)
- Errors in one tick don't crash the agent
- Metrics logged every cycle

## Timing and Scheduling

- **Main loop tick**: 10s default (configurable)
- **Perception poll**: 30s default
- **State persistence**: 1min default
- **Intent cooldown**: 1min minimum between decisions
- **Tweet cooldown**: 30min minimum between tweets

All intervals configurable via environment variables.

## Persistence Strategy

### Phase 0-1: JSON Files

- `data/memory/*.json` - Memory entries
- `data/state/agent.json` - Current agent state
- `data/logs/*.log` - Structured logs

### Phase 2+: Database

- PostgreSQL or SQLite for structured data
- Vector store (Pinecone, Weaviate) for pattern matching
- Time-series DB for market data

## Configuration

All configuration via environment variables (`.env` file).

Categories:
- Solana connection
- Twitter credentials (optional)
- Timing parameters
- Risk limits
- Signal thresholds
- Execution settings

See `.env.example` for complete list.

## Safety Mechanisms

1. **Hard Risk Limits** - Max loss, max exposure (enforced)
2. **Safe Mode** - Triggered by daily loss threshold
3. **Manual Kill Switch** - SIGTERM stops all trading
4. **Dry Run Mode** - Execute without real transactions (Phase 3)
5. **Position Limits** - Maximum per token, maximum total

## Failure Modes

### Perception Failure
- Agent continues with stale data
- Logs error, does not crash
- Enters observing mode if prolonged

### Execution Failure
- Transaction errors are recorded
- Position state may be inconsistent
- Manual reconciliation may be needed

### Twitter Failure
- Expression continues to console
- Agent operates normally

### Out of Capital
- Only REDUCE and EXIT intents allowed
- Enters observing mode
- Does not prevent WATCH intents

## Extensibility Points

- **New Event Sources** - Add to perception layer
- **New Signal Types** - Add to signal layer detectors
- **Custom Decision Logic** - Modify decision engine thresholds
- **Alternative DEXs** - Swap execution layer implementation
- **Expression Channels** - Add Discord, Telegram alongside Twitter

## Development Workflow

1. All changes to `src/`
2. TypeScript compilation to `dist/`
3. Structured logging to `data/logs/`
4. Local testing with `npm run dev`
5. Production with `npm run build && npm start`

## Monitoring

Key metrics to track:
- Cycle time and tick interval
- Events perceived per cycle
- Signals generated and active
- Intents formed vs approved vs executed
- Trade success rate
- Daily PnL
- Agent mood distribution over time
- Tweet cadence

## Security Considerations

- Private keys stored in `.env` (never committed)
- Logs sanitized of sensitive data
- Risk limits prevent catastrophic loss
- Manual oversight via dashboard (Phase 6)
- No remote control interface (by design)

## Future Enhancements

- Multi-agent interaction
- Self-modification of decision weights
- Visual consciousness dashboard
- External event awareness (news, trends)
- Advanced pattern recognition with ML
- Position hedging strategies
