import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ALL_TOKENS } from '@y0exchange/shared/tokens';
import { getPricesByIds } from '../lib/coingecko.js';

// Resolve symbol or coingecko ID to coingecko ID
function resolveToCoingeckoId(input: string): string {
  const lower = input.toLowerCase().trim();
  const bySymbol = ALL_TOKENS.find((t: any) => t.symbol.toLowerCase() === lower);
  if (bySymbol?.coingeckoId) return bySymbol.coingeckoId;
  const byId = ALL_TOKENS.find((t: any) => t.coingeckoId === lower);
  if (byId?.coingeckoId) return byId.coingeckoId;
  return lower; // assume it's already a coingecko ID
}

export function registerGetPrice(server: McpServer) {
  server.tool(
    'get_price',
    'Get current USD price and 24h change for one or more tokens. Accepts CoinGecko IDs (e.g. "ethereum") or symbols (e.g. "ETH").',
    {
      tokens: z.string().describe('Comma-separated CoinGecko IDs or token symbols (e.g. "ETH,BTC,USDC")'),
    },
    async ({ tokens }) => {
      const inputs = tokens.split(',').map((s: string) => s.trim()).filter(Boolean);
      const coingeckoIds = [...new Set(inputs.map((t: string) => resolveToCoingeckoId(t)))];

      if (coingeckoIds.length === 0) {
        return { content: [{ type: 'text', text: 'No valid tokens specified.' }], isError: true };
      }

      try {
        const prices = await getPricesByIds(coingeckoIds);

        const lines = coingeckoIds.map((id) => {
          const p = prices[id as any];
          if (!p) return `${id}: price not found`;
          const change = p.usd_24h_change !== undefined
            ? ` (${p.usd_24h_change >= 0 ? '+' : ''}${p.usd_24h_change.toFixed(2)}% 24h)`
            : '';
          return `${id}: $${p.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}${change}`;
        });

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Failed to fetch prices: ${err}` }], isError: true };
      }
    },
  );
}
