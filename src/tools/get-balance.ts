import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { erc20Abi, formatUnits } from 'viem';
import { getChain } from '@y0exchange/shared/chains';
import { getTokensByChainId } from '@y0exchange/shared/tokens';
import { getPublicClient } from '../lib/viem.js';
import { tryResolveAddress } from '../lib/session.js';

export function registerGetBalance(server: McpServer) {
  server.tool(
    'get_balance',
    'Get native and ERC-20 token balances for a wallet address on a specific chain. If address is omitted, uses the wallet linked to the API key.',
    {
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().describe('Wallet address (0x...). Optional if API key is configured.'),
      chainId: z.number().optional().describe('Chain ID (default: 1 for Ethereum). Supported: 1, 56, 42161, 8453, 137'),
    },
    async ({ address: inputAddress, chainId = 1 }) => {
      const address = inputAddress ?? await tryResolveAddress();
      if (!address) {
        return { content: [{ type: 'text', text: 'No wallet address provided and no API key configured. Please provide an address or set up an API key.' }], isError: true };
      }
      const chain = getChain(chainId);
      if (!chain) {
        return { content: [{ type: 'text', text: `Unsupported chain ID: ${chainId}` }], isError: true };
      }

      const client = getPublicClient(chainId);
      const tokens = getTokensByChainId(chainId);
      const erc20Tokens = tokens.filter((t: any) => t.address !== '0x0');

      const [nativeBalance, ...erc20Results] = await Promise.all([
        client.getBalance({ address: address as `0x${string}` }),
        ...erc20Tokens.map((token: any) =>
          client.readContract({
            address: token.address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address as `0x${string}`],
          }).catch(() => 0n)
        ),
      ]);

      const nativeToken = tokens.find((t) => t.address === '0x0');
      const balances = [
        ...(nativeToken
          ? [{
              symbol: nativeToken.symbol,
              name: nativeToken.name,
              balance: formatUnits(nativeBalance, nativeToken.decimals),
              address: '0x0 (native)',
            }]
          : []),
        ...erc20Tokens.map((token: any, i: number) => ({
          symbol: token.symbol,
          name: token.name,
          balance: formatUnits(erc20Results[i] as bigint, token.decimals),
          address: token.address,
        })).filter((b: any) => b.balance !== '0'),
      ];

      const text = [
        `Balances for ${address} on ${chain.name}:`,
        '',
        ...balances.map((b) => `${b.symbol}: ${b.balance}`),
      ].join('\n');

      return { content: [{ type: 'text', text }] };
    },
  );
}
