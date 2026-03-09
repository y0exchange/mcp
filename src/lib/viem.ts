// Shared viem client factory

import { createPublicClient, http, type Chain as ViemChain } from 'viem';
import { CHAINS, getChain } from '@y0exchange/shared/chains';

// Convert our chain config to viem-compatible chain object
export function toViemChain(chainId: number): ViemChain {
  const chain = getChain(chainId);
  if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);
  return {
    id: chain.id,
    name: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: { default: { http: [chain.rpcUrl] } },
  } as ViemChain;
}

// Create a public client for a chain (no caching — lightweight)
export function getPublicClient(chainId: number) {
  return createPublicClient({
    chain: toViemChain(chainId),
    transport: http(),
  });
}

// All chain IDs we support
export const SUPPORTED_CHAIN_IDS = Object.values(CHAINS).map((c: any) => c.id);
