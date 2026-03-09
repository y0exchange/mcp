// CoinGecko API client with caching

import { cacheGet, cacheSet } from './cache.js';

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

const BASE_URL = COINGECKO_API_KEY
  ? 'https://pro-api.coingecko.com/api/v3'
  : 'https://api.coingecko.com/api/v3';

function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json' };
  if (COINGECKO_API_KEY) h['x-cg-pro-api-key'] = COINGECKO_API_KEY;
  return h;
}

export interface PriceData {
  usd: number;
  usd_24h_change?: number;
}

// Prices by CoinGecko IDs (30s cache)
export async function getPricesByIds(ids: string[]): Promise<Record<string, PriceData>> {
  const key = `price:ids:${ids.sort().join(',')}`;
  const cached = cacheGet<Record<string, PriceData>>(key, 30_000);
  if (cached) return cached;

  const url = `${BASE_URL}/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);

  const data = await res.json();
  cacheSet(key, data);
  return data;
}

// CoinGecko platform IDs per chain
const CHAIN_TO_PLATFORM: Record<number, string> = {
  1: 'ethereum',
  56: 'binance-smart-chain',
  42161: 'arbitrum-one',
  8453: 'base',
  137: 'polygon-pos',
};

// Prices by contract addresses (30s cache)
export async function getPricesByAddresses(
  chainId: number,
  addresses: string[],
): Promise<Record<string, PriceData>> {
  const platform = CHAIN_TO_PLATFORM[chainId];
  if (!platform) throw new Error(`Unsupported chain for price lookup: ${chainId}`);

  const key = `price:addr:${chainId}:${addresses.sort().join(',')}`;
  const cached = cacheGet<Record<string, PriceData>>(key, 30_000);
  if (cached) return cached;

  const url = `${BASE_URL}/simple/token_price/${platform}?contract_addresses=${addresses.join(',')}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);

  const data = await res.json();
  cacheSet(key, data);
  return data;
}
