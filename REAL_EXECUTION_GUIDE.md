# Real Execution Guide (Phase 4)

## Status: Documentation Complete, Implementation Ready

This guide documents the requirements and safety mechanisms for transitioning from paper trading to real execution on Solana DEXs.

---

## Pre-Execution Checklist

Before enabling real trading (`PAPER_MODE=false`), ensure:

1. ✅ **Paper trading results are acceptable**
   - Run for at least 7 days in simulation
   - Win rate > 40%
   - Max drawdown < 30%
   - No obvious bugs or crashes

2. ✅ **Risk limits are configured conservatively**
   - `MAX_POSITION_SIZE_PCT` ≤ 5% (start small)
   - `MAX_DAILY_LOSS_PCT` ≤ 10%
   - `MAX_TOTAL_EXPOSURE_PCT` ≤ 30%
   - `DAILY_TRADE_LIMIT` = 5-10 trades

3. ✅ **Wallet setup**
   - Dedicated trading wallet (not main wallet)
   - Funded with acceptable loss amount only
   - Private key stored securely in `.env`
   - Never commit private key to git

4. ✅ **Monitoring ready**
   - Dashboard running (Phase 6)
   - Alerts configured
   - Kill switch tested
   - Manual override procedures documented

---

## Implementation Requirements

### 1. DEX Integration

The execution layer needs integration with Solana DEX aggregators:

**Option A: Jupiter Aggregator (Recommended)**
```typescript
import { Jupiter } from '@jup-ag/core';

// Initialize Jupiter
const jupiter = await Jupiter.load({
  connection,
  cluster: 'mainnet-beta',
  user: wallet.publicKey
});

// Get route for swap
const routes = await jupiter.computeRoutes({
  inputMint: new PublicKey(fromToken),
  outputMint: new PublicKey(toToken),
  amount: JSBI.BigInt(amount),
  slippageBps: maxSlippagePct * 100
});

// Execute swap
const { execute } = await jupiter.exchange({ routeInfo: routes.routesInfos[0] });
const swapResult = await execute();
```

**Option B: Raydium SDK**
```typescript
import { Liquidity } from '@raydium-io/raydium-sdk';

// Get pool info and execute swap
const { transaction } = await Liquidity.makeSwapTransaction({
  connection,
  poolKeys,
  userKeys: { tokenAccounts, owner: wallet.publicKey },
  amountIn,
  amountOut,
  fixedSide: 'in'
});

// Sign and send
const signature = await wallet.sendTransaction(transaction, connection);
```

### 2. Wallet Management

```typescript
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// Load wallet from private key
const wallet = Keypair.fromSecretKey(
  bs58.decode(process.env.WALLET_PRIVATE_KEY!)
);

// Check balance before trading
const balance = await connection.getBalance(wallet.publicKey);
if (balance < MIN_RESERVE) {
  throw new Error('Insufficient SOL for gas');
}
```

### 3. Transaction Building

Key considerations:
- **Priority fees**: Add compute budget for faster execution
- **Recent blockhash**: Use recent blockhash to avoid expiration
- **Confirmations**: Wait for 'confirmed' commitment
- **Retries**: Implement exponential backoff
- **Timeout**: Set max wait time (60s)

```typescript
// Add priority fee
const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
  units: 300000
});

const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
  microLamports: 50000 // 0.00005 SOL
});

transaction.add(modifyComputeUnits, addPriorityFee);
```

### 4. Slippage Protection

```typescript
// Calculate minimum output with slippage
const minOutput = expectedOutput * (1 - slippagePct / 100);

// Verify actual output meets minimum
if (actualOutput < minOutput) {
  throw new Error(`Slippage exceeded: expected ${expectedOutput}, got ${actualOutput}`);
}
```

### 5. Error Handling

Common errors and recovery:
- **Insufficient SOL**: Top up wallet, reduce position size
- **Slippage exceeded**: Retry with higher slippage or skip trade
- **Transaction timeout**: Check if tx landed, reconcile state
- **Rate limiting**: Implement backoff, use multiple RPCs
- **Account not found**: Token account creation needed

---

## Safety Mechanisms (Already Implemented)

### 1. Risk Guardrails (`src/modules/risk/index.ts`)

Hard limits enforced before every trade:
- Maximum position size per trade
- Maximum daily loss threshold
- Maximum total exposure across positions
- Minimum capital reserve for gas

### 2. Safe Mode

Automatically triggered when:
- Daily loss exceeds `MAX_DAILY_LOSS_PCT`
- Multiple consecutive failed trades
- Wallet balance drops below `MIN_CAPITAL_RESERVE`

When in safe mode:
- All ENTER/ADD intents blocked
- Only EXIT/REDUCE allowed
- Manual reset required

### 3. Kill Switch

Emergency stop mechanisms:
- `SIGTERM` signal (Ctrl+C)
- Dashboard emergency stop button
- Config flag `TRADING_ENABLED=false`

On kill switch:
- Stop accepting new intents
- Complete in-flight transactions
- Persist state to disk
- Log final positions

---

## Execution Flow (Real Mode)

```
Intent Generated
     ↓
Risk Check (guardrails)
     ↓
[APPROVED] → Build Transaction
     ↓
Calculate Amounts
     ↓
Get DEX Route
     ↓
Sign Transaction
     ↓
Send to RPC
     ↓
Wait for Confirmation
     ↓
Verify Fill
     ↓
Update Position
     ↓
Record in Memory
     ↓
Update State
```

---

## Testing Real Execution

### Testnet Testing

Before mainnet:
1. Set `SOLANA_RPC_URL` to devnet
2. Fund devnet wallet (faucet)
3. Run with small sizes
4. Verify all flows work

### Mainnet Testing (Minimal Capital)

First real trades:
1. Fund wallet with 0.1-0.5 SOL only
2. Set `MAX_POSITION_SIZE_PCT=1`
3. Set `DAILY_TRADE_LIMIT=3`
4. Monitor constantly
5. Run for 24-48 hours
6. Review all trades manually

### Gradual Scaling

Only increase capital after:
- 50+ successful trades
- Consistent win rate
- No critical bugs
- All safety mechanisms tested
- Dashboard monitoring reliable

---

## Monitoring Requirements

### Real-Time Alerts

Set up alerts for:
- Trade execution failures
- Slippage above threshold
- Balance drops
- Safe mode triggered
- Unusual PnL swings

### Daily Review

Check daily:
- Win/loss ratio
- Average slippage
- Gas costs
- Failed transactions
- Position reconciliation

### Audit Trail

All trades must be logged with:
- Intent ID
- Transaction signature
- Amounts (requested vs filled)
- Prices (expected vs actual)
- Gas used
- Timestamp
- Agent mood at time

---

## Emergency Procedures

### If Trades Are Failing

1. Stop agent immediately
2. Check wallet balance
3. Verify RPC connection
4. Review last 10 transactions
5. Check DEX liquidity
6. Restart with lower limits

### If Losing Rapidly

1. Kill switch activated
2. Manual review of open positions
3. Check if signals are broken
4. Review decision logic
5. Return to paper mode
6. Investigate root cause

### If Position Desync

1. Stop trading
2. Query actual on-chain positions
3. Compare with agent state
4. Manually reconcile differences
5. Update agent state
6. Resume carefully

---

## Production Deployment

### Infrastructure

- **RPC**: Use paid RPC (Helius, QuickNode, Alchemy)
  - Free RPCs are rate-limited
  - Need reliable confirmations
  - Fallback RPC recommended

- **Server**: Dedicated VPS or cloud instance
  - Persistent process (PM2, systemd)
  - Auto-restart on crash
  - Log rotation configured

- **Secrets**: Secure environment variables
  - Never log private keys
  - Use encrypted config
  - Rotate keys periodically

### Configuration for Production

```bash
# Production .env
NODE_ENV=production
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
WALLET_PRIVATE_KEY=<encrypted_or_from_vault>
PAPER_MODE=false

# Conservative limits
MAX_POSITION_SIZE_PCT=3
MAX_DAILY_LOSS_PCT=8
MAX_TOTAL_EXPOSURE_PCT=25
DAILY_TRADE_LIMIT=10

# Monitoring
LOG_LEVEL=info
TICK_INTERVAL_MS=15000  # Slower in prod
```

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Risk Guardrails | ✅ Complete | `src/modules/risk/index.ts` |
| Safe Mode | ✅ Complete | Triggers on loss threshold |
| Kill Switch | ✅ Complete | SIGTERM handling |
| Paper Trading | ✅ Complete | Full simulation working |
| DEX Integration | ⏳ Ready for impl | Jupiter recommended |
| Wallet Management | ⏳ Ready for impl | Keypair loading needed |
| Transaction Building | ⏳ Ready for impl | Priority fees, retries |
| Slippage Protection | ⏳ Ready for impl | Min output validation |
| Position Reconciliation | ⏳ Ready for impl | On-chain query needed |

**Estimated implementation time**: 2-3 weeks for full real execution with thorough testing

---

## Next Steps

1. Implement Jupiter aggregator integration
2. Add wallet management and key loading
3. Build transaction construction logic
4. Implement confirmation polling
5. Add position reconciliation
6. Test on devnet extensively
7. Small mainnet pilot (0.1 SOL)
8. Gradual scaling based on results

**DO NOT rush real execution.** Paper trading results must be solid first.

The agent is autonomous, but safety is non-negotiable.
