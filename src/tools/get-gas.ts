import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatGwei } from 'viem';
import { CHAINS, getChain } from '@y0exchange/shared/chains';
import { getPublicClient, SUPPORTED_CHAIN_IDS } from '../lib/viem.js';
import { getPricesByIds } from '../lib/coingecko.js';

// Native token coingecko IDs for USD conversion
const NATIVE_COINGECKO: Record<number, string> = {
  1: 'ethereum',
  56: 'binancecoin',
  42161: 'ethereum',
  8453: 'ethereum',
  137: 'matic-network',
};

// Typical gas units for common operations
const GAS_ESTIMATES = {
  transfer: 21_000n,
  erc20Transfer: 65_000n,
  swap: 200_000n,
  approve: 46_000n,
};

export function registerGetGas(server: McpServer) {
  server.tool(
    'get_gas',
    'Get current gas prices across supported chains with USD estimates for common operations (transfer, swap, approve).',
    {
      chainId: z.number().optional().describe('Specific chain ID, or omit for all supported chains'),
    },
    async ({ chainId }) => {
      const chainIds = chainId ? [chainId] : SUPPORTED_CHAIN_IDS;

      // Fetch gas prices for all requested chains in parallel
      const results = await Promise.all(
        chainIds.map(async (cid) => {
          const chain = getChain(cid);
          if (!chain) return { chainId: cid, error: 'unsupported' };

          try {
            const client = getPublicClient(cid);
            const gasPrice = await client.getGasPrice();
            return { chainId: cid, name: chain.name, gasPrice, symbol: chain.nativeCurrency.symbol };
          } catch (err) {
            return { chainId: cid, name: chain.name, error: String(err) };
          }
        }),
      );

      // Fetch native token prices for USD conversion
      const coingeckoIds = [...new Set(chainIds.map((c) => NATIVE_COINGECKO[c]).filter(Boolean))];
      let prices: Record<string, { usd: number }> = {};
      try {
        prices = await getPricesByIds(coingeckoIds);
      } catch { /* no prices, show gwei only */ }

      const lines: string[] = [];
      for (const r of results) {
        if ('error' in r && !('gasPrice' in r)) {
          lines.push(`${r.chainId}: error — ${r.error}`);
          continue;
        }
        if (!('gasPrice' in r) || r.gasPrice === undefined) continue;

        const gwei = formatGwei(r.gasPrice);
        const nativePrice = prices[NATIVE_COINGECKO[r.chainId]]?.usd ?? 0;

        lines.push(`${r.name} (${r.chainId}):`);
        lines.push(`  Gas price: ${gwei} gwei`);

        if (nativePrice > 0) {
          for (const [op, gas] of Object.entries(GAS_ESTIMATES)) {
            const costWei = r.gasPrice * gas;
            const costEth = Number(costWei) / 1e18;
            const costUsd = costEth * nativePrice;
            lines.push(`  ${op}: ~$${costUsd.toFixed(4)} (${costEth.toFixed(6)} ${r.symbol})`);
          }
        }
        lines.push('');
      }

      return { content: [{ type: 'text', text: lines.join('\n').trim() }] };
    },
  );
}
