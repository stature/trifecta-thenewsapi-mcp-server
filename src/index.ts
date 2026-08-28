#!/usr/bin/env node
/**
 * TheNewsAPI MCP server — stdio entrypoint.
 *
 * Exposes TheNewsAPI.com read endpoints as MCP tools over stdio, for use with
 * Claude Code / Claude Desktop MCP config (the client spawns this process).
 *
 * For a remote, network-reachable server (Streamable HTTP), use `dist/http.js`
 * (`npm run start:http`) instead.
 *
 * The API token is read from NEWS_API_TOKEN (loaded from .env if present) and is
 * never logged.
 */

import { config as loadEnv } from "dotenv";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { NewsApiClient } from "./client.js";
import { createMcpServer } from "./server.js";

loadEnv();

async function main() {
  const token = process.env.NEWS_API_TOKEN ?? "";
  if (!token.trim()) {
    // Fail fast with a clear message on stderr (stdout is the MCP channel).
    console.error(
      "[thenewsapi-mcp] NEWS_API_TOKEN is not set. Copy .env.example to .env and add your token from https://www.thenewsapi.com/account/dashboard",
    );
    process.exit(1);
  }

  const client = new NewsApiClient({ token });
  const server = createMcpServer(client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Diagnostic only — goes to stderr, not the protocol stream.
  console.error("[thenewsapi-mcp] server ready (stdio)");
}

main().catch((err) => {
  console.error("[thenewsapi-mcp] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
