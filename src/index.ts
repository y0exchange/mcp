/**
 * y0 MCP server — stdio transport.
 * For local use with Claude Desktop, Claude Code, Cursor, etc.
 *
 * Usage:
 *   npx @y0exchange/mcp
 *   Y0_API_KEY=y0_... npx @y0exchange/mcp
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { resolveSession } from './lib/session.js';

async function main() {
  if (process.env.Y0_API_KEY) {
    try {
      const session = await resolveSession();
      console.error(`y0 MCP: authenticated as ${session.userAddress}`);
    } catch (err) {
      console.error(`y0 MCP: warning — failed to resolve session: ${err}`);
      console.error('y0 MCP: write tools (swap, send) will not work without a valid Y0_API_KEY');
    }
  } else {
    console.error('y0 MCP: no Y0_API_KEY set — running in read-only mode');
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('y0 MCP server running on stdio');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
