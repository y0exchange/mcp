/**
 * Shared MCP server factory.
 * Creates and configures the McpServer with all tools registered.
 * Used by both stdio (index.ts) and remote HTTP (remote.ts) entry points.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetBalance } from './tools/get-balance.js';
import { registerGetPortfolio } from './tools/get-portfolio.js';
import { registerGetPrice } from './tools/get-price.js';
import { registerGetQuote } from './tools/get-quote.js';
import { registerGetGas } from './tools/get-gas.js';
import { registerGetHistory } from './tools/get-history.js';
import { registerSwap } from './tools/swap.js';
import { registerSend } from './tools/send.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'y0-exchange',
    version: '0.2.0',
  });

  // Read-only tools
  registerGetBalance(server);
  registerGetPortfolio(server);
  registerGetPrice(server);
  registerGetQuote(server);
  registerGetGas(server);
  registerGetHistory(server);

  // Write tools (non-custodial: builds unsigned tx → user signs on device)
  registerSwap(server);
  registerSend(server);

  return server;
}
