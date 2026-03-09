import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getTokensByChainId, type Token } from '@y0exchange/shared/tokens';
import { resolveSession, getApiKey, getSigningServiceUrl } from '../lib/session.js';

function findToken(query: string, chainId: number): Token | undefined {
  const tokens = getTokensByChainId(chainId);
  const lower = query.toLowerCase();
  return tokens.find(
    (t: any) => t.symbol.toLowerCase() === lower || t.address.toLowerCase() === lower,
  );
}

export function registerSend(server: McpServer) {
  server.tool(
    'send',
    'Build an unsigned transfer transaction. Supports native tokens and ERC-20. The user will approve and sign on their device. Requires Y0_API_KEY to be configured.',
    {
      toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe('Recipient wallet address'),
      token: z.string().describe('Token to send — symbol (e.g. "ETH", "USDC") or contract address'),
      amount: z.string().describe('Amount in human-readable units (e.g. "1.5" for 1.5 ETH)'),
      chainId: z.number().optional().describe('Chain ID (default: 1)'),
    },
    async ({ toAddress, token, amount, chainId = 1 }) => {
      let session;
      try {
        session = await resolveSession();
      } catch (err) {
        return { content: [{ type: 'text', text: `Authentication error: ${err}. Set Y0_API_KEY in your MCP config.` }], isError: true };
      }

      if (!session.permissions.send) {
        return { content: [{ type: 'text', text: 'This API key does not have send permissions.' }], isError: true };
      }

      const tokenInfo = findToken(token, chainId);
      const tokenAddress = tokenInfo?.address ?? token;
      const decimals = tokenInfo?.decimals ?? 18;
      const symbol = tokenInfo?.symbol ?? token;

      try {
        const res = await fetch(`${getSigningServiceUrl()}/api/build/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getApiKey()}`,
          },
          body: JSON.stringify({
            chainId,
            toAddress,
            tokenAddress,
            amount,
            decimals,
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          return { content: [{ type: 'text', text: `Failed to build send: ${err}` }], isError: true };
        }

        const tx = await res.json();

        const text = [
          `Transfer transaction created and sent to user for approval.`,
          '',
          `Transaction ID: ${tx.id}`,
          `From: ${session.userAddress}`,
          `Send: ${amount} ${symbol} to ${toAddress}`,
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
