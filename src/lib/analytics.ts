/**
 * Analytics logger — sends MCP tool call events to Payload CMS.
 * Fire-and-forget: never blocks the MCP response.
 */

import { createHash } from 'node:crypto';

const PAYLOAD_URL = process.env.MCP_PAYLOAD_URL ?? 'http://localhost:3001';
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN ?? '';

if (!INTERNAL_TOKEN) {
  console.warn('[analytics] INTERNAL_API_TOKEN is not set — MCP analytics will be disabled');
} else {
  console.log(`[analytics] Analytics enabled, sending to ${PAYLOAD_URL}`);
}

interface McpRequestEvent {
  tool: string;
  method: string;
  userIdentifier?: string;
  userAddress?: string;
  statusCode: number;
  isError: boolean;
  duration: number;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  ip?: string;
  userAgent?: string;
}

/** Hash sensitive identifiers (API keys) before storing */
export function hashIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

/**
 * Parse the JSON-RPC body to extract tool call info.
 * MCP protocol uses JSON-RPC 2.0 with method "tools/call".
 */
export function parseToolCall(body: unknown): { method: string; tool: string; args: Record<string, unknown> } | null {
  if (!body || typeof body !== 'object') return null;

  const rpc = body as Record<string, unknown>;
  const method = rpc.method as string | undefined;

  if (!method) return null;

  // tools/call is the main one we want to track
  if (method === 'tools/call') {
    const params = rpc.params as Record<string, unknown> | undefined;
    return {
      method,
      tool: (params?.name as string) ?? 'unknown',
      args: (params?.arguments as Record<string, unknown>) ?? {},
    };
  }

  // Also track other MCP methods (tools/list, initialize, etc.)
  return { method, tool: method, args: {} };
}

/** Sanitize tool args — remove secrets, keep useful info */
function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...args };
  // Remove any potential secret fields
  for (const key of ['apiKey', 'privateKey', 'secret', 'password', 'token']) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

/** Truncate a result value to avoid storing excessively large payloads (max ~8 KB JSON) */
function truncateResult(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  const json = JSON.stringify(value);
  if (json.length <= 8192) return value;
  return { _truncated: true, preview: json.slice(0, 8192) };
}

/** Fire-and-forget log to Payload CMS */
export async function logMcpRequest(event: McpRequestEvent): Promise<void> {
  if (!INTERNAL_TOKEN) {
    console.warn('[analytics] Skipping log — no INTERNAL_API_TOKEN');
    return;
  }

  try {
    const res = await fetch(`${PAYLOAD_URL}/api/mcp-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN,
      },
      body: JSON.stringify({
        tool: event.tool,
        method: event.method,
        userIdentifier: event.userIdentifier,
        userAddress: event.userAddress,
        statusCode: event.statusCode,
        isError: event.isError,
        duration: event.duration,
        toolArgs: event.toolArgs ? sanitizeArgs(event.toolArgs) : undefined,
        toolResult: event.toolResult !== undefined ? truncateResult(event.toolResult) : undefined,
        ip: event.ip,
        userAgent: event.userAgent,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[analytics] Payload responded ${res.status}: ${body}`);
    }
  } catch (err) {
    // Never let analytics break the MCP server
    console.error('[analytics] Log failed:', err);
  }
}
