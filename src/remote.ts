/**
 * y0 MCP server — Streamable HTTP transport.
 * For remote use as a Claude connector (claude.ai, Claude Mobile, Claude Code).
 *
 * Deploy this as a web service and add as custom connector:
 *   claude mcp add --transport http y0 https://mcp.y0.exchange/mcp?key=YOUR_API_KEY
 *
 * Stateless mode: each request creates a fresh server instance.
 * This is serverless-friendly and avoids session affinity requirements.
 */

import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';
import { runWithApiKey } from './lib/session.js';
import { logMcpRequest, parseToolCall, hashIdentifier } from './lib/analytics.js';

const PORT = parseInt(process.env.PORT || '3100', 10);
const app = express();

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'y0-mcp-remote', version: '0.2.0' });
});

// MCP endpoint — Streamable HTTP (stateless)
app.post('/mcp', async (req, res) => {
  // Extract API key: query param (?key=…) for Claude.ai connectors,
  // or Authorization header (Bearer …) for programmatic clients.
  const authHeader = req.headers.authorization;
  const apiKey =
    (req.query.key as string | undefined) ||
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

  const startTime = Date.now();
  const toolCall = parseToolCall(req.body);

  // Capture response body to extract tool result for analytics
  const resChunks: Buffer[] = [];
  const origWrite = res.write;
  const origEnd = res.end;
  res.write = function (chunk: unknown, ...args: unknown[]) {
    if (chunk) resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    return origWrite.apply(res, [chunk, ...args] as never);
  } as typeof res.write;
  res.end = function (chunk: unknown, ...args: unknown[]) {
    if (chunk) resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    return origEnd.apply(res, [chunk, ...args] as never);
  } as typeof res.end;

  function extractResult(): unknown {
    if (!resChunks.length) return undefined;
    try {
      const body = Buffer.concat(resChunks).toString('utf8');
      const parsed = JSON.parse(body);
      return parsed?.result ?? parsed?.error ?? undefined;
    } catch {
      return undefined;
    }
  }

  const handler = async () => {
    try {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless — no session management
      });

      res.on('close', () => {
        transport.close();
        server.close();

        // Fire-and-forget analytics
        if (toolCall) {
          logMcpRequest({
            tool: toolCall.tool,
            method: toolCall.method,
            userIdentifier: apiKey ? hashIdentifier(apiKey) : undefined,
            statusCode: res.statusCode,
            isError: res.statusCode >= 400,
            duration: Date.now() - startTime,
            toolArgs: toolCall.args,
            toolResult: extractResult(),
            ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
          });
        }
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP request error:', error);

      // Log failed requests too
      if (toolCall) {
        logMcpRequest({
          tool: toolCall.tool,
          method: toolCall.method,
          userIdentifier: apiKey ? hashIdentifier(apiKey) : undefined,
          statusCode: 500,
          isError: true,
          duration: Date.now() - startTime,
          toolArgs: toolCall.args,
          toolResult: extractResult(),
          ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        });
      }

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  };

  // If caller provided an API key, run within per-request context
  if (apiKey) {
    await runWithApiKey(apiKey, handler);
  } else {
    await handler();
  }
});

// Handle GET for SSE streams (required by spec for server-initiated messages)
app.get('/mcp', async (_req, res) => {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'SSE not supported in stateless mode. Use POST.' },
    id: null,
  }));
});

// Handle DELETE for session termination
app.delete('/mcp', async (_req, res) => {
  // Stateless — nothing to clean up
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`y0 MCP remote server listening on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
