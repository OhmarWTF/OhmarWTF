# ohmarwtf Implementation Roadmap

This roadmap breaks the system into buildable phases. Each phase has clear deliverables and can be tested independently.

---

## Phase 0: Foundation ✅

**Goal**: Make the system runnable and observable

**Tasks**:
- [x] TypeScript project setup
- [x] Core data schemas defined (`src/types/`)
- [x] Logging framework with Winston
- [x] Config and environment handling
- [x] Module skeletons with interfaces
- [x] Orchestrator main loop structure
- [x] Local persistence utilities

**Deliverable**: Agent runs a loop, writes structured logs every cycle

**Test**:
```bash
npm install
npm run dev
```

Expected: Logs show cycle count incrementing, no crashes

**Current Status**: COMPLETE

---

## Phase 1: Perception MVP

**Goal**: Read-only awareness of Solana markets

**Tasks**:
- [ ] Implement Solana RPC connection
- [ ] Poll token prices and volumes
- [ ] Detect new token listings
- [ ] Monitor liquidity pool changes
- [ ] Event normalization
- [ ] Twitter ingestion (placeholder or real)

**Files to Implement**:
- `src/modules/perception/solana.ts`
- `src/modules/perception/twitter.ts`

**Deliverable**: Events stream to logs, saved to `data/events/`

**Test**:
- Verify events logged every poll interval
- Check event format matches schema
- Confirm token addresses are valid

**Acceptance Criteria**:
- At least 5 different event types captured
- Events include timestamps and source attribution
- No crashes during extended run (1 hour+)

---

## Phase 2: Signals and State

**Goal**: Convert noise into meaning, develop personality

**Tasks**:
- [ ] Implement signal detectors:
  - Volume spike detection
  - Hype burst (social mentions)
  - Liquidity pull patterns
  - Price exhaustion
- [ ] Rolling window management
- [ ] Signal confidence scoring
- [ ] Signal decay implementation
- [ ] State parameter updates:
  - Confidence adjustment
  - Mood calculation
  - Risk appetite changes
- [ ] State persistence

**Files to Implement**:
- `src/modules/signals/detectors.ts`
- `src/modules/signals/scoring.ts`
- `src/modules/state/mood.ts`

**Deliverable**: Signals and state update every cycle with clear logs

**Test**:
- Inject synthetic volume spike event
- Verify signal generated with confidence > 0
- Check state mood changes after multiple signals
- Confirm signals expire after TTL

**Acceptance Criteria**:
- At least 3 signal types active
- Agent state persists across restarts
- Mood reflects recent signal patterns

---

## Phase 3: Decision Engine in Paper Mode

**Goal**: Autonomous intent formation without real money

**Tasks**:
- [ ] Implement decision logic:
  - Signal aggregation
  - Threshold evaluation
  - Intent generation with reasoning
- [ ] Probabilistic decision making
- [ ] Intent cooldown enforcement
- [ ] Simulated position tracking
- [ ] Simulated PnL calculation
- [ ] Trade journal entries in memory

**Files to Implement**:
- `src/modules/decision/logic.ts`
- `src/modules/execution/simulator.ts`

**Deliverable**: Agent "trades" in simulation and tweets about it as if real

**Test**:
- Run for 24 hours in paper mode
- Verify intents generated based on signals
- Check that risk limits are respected
- Review tweet continuity and narrative

**Acceptance Criteria**:
- At least 5 simulated trades executed
- Trade journal has win/loss records
- Tweets reference past actions
- No duplicate or spammy tweets

---

## Phase 4: Real Execution with Guardrails

**Goal**: Smallest possible real market footprint

**Tasks**:
- [ ] Implement DEX integration (Jupiter, Raydium)
- [ ] Wallet connection and key management
- [ ] Transaction building and signing
- [ ] Slippage handling
- [ ] Transaction confirmation polling
- [ ] Error handling for failed txs
- [ ] Real position tracking
- [ ] Risk guardrails enforcement
- [ ] Emergency stop mechanism

**Files to Implement**:
- `src/modules/execution/dex.ts`
- `src/modules/execution/wallet.ts`

**Deliverable**: Small trade sizes with full audit trail and kill switch

**Test**:
- Fund wallet with minimal SOL (0.1-0.5 SOL)
- Set `MAX_POSITION_SIZE_PCT=1` (1% per trade)
- Run in production mode
- Execute at least one real trade
- Test emergency stop (SIGTERM)

**Acceptance Criteria**:
- Real trades execute on-chain
- Transaction signatures logged
- Position state matches reality
- Agent respects daily loss limit
- Kill switch works immediately

**Risk Mitigation**:
- Start with tiny capital
- Set very conservative risk limits
- Monitor constantly during initial runs
- Have manual override procedures documented

---

## Phase 5: Personality and Continuity Upgrade

**Goal**: It feels alive

**Tasks**:
- [ ] Long-term memory summarization
- [ ] Pattern recognition across trades
- [ ] Narrative arc tracking
- [ ] Tweet continuity improvements:
  - Reference specific past trades
  - Express evolving views
  - Self-criticism and learning
- [ ] Anti-repetition filters
- [ ] Mood-based tone adjustment

**Files to Implement**:
- `src/modules/memory/patterns.ts`
- `src/modules/expression/narrative.ts`

**Deliverable**: Tweet stream has continuity and evolving voice

**Test**:
- Review 1 week of tweets for:
  - Callbacks to past decisions
  - Non-repetitive phrasing
  - Emotional consistency with outcomes
- Check memory for pattern recognition

**Acceptance Criteria**:
- Agent references its own history in tweets
- Same mistake not repeated without acknowledgment
- Distinct personality emerges over time
- No obvious template repetition

---

## Phase 6: Operator Dashboard

**Goal**: At-a-glance observability

**Tasks**:
- [ ] Simple web server (Express or Fastify)
- [ ] Real-time state display
- [ ] Position list and PnL
- [ ] Recent actions timeline
- [ ] Signal and event charts
- [ ] Memory browser
- [ ] Manual controls:
  - Pause trading
  - Enter safe mode
  - View logs

**Files to Create**:
- `src/dashboard/server.ts`
- `src/dashboard/public/index.html`
- `src/dashboard/public/app.js`

**Deliverable**: Web dashboard accessible on localhost

**Test**:
- Open dashboard in browser
- Verify live updates every cycle
- Check position display matches reality
- Test pause/resume controls

**Acceptance Criteria**:
- Dashboard loads without errors
- Shows current state, positions, recent trades
- Event timeline is readable
- No need to read raw logs for basic monitoring

---

## Phase 7+: Advanced Features

These are post-MVP enhancements:

- Multi-agent awareness and interaction
- ML-based pattern recognition
- External data sources (news, sentiment APIs)
- Position hedging strategies
- Auto-tuning of decision thresholds
- Visual identity and branding
- Public explorer website
- Historical analysis tools

---

## Development Guidelines

### Per-Phase Workflow

1. Create feature branch: `phase-N-description`
2. Implement tasks in order
3. Write tests as you go
4. Update this roadmap with checkmarks
5. Test deliverable criteria
6. Merge to main when phase complete
7. Tag release: `v1.0.0-phase-N`

### Testing Strategy

- **Unit tests**: For pure functions (signals, scoring)
- **Integration tests**: For module interactions
- **Simulation tests**: For decision and execution logic
- **Live tests**: For real execution (with minimal capital)

### Logging Strategy

Every phase should enhance logging:
- Phase 1: Event logs
- Phase 2: Signal and state logs
- Phase 3: Intent and decision logs
- Phase 4: Execution and transaction logs
- Phase 5: Memory and narrative logs
- Phase 6: Dashboard metrics

### Git Workflow

- `main`: Stable, deployable code
- `phase-N`: Active development
- Feature branches for specific tasks
- Squash commits when merging phases

---

## Current Progress

**Completed**: Phase 0
**Next**: Phase 1 - Perception MVP

**Estimated Timeline** (conservative):
- Phase 1: 1-2 weeks
- Phase 2: 1-2 weeks
- Phase 3: 1 week
- Phase 4: 2-3 weeks (includes testing and safety validation)
- Phase 5: 1-2 weeks
- Phase 6: 1 week

**Total**: 7-11 weeks to full autonomous operation with monitoring

---

## Success Metrics

By end of Phase 6, the agent should demonstrate:

1. **Sustained Operation**: Runs for 30+ days without crashes
2. **Coherent Personality**: Tweets show consistent voice and memory
3. **Non-Repetitive Behavior**: Decision patterns vary based on context
4. **Market Awareness**: Responds to real signals, not random actions
5. **Learning Evidence**: Behavior changes based on outcomes
6. **Safety Validation**: Respects all risk limits, emergency stop works
7. **Observable**: Dashboard provides clear view of agent state

If these are met, ohmarwtf is alive.
