import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { erc20Abi, formatUnits } from 'viem';
import { CHAINS, getChain } from '@y0exchange/shared/chains';
import { getTokensByChainId } from '@y0exchange/shared/tokens';
import { getPublicClient, SUPPORTED_CHAIN_IDS } from '../lib/viem.js';
import { getPricesByIds } from '../lib/coingecko.js';
import { tryResolveAddress } from '../lib/session.js';

interface TokenWithValue {
  symbol: string;
  chain: string;
  balance: string;
  usdValue: number;
}

export function registerGetPortfolio(server: McpServer) {
  server.tool(
    'get_portfolio',
    'Get aggregated portfolio view across all chains with USD values, per-chain breakdown, and allocation percentages. If address is omitted, uses the wallet linked to the API key.',
    {
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().describe('Wallet address (0x...). Optional if API key is configured.'),
    },
    async ({ address: inputAddress }) => {
      const address = inputAddress ?? await tryResolveAddress();
      if (!address) {
        return { content: [{ type: 'text', text: 'No wallet address provided and no API key configured. Please provide an address or set up an API key.' }], isError: true };
      }
      const addr = address as `0x${string}`;
      const allTokens: TokenWithValue[] = [];

      // Collect all coingecko IDs for batch price fetch
      const coingeckoIdSet = new Set<string>();
      for (const chainId of SUPPORTED_CHAIN_IDS) {
        for (const t of getTokensByChainId(chainId) as any[]) {
          if (t.coingeckoId) coingeckoIdSet.add(t.coingeckoId);
        }
      }

      // Fetch prices first
      let prices: Record<string, { usd: number }> = {};
      try {
        prices = await getPricesByIds([...coingeckoIdSet]);
      } catch { /* continue without prices */ }

      // Fetch balances per chain in parallel
      const chainResults = await Promise.all(
        SUPPORTED_CHAIN_IDS.map(async (chainId) => {
          const chain = getChain(chainId);
          if (!chain) return [];

          try {
            const client = getPublicClient(chainId);
            const tokens = getTokensByChainId(chainId);
            const erc20Tokens = tokens.filter((t: any) => t.address !== '0x0');

            const [nativeBalance, ...erc20Results] = await Promise.all([
              client.getBalance({ address: addr }),
              ...erc20Tokens.map((token) =>
                client.readContract({
                  address: token.address as `0x${string}`,
                  abi: erc20Abi,
                  functionName: 'balanceOf',
                  args: [addr],
                }).catch(() => 0n)
              ),
            ]);

            const result: TokenWithValue[] = [];
            const nativeToken = tokens.find((t: any) => t.address === '0x0');
            if (nativeToken && nativeBalance > 0n) {
              const bal = formatUnits(nativeBalance, nativeToken.decimals);
              const price = nativeToken.coingeckoId ? prices[nativeToken.coingeckoId]?.usd ?? 0 : 0;
              result.push({ symbol: nativeToken.symbol, chain: chain.name, balance: bal, usdValue: Number(bal) * price });
            }

            for (let i = 0; i < erc20Tokens.length; i++) {
              const raw = erc20Results[i] as bigint;
              if (raw === 0n) continue;
              const token = erc20Tokens[i];
              const bal = formatUnits(raw, token.decimals);
              const price = token.coingeckoId ? prices[token.coingeckoId]?.usd ?? 0 : 0;
              result.push({ symbol: token.symbol, chain: chain.name, balance: bal, usdValue: Number(bal) * price });
            }

            return result;
          } catch {
            return [];
          }
        }),
      );

      for (const tokens of chainResults) {
        allTokens.push(...tokens);
      }

      if (allTokens.length === 0) {
        return { content: [{ type: 'text', text: `No token balances found for ${address} across ${SUPPORTED_CHAIN_IDS.length} chains.` }] };
      }

      // Sort by USD value descending
      allTokens.sort((a, b) => b.usdValue - a.usdValue);
      const totalUsd = allTokens.reduce((sum, t) => sum + t.usdValue, 0);

      const lines = [
        `Portfolio for ${address}`,
        `Total value: $${totalUsd.toFixed(2)}`,
        '',
        ...allTokens.map((t) => {
          const pct = totalUsd > 0 ? ((t.usdValue / totalUsd) * 100).toFixed(1) : '0.0';
          return `${t.symbol} (${t.chain}): ${t.balance} — $${t.usdValue.toFixed(2)} (${pct}%)`;
        }),
      ];

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );
}
