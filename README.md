<p align="center">
  <strong>@y0exchange/mcp</strong>
</p>

<p align="center">
  <em>Let AI agents trade crypto. Non-custodial. Multi-chain. One MCP server.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@y0exchange/mcp"><img src="https://img.shields.io/npm/v/@y0exchange/mcp.svg?style=flat-square&color=4f46e5" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@y0exchange/mcp"><img src="https://img.shields.io/npm/dm/@y0exchange/mcp.svg?style=flat-square&color=34d399" alt="npm downloads"></a>
  <a href="https://github.com/y0exchange/y0exchange/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license"></a>
  <a href="https://y0.exchange"><img src="https://img.shields.io/badge/y0-exchange-4f46e5?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMCIgY3k9IjEwIiByPSIxMCIgZmlsbD0iIzRmNDZlNSIvPjwvc3ZnPg==" alt="y0.exchange"></a>
</p>

---

## What is this?

**@y0exchange/mcp** is a [Model Context Protocol](https://modelcontextprotocol.io/) server that gives AI agents real-time access to DeFi — balances, prices, gas, swap quotes, transaction history, and the ability to execute swaps and transfers.

Connect it to Claude, ChatGPT, or any MCP-compatible AI client. Your users talk to AI, AI talks to the blockchain.

```
User  →  AI Agent  →  @y0exchange/mcp  →  Blockchain
                            ↓
                     y0 Signing Service (user signs on their device)
```

> **Non-custodial by design.** y0 never touches private keys. Write operations build unsigned transactions — the user always signs on their own device.

---

## Quick Start

### 1. Get your API key

Sign in at [app.y0.exchange](https://app.y0.exchange) → **API Keys** → copy your key.

### 2. Add connector (recommended)

The simplest way — works on **Claude Desktop**, **claude.ai**, **Claude Mobile**, and **ChatGPT**:

1. Open your AI app → **Settings → Connectors → Add custom connector**
2. Name: `y0`
3. URL: `https://mcp.y0.exchange/mcp?key=YOUR_API_KEY`
4. Save — done!

No installs, no config files, no terminal. The API key links to your wallet — the AI agent automatically knows your address and permissions.

### For developer IDEs (Cursor, Windsurf)

Add to your MCP config (e.g. `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "y0": {
      "command": "npx",
      "args": ["-y", "@y0exchange/mcp"],
      "env": {
        "Y0_API_KEY": "y0_your_api_key_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add --transport http y0 https://mcp.y0.exchange/mcp?key=YOUR_API_KEY
```

### Any MCP client (stdio)

```bash
Y0_API_KEY=y0_... npx @y0exchange/mcp
```

The server communicates over **stdio** — compatible with any MCP client.

### Read-only mode

Without `Y0_API_KEY`, read-only tools (balances, prices, gas, quotes, history) still work. Omit the key to experiment without an account.

---

## Remote Server (HTTP)

The hosted remote server at `mcp.y0.exchange` powers the connector approach above. You can also self-host it.

### Self-host the remote server

```bash
# Build
pnpm --filter @y0exchange/mcp build

# Run
pnpm --filter @y0exchange/mcp start:remote

# Or with Docker
docker build -f mcp/Dockerfile -t y0-mcp-remote .
docker run -p 3100:3100 \
  -e SIGNING_SERVICE_URL=https://api.y0.exchange \
  -e ZEROX_API_KEY=your_key \
  y0-mcp-remote
```

The remote server exposes:
- `POST /mcp` — Streamable HTTP MCP endpoint
- `GET /health` — health check

Environment variable `PORT` controls the listening port (default: `3100`).

### How it differs from stdio

| | stdio (`npx`) | Remote (HTTP) |
|--|---------------|---------------|
| Runs on | User's machine | Your server |
| Transport | stdin/stdout | Streamable HTTP |
| Works on mobile | No | Yes |
| Works on claude.ai | No | Yes |
| Auth | `Y0_API_KEY` env var | `?key=` in URL or `Authorization` header |
| Deployment | None (npm) | Docker / any Node.js host |

---

## Tools

### Read-only — work out of the box, no API keys required

| Tool | Description |
|------|-------------|
| **`get_balance`** | Native + ERC-20 token balances for any wallet |
| **`get_portfolio`** | Aggregated portfolio across all chains with USD values |
| **`get_price`** | Real-time token prices with 24h change |
| **`get_quote`** | Swap quotes with routing preview, fees, and gas estimate |
| **`get_gas`** | Gas prices across chains with USD cost estimates |
| **`get_history`** | Transaction history with smart classification |

### Write — requires `Y0_API_KEY`

| Tool | Description |
|------|-------------|
| **`swap`** | Build unsigned swap tx → user approves on device |
| **`send`** | Build unsigned transfer tx → user approves on device |

Write tools use your API key to identify your wallet. The AI agent never needs to ask for your address — it's resolved automatically from the key.

---

## Supported Chains

| Chain | ID | Status |
|-------|----|--------|
| Ethereum | `1` | Production |
| BNB Chain | `56` | Production |
| Arbitrum | `42161` | Production |
| Base | `8453` | Production |
| Polygon | `137` | Production |

---

## Configuration

All configuration is via environment variables. **None are required** for read-only tools.

### Core

| Variable | Description | Default |
|----------|-------------|---------|
| `Y0_API_KEY` | Your y0 API key (required for swap/send) | — |
| `SIGNING_SERVICE_URL` | y0 Signing Service endpoint | `https://api.y0.exchange` |

### Swap Providers

| Variable | Description |
|----------|-------------|
| `ZEROX_API_KEY` | [0x](https://0x.org) swap API key (tried first) |
| `ONEINCH_API_KEY` | [1inch](https://1inch.io) swap API key (fallback) |

### Block Explorers (for `get_history`)

| Variable | Description |
|----------|-------------|
| `ETHERSCAN_API_KEY` | Etherscan API key |
| `BSCSCAN_API_KEY` | BSCScan API key |
| `ARBISCAN_API_KEY` | Arbiscan (falls back to Etherscan key) |
| `BASESCAN_API_KEY` | BaseScan (falls back to Etherscan key) |
| `POLYGONSCAN_API_KEY` | PolygonScan (falls back to Etherscan key) |

### Pricing

| Variable | Description |
|----------|-------------|
| `COINGECKO_API_KEY` | CoinGecko Pro key (optional, free tier works) |

---

## How Swaps Work

```
1. User says: "Swap 1 ETH to USDC"

2. AI calls get_quote → shows price, fees, slippage

3. User confirms → AI calls swap (no wallet address needed — resolved from API key)

4. MCP authenticates with y0 Signing Service via Y0_API_KEY
   → builds unsigned transaction
   → sends push notification to user's mobile app

5. User reviews and signs on their device (biometric + wallet)

6. Transaction executes on-chain
```

**Your keys never leave your device.** The MCP server and y0 Signing Service only handle unsigned transaction payloads.

---

## Example Conversations

> **"What's my portfolio worth?"**
>
> AI calls `get_portfolio` → returns breakdown by chain, token allocations, total USD value

> **"How much gas would a swap cost on Base right now?"**
>
> AI calls `get_gas` with chainId 8453 → returns gas price + USD estimates for different tx types

> **"Swap 500 USDC to ETH on Arbitrum"**
>
> AI calls `get_quote` → shows expected output → user confirms → `swap` builds unsigned tx → user signs

> **"Send 0.5 ETH to vitalik.eth"**
>
> AI calls `send` → builds unsigned transfer → user signs on device

---

## Skill: Smarter DeFi Workflows

The MCP server gives Claude access to DeFi tools. The **y0 DeFi Skill** teaches Claude *how* to use them well — checking balances before swaps, warning about gas costs, recommending optimal chains, and following DeFi best practices automatically.

### What it adds

- Pre-swap safety checks (balance, gas, slippage recommendations)
- Portfolio analysis with concentration risk warnings
- Cross-chain gas comparison and routing suggestions
- Confirmation gates before any write operation
- Domain expertise: stablecoin slippage, native token reserves, test transaction recommendations

### Install the skill

**Claude.ai:**
1. Download the `skill/` folder from this repo (or [download ZIP](../../tree/main/mcp/skill))
2. Go to **Settings → Capabilities → Skills**
3. Click **Upload skill** and select the zipped `skill/` folder
4. Make sure your y0 MCP connector is also connected

**Claude Code:**
```bash
# Place the skill folder in your Claude Code skills directory
cp -r skill/ ~/.claude/skills/y0-defi-assistant/
```

### Verify it works

Ask Claude: *"Check my crypto portfolio"* — it should automatically call `get_portfolio`, present a clear breakdown, and note any concentration risks or gas optimization opportunities.

---

## For B2B Partners

Building an AI-powered trading product? y0 provides the infrastructure:

- **MCP server** — this package, plug into any AI agent
- **[Signing UI](https://www.npmjs.com/package/@y0exchange/signing-ui)** — white-label transaction approval widget
- **Signing Service** — managed backend for transaction building + lifecycle
- **B2B Portal** — API keys, usage dashboards, billing

[Get in touch](https://y0.exchange) to set up your integration.

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    AI Agents                               │
│  Claude Desktop / Claude Code / Cursor / GPT / custom     │
│  claude.ai / Claude Mobile                                │
└──────────┬───────────────────────────────┬────────────────┘
           │ stdio (local)                 │ HTTP (remote)
           │ npx @y0exchange/mcp           │ .../mcp?key=YOUR_API_KEY
           ▼                               ▼
┌──────────────────────────────────────────────────────────┐
│                   @y0exchange/mcp                         │
│                                                          │
│  ┌─────────────────┐  ┌──────────────────┐               │
│  │   Read Tools     │  │   Write Tools    │               │
│  │                  │  │                  │               │
│  │  get_balance     │  │  swap ─────────────► y0 Signing  │
│  │  get_portfolio   │  │  send ─────────────► Service     │
│  │  get_price       │  │                  │               │
│  │  get_quote       │  └──────────────────┘               │
│  │  get_gas         │                                     │
│  │  get_history     │                                     │
│  └────────┬─────────┘                                     │
└───────────┼───────────────────────────────────────────────┘
            │
   ┌────────▼─────────┐
   │   Blockchain RPCs │
   │   CoinGecko API   │
   │   0x / 1inch APIs │
   │   Block Explorers │
   └───────────────────┘

Mobile / Web (claude.ai, Claude Mobile):
  Uses remote HTTP server — no local process needed.

Desktop / CLI (Claude Desktop, Claude Code, Cursor):
  Can use either stdio (npx) or remote HTTP.
```

---

## Development

```bash
# Clone the monorepo
git clone https://github.com/y0exchange/y0exchange.git
cd y0exchange

# Install dependencies
pnpm install

# Build
pnpm --filter @y0exchange/mcp build

# Run stdio server (local dev)
pnpm --filter @y0exchange/mcp start

# Run remote HTTP server (local dev)
pnpm --filter @y0exchange/mcp start:remote

# Watch mode (rebuilds on change)
pnpm --filter @y0exchange/mcp dev
```

---

## License

MIT — use it freely in your products. See [LICENSE](./LICENSE) for details.

---

<p align="center">
  Built by <a href="https://y0.exchange"><strong>y0.exchange</strong></a> — AI-native DeFi infrastructure
</p>
