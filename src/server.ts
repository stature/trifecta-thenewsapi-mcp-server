/**
 * Shared MCP server factory.
 *
 * Both entrypoints use this:
 *   - src/index.ts  -> stdio transport (local, spawned by the MCP client)
 *   - src/http.ts   -> Streamable HTTP transport (remote, e.g. SecureAI / HatzAI)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NewsApiClient } from "./client.js";
import { registerAllTools } from "./tools/index.js";

export const SERVER_NAME = "thenewsapi-mcp";
export const SERVER_VERSION = "0.1.0";

export function createMcpServer(client: NewsApiClient): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  registerAllTools(server, client);
  return server;
}
