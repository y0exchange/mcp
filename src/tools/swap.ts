import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { parseUnits } from 'viem';
import { getTokensByChainId, type Token } from '@y0exchange/shared/tokens';
import { resolveSession, getApiKey, getSigningServiceUrl } from '../lib/session.js';

const NATIVE_PLACEHOLDER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

function findToken(query: string, chainId: number): Token | undefined {
  const tokens = getTokensByChainId(chainId);
  const lower = query.toLowerCase();
  return tokens.find(
    (t: any) => t.symbol.toLowerCase() === lower || t.address.toLowerCase() === lower,
  );
}

function resolveAddress(token: Token | undefined, fallback: string): string {
  if (!token) return fallback;
  return token.address === '0x0' ? NATIVE_PLACEHOLDER : token.address;
}

export function registerSwap(server: McpServer) {
  server.tool(
    'swap',
    'Build an unsigned swap transaction. The user will approve and sign on their device — y0 never holds private keys. Requires Y0_API_KEY to be configured.',
    {
      sellToken: z.string().describe('Token to sell — symbol (e.g. "USDC") or contract address'),
      buyToken: z.string().describe('Token to buy — symbol or contract address'),
      sellAmount: z.string().describe('Amount to sell in human-readable units (e.g. "100" for 100 USDC)'),
      chainId: z.number().optional().describe('Chain ID (default: 1)'),
      slippage: z.number().optional().describe('Slippage tolerance in % (default: 1)'),
    },
    async ({ sellToken, buyToken, sellAmount, chainId = 1, slippage = 1 }) => {
      let session;
      try {
        session = await resolveSession();
      } catch (err) {
        return { content: [{ type: 'text', text: `Authentication error: ${err}. Set Y0_API_KEY in your MCP config.` }], isError: true };
      }

      if (!session.permissions.swap) {
        return { content: [{ type: 'text', text: 'This API key does not have swap permissions.' }], isError: true };
      }

      const sell = findToken(sellToken, chainId);
      const buy = findToken(buyToken, chainId);
      const sellAddr = resolveAddress(sell, sellToken);
      const buyAddr = resolveAddress(buy, buyToken);
      const sellDecimals = sell?.decimals ?? 18;
      const sellSymbol = sell?.symbol ?? sellToken;
      const buySymbol = buy?.symbol ?? buyToken;

      let amountWei: string;
      try {
        amountWei = parseUnits(sellAmount, sellDecimals).toString();
      } catch {
        return { content: [{ type: 'text', text: `Invalid amount: ${sellAmount}` }], isError: true };
      }

      try {
        const res = await fetch(`${getSigningServiceUrl()}/api/build/swap`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getApiKey()}`,
          },
          body: JSON.stringify({
            chainId,
            sellToken: sellAddr,
            buyToken: buyAddr,
            sellAmount: amountWei,
            slippage,
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          return { content: [{ type: 'text', text: `Failed to build swap: ${err}` }], isError: true };
        }

        const tx = await res.json();

        const text = [
          `Swap transaction created and sent to user for approval.`,
          '',
          `Transaction ID: ${tx.id}`,
          `Wallet: ${session.userAddress}`,
          `Swap: ${sellAmount} ${sellSymbol} → ${buySymbol}`,
          `Chain: ${chainId}`,
          `Status: ${tx.status}`,
          `Approval tier: ${tx.approvalTier}`,
          `Expires: ${tx.expiresAt}`,
          '',
          'Waiting for user to approve and sign on their device.',
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Signing service error: ${err}` }], isError: true };
      }
    },
  );
}
