#!/usr/bin/env node
/**
 * TheNewsAPI MCP server — entrypoint.
 *
 * Exposes TheNewsAPI.com read endpoints as MCP tools over stdio, for use with
 * Claude Code / Claude Desktop MCP config.
 *
 * The API token is read from NEWS_API_TOKEN (loaded from .env if present) and is
 * never logged.
 */

import { config as loadEnv } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { NewsApiClient } from "./client.js";
import { registerAllTools } from "./tools/index.js";

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

  const server = new McpServer({
    name: "thenewsapi-mcp",
    version: "0.1.0",
  });

  registerAllTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Diagnostic only — goes to stderr, not the protocol stream.
  console.error("[thenewsapi-mcp] server ready (stdio)");
}

main().catch((err) => {
  console.error("[thenewsapi-mcp] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
