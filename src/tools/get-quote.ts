import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { parseUnits } from 'viem';
import { getTokensByChainId, type Token } from '@y0exchange/shared/tokens';

const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY;
const ZEROX_API_KEY = process.env.ZEROX_API_KEY;
const ONEINCH_REFERRER = process.env.ONEINCH_REFERRER_ADDRESS || '';
const ZEROX_AFFILIATE = process.env.ZEROX_AFFILIATE_ADDRESS || '';

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

async function fetchOneinchQuote(chainId: number, src: string, dst: string, amount: string) {
  const referrerParam = ONEINCH_REFERRER ? `&referrer=${ONEINCH_REFERRER}` : '';
  const url = `https://api.1inch.dev/swap/v6.0/${chainId}/quote?src=${src}&dst=${dst}&amount=${amount}${referrerParam}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ONEINCH_API_KEY}`, Accept: 'application/json' },
  });
  if (!res.ok) return undefined;
  const data = await res.json();
  return {
    toAmount: data.toAmount || data.dstAmount,
    estimatedGas: data.gas || data.estimatedGas || '0',
    protocol: '1inch' as const,
  };
}

async function fetchZeroxQuote(chainId: number, sellToken: string, buyToken: string, sellAmount: string) {
  const affiliateParam = ZEROX_AFFILIATE ? `&feeRecipient=${ZEROX_AFFILIATE}&buyTokenPercentageFee=0` : '';
  const url = `https://api.0x.org/swap/permit2/quote?chainId=${chainId}&sellToken=${sellToken}&buyToken=${buyToken}&sellAmount=${sellAmount}${affiliateParam}`;
  const res = await fetch(url, {
    headers: { '0x-api-key': ZEROX_API_KEY!, Accept: 'application/json' },
  });
  if (!res.ok) return undefined;
  const data = await res.json();
  return {
    toAmount: data.buyAmount,
    estimatedGas: data.gas || data.estimatedGas || '0',
    protocol: '0x' as const,
  };
}

export function registerGetQuote(server: McpServer) {
  server.tool(
    'get_quote',
    'Get a swap quote with routing preview. Shows expected output, fees, and estimated gas. Does NOT execute — read-only price check.',
    {
      sellToken: z.string().describe('Token to sell — symbol (e.g. "USDC") or contract address'),
      buyToken: z.string().describe('Token to buy — symbol or contract address'),
      sellAmount: z.string().describe('Amount to sell in human-readable units (e.g. "100" for 100 USDC)'),
      chainId: z.number().optional().describe('Chain ID (default: 1)'),
    },
    async ({ sellToken, buyToken, sellAmount, chainId = 1 }) => {
      const sell = findToken(sellToken, chainId);
      const buy = findToken(buyToken, chainId);
      const sellAddr = resolveAddress(sell, sellToken);
      const buyAddr = resolveAddress(buy, buyToken);
      const sellDecimals = sell?.decimals ?? 18;
      const buyDecimals = buy?.decimals ?? 18;

      let amountWei: string;
      try {
        amountWei = parseUnits(sellAmount, sellDecimals).toString();
      } catch {
        return { content: [{ type: 'text', text: `Invalid amount: ${sellAmount}` }], isError: true };
      }

      let quote;
      if (ZEROX_API_KEY) {
        try { quote = await fetchZeroxQuote(chainId, sellAddr, buyAddr, amountWei); } catch { /* fallthrough */ }
      }
      if (!quote && ONEINCH_API_KEY) {
        try { quote = await fetchOneinchQuote(chainId, sellAddr, buyAddr, amountWei); } catch { /* fallthrough */ }
      }

      if (!quote) {
        const reason = !ZEROX_API_KEY && !ONEINCH_API_KEY
          ? 'No swap API keys configured. Set ZEROX_API_KEY or ONEINCH_API_KEY environment variable.'
          : 'Failed to get quote from swap providers.';
        return { content: [{ type: 'text', text: reason }], isError: true };
      }

      const outputFormatted = (Number(quote.toAmount) / 10 ** buyDecimals).toFixed(6);
      const sellSymbol = sell?.symbol ?? sellToken;
      const buySymbol = buy?.symbol ?? buyToken;
      const rate = (Number(outputFormatted) / Number(sellAmount)).toFixed(6);

      const text = [
        `Swap quote on chain ${chainId} via ${quote.protocol}:`,
        `  Sell: ${sellAmount} ${sellSymbol}`,
        `  Get:  ${outputFormatted} ${buySymbol}`,
        `  Rate: 1 ${sellSymbol} ≈ ${rate} ${buySymbol}`,
        `  Estimated gas: ${quote.estimatedGas}`,
        '',
        'This is a quote only. Use the swap tool to execute.',
      ].join('\n');

      return { content: [{ type: 'text', text }] };
    },
  );
}
