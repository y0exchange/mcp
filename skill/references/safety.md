# DeFi Safety Guidelines

## Before Any Write Operation

1. **Verify funds**: Always check balance before swap/send
2. **Show full details**: Display all parameters to user before executing
3. **Wait for confirmation**: Never auto-execute write operations
4. **Check gas**: Ensure gas cost is reasonable relative to transaction value

## Slippage Guidelines

| Scenario | Recommended Slippage |
|----------|---------------------|
| Stablecoin pairs (USDC/USDT/DAI) | 0.1-0.3% |
| Major pairs (ETH/USDC, BTC/ETH) | 0.5% |
| Small/mid-cap tokens | 1% (default) |
| High volatility (>10% 24h change) | 1-2% |
| Very large swaps (>$50k) | 0.3-0.5% |

## Gas Cost Thresholds

| Gas as % of Transaction | Action |
|------------------------|--------|
| <1% | Proceed normally |
| 1-5% | Mention the cost, proceed |
| 5-10% | Warn user, suggest L2 alternative |
| >10% | Strongly recommend alternative chain or waiting |

## Native Token Reserve

When sending/swapping the native token (ETH, BNB, POL):
- Never send 100% — always leave gas reserve
- Recommended reserve: 2-3x the cost of a transfer (42-63k gas worth)
- For active wallets: suggest keeping at least $5-10 of native token

## Address Safety

- Always display the full recipient address for sends
- If the address is new (not seen in history), mention it
- For large transfers (>$1,000): suggest a test transaction first

## Concentration Risk

| Allocation | Risk Level | Guidance |
|-----------|------------|----------|
| <50% in single asset | Normal | No warning needed |
| 50-80% in single asset | Moderate | Mention diversification option |
| >80% in single asset | High | Note the concentration risk |

## Common Mistakes to Prevent

1. **Wrong chain**: User has USDC on Ethereum but tries to swap on Base — check balance first
2. **Dust amounts**: Don't recommend swapping amounts where gas > swap value
3. **Double approval**: Some tokens need an approve tx before swap — the swap tool handles this, but mention if user asks about extra transactions
4. **Sending to contract**: If toAddress is a known contract, warn that sending tokens directly to contracts may result in loss
