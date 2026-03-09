import { AsyncLocalStorage } from 'node:async_hooks';

const SIGNING_SERVICE_URL = process.env.SIGNING_SERVICE_URL ?? 'http://localhost:3002';
const ENV_API_KEY = process.env.Y0_API_KEY;

/**
 * Per-request API key store.
 * Remote HTTP transport sets this via runWithApiKey() so each request
 * uses the caller's own key instead of the server-wide env var.
 */
const apiKeyStore = new AsyncLocalStorage<string>();

/**
 * Run a function with a per-request API key (used by remote transport).
 */
export function runWithApiKey<T>(apiKey: string, fn: () => T): T {
  return apiKeyStore.run(apiKey, fn);
}

/**
 * Get the effective API key: per-request first, then env var.
 */
function getEffectiveApiKey(): string | undefined {
  return apiKeyStore.getStore() || ENV_API_KEY;
}

export interface UserSession {
  sessionId: string;
  userAddress: string;
  permissions: {
    read: boolean;
    swap: boolean;
    send: boolean;
    bridge: boolean;
    approve: boolean;
  };
  spendingLimits?: {
    maxPerTx: string;
    maxDaily: string;
    currency: string;
  };
}

/** Cache sessions per API key to avoid cross-request leaks. */
const sessionCache = new Map<string, UserSession>();

/**
 * Resolve the user session from the API key.
 * Caches per key so we don't hit the signing service on every tool call.
 */
export async function resolveSession(): Promise<UserSession> {
  const apiKey = getEffectiveApiKey();

  if (!apiKey) {
    throw new Error(
      'Y0_API_KEY is not set. Generate an API key at https://y0.exchange and add it to your MCP config.',
    );
  }

  const cached = sessionCache.get(apiKey);
  if (cached) return cached;

  const res = await fetch(`${SIGNING_SERVICE_URL}/api/sessions/me`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to resolve session: ${res.status} ${body}`);
  }

  const session = (await res.json()) as UserSession;
  sessionCache.set(apiKey, session);
  return session;
}

/**
 * Try to resolve the user's wallet address from the API key session.
 * Returns undefined if no API key is available (instead of throwing).
 */
export async function tryResolveAddress(): Promise<string | undefined> {
  const apiKey = getEffectiveApiKey();
  if (!apiKey) return undefined;
  try {
    const session = await resolveSession();
    return session.userAddress;
  } catch {
    return undefined;
  }
}

/**
 * Get the API key for forwarding to signing service.
 */
export function getApiKey(): string {
  const apiKey = getEffectiveApiKey();
  if (!apiKey) {
    throw new Error('Y0_API_KEY is not set.');
  }
  return apiKey;
}

/**
 * Get signing service URL.
 */
export function getSigningServiceUrl(): string {
  return SIGNING_SERVICE_URL;
}
