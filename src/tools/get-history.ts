import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatUnits } from 'viem';
import { getChain } from '@y0exchange/shared/chains';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { tryResolveAddress } from '../lib/session.js';

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY || ETHERSCAN_API_KEY;
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || ETHERSCAN_API_KEY;
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || ETHERSCAN_API_KEY;

const EXPLORER_API: Record<number, { url: string; keyEnv: string | undefined }> = {
  1: { url: 'https://api.etherscan.io/api', keyEnv: ETHERSCAN_API_KEY },
  56: { url: 'https://api.bscscan.com/api', keyEnv: BSCSCAN_API_KEY },
  42161: { url: 'https://api.arbiscan.io/api', keyEnv: ARBISCAN_API_KEY },
  8453: { url: 'https://api.basescan.org/api', keyEnv: BASESCAN_API_KEY },
  137: { url: 'https://api.polygonscan.com/api', keyEnv: POLYGONSCAN_API_KEY },
};

interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  functionName?: string;
  methodId?: string;
  isError?: string;
  gasUsed?: string;
  gasPrice?: string;
}

function classifyTx(tx: EtherscanTx): string {
  const fn = tx.functionName?.toLowerCase() ?? '';
  if (fn.includes('swap') || fn.includes('exactinput') || fn.includes('multicall')) return 'swap';
  if (fn.includes('approve')) return 'approval';
  if (fn.includes('bridge') || fn.includes('relay')) return 'bridge';
  return 'transfer';
}

function formatTimestamp(ts: string): string {
  return new Date(Number(ts) * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

export function registerGetHistory(server: McpServer) {
  server.tool(
    'get_history',
    'Get transaction history for a wallet address from block explorer (Etherscan/BSCScan). Supports filtering by type. If address is omitted, uses the wallet linked to the API key.',
    {
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().describe('Wallet address (0x...). Optional if API key is configured.'),
      chainId: z.number().optional().describe('Chain ID (default: 1)'),
      type: z.enum(['all', 'swap', 'transfer', 'approval', 'bridge']).optional().describe('Filter by tx type'),
      limit: z.number().optional().describe('Max results (default: 20, max: 100)'),
    },
    async ({ address: inputAddress, chainId = 1, type = 'all', limit = 20 }) => {
      const address = inputAddress ?? await tryResolveAddress();
      if (!address) {
        return { content: [{ type: 'text', text: 'No wallet address provided and no API key configured. Please provide an address or set up an API key.' }], isError: true };
      }
      const chain = getChain(chainId);
      if (!chain) {
        return { content: [{ type: 'text', text: `Unsupported chain ID: ${chainId}` }], isError: true };
      }

      const explorer = EXPLORER_API[chainId];
      if (!explorer) {
        return { content: [{ type: 'text', text: `No block explorer API configured for chain ${chainId}` }], isError: true };
      }

      const cacheKey = `history:${chainId}:${address}`;
      let txs = cacheGet<EtherscanTx[]>(cacheKey, 60_000); // 1 min cache

      if (!txs) {
        try {
          const apiKey = explorer.keyEnv ? `&apikey=${explorer.keyEnv}` : '';
          const url = `${explorer.url}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc${apiKey}`;
          const res = await fetch(url);
          const data = await res.json();

          if (data.status !== '1' || !Array.isArray(data.result)) {
            return { content: [{ type: 'text', text: `No transactions found for ${address} on ${chain.name}.` }] };
          }

          txs = data.result as EtherscanTx[];
          cacheSet(cacheKey, txs);
        } catch (err) {
          return { content: [{ type: 'text', text: `Failed to fetch history: ${err}` }], isError: true };
        }
      }

      // Classify and filter
      let classified = txs.map((tx) => ({
        ...tx,
        txType: classifyTx(tx),
      }));

      if (type !== 'all') {
        classified = classified.filter((tx) => tx.txType === type);
      }

      classified = classified.slice(0, Math.min(limit, 100));

      if (classified.length === 0) {
        return { content: [{ type: 'text', text: `No ${type} transactions found for ${address} on ${chain.name}.` }] };
      }

      const lines = [
        `Transaction history for ${address} on ${chain.name} (${classified.length} results):`,
        '',
        ...classified.map((tx) => {
          const direction = tx.from.toLowerCase() === address.toLowerCase() ? 'OUT' : 'IN';
          const value = formatUnits(BigInt(tx.value || '0'), 18);
          const status = tx.isError === '1' ? ' FAILED' : '';
          const fn = tx.functionName ? ` [${tx.functionName.split('(')[0]}]` : '';
          return `${formatTimestamp(tx.timeStamp)} | ${direction} | ${tx.txType} | ${value} ${chain.nativeCurrency.symbol}${fn}${status} | ${tx.hash}`;
        }),
      ];

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );
}
