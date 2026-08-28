#!/usr/bin/env node
/**
 * TheNewsAPI MCP server — Streamable HTTP entrypoint.
 *
 * Serves the same tools as the stdio entrypoint, but over the MCP
 * "Streamable HTTP" transport so a remote MCP client (e.g. SecureAI / HatzAI)
 * can connect via a URL.
 *
 * Configure the client with:
 *   Server URL:            https://<your-host><MCP_HTTP_PATH>     (default path: /mcp)
 *   Transport:             Streamable HTTP
 *   Authentication Method: Bearer Token   -> value = MCP_AUTH_TOKEN
 *                          (or "API Key"  -> sent as the MCP_API_KEY_HEADER header,
 *                           default header: X-API-Key, value = MCP_AUTH_TOKEN)
 *                          (or "None"     -> leave MCP_AUTH_TOKEN unset)
 *
 * Environment:
 *   NEWS_API_TOKEN       (required) TheNewsAPI token — stays server-side, never sent to clients
 *   MCP_AUTH_TOKEN       (optional) shared secret clients must present; unset = no auth
 *   MCP_API_KEY_HEADER   (optional) header name for API-Key auth (default: x-api-key)
 *   MCP_HTTP_PORT        (optional) listen port (default: 3000; PORT also honoured)
 *   MCP_HTTP_HOST        (optional) bind address (default: 127.0.0.1 — put a TLS proxy in front)
 *   MCP_HTTP_PATH        (optional) MCP route (default: /mcp)
 *   MCP_CORS_ORIGIN      (optional) value for Access-Control-Allow-Origin (e.g. "*"); unset = no CORS headers
 */

import { randomUUID, timingSafeEqual } from "node:crypto";
import { config as loadEnv } from "dotenv";
import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { NewsApiClient } from "./client.js";
import { createMcpServer } from "./server.js";

loadEnv();

const NEWS_API_TOKEN = (process.env.NEWS_API_TOKEN ?? "").trim();
const AUTH_TOKEN = (process.env.MCP_AUTH_TOKEN ?? "").trim();
const API_KEY_HEADER = (process.env.MCP_API_KEY_HEADER ?? "x-api-key")
  .trim()
  .toLowerCase();
const PORT = Number(process.env.MCP_HTTP_PORT ?? process.env.PORT ?? 3000);
const HOST = process.env.MCP_HTTP_HOST ?? "127.0.0.1";
const MCP_PATH = process.env.MCP_HTTP_PATH ?? "/mcp";
const CORS_ORIGIN = (process.env.MCP_CORS_ORIGIN ?? "").trim();

if (!NEWS_API_TOKEN) {
  console.error(
    "[thenewsapi-mcp] NEWS_API_TOKEN is not set. Copy .env.example to .env and add your token from https://www.thenewsapi.com/account/dashboard",
  );
  process.exit(1);
}

const client = new NewsApiClient({ token: NEWS_API_TOKEN });

/** Constant-time string comparison that tolerates length differences. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Returns true if the request is authorised. When it is not, this writes a
 * 401 JSON-RPC error and returns false.
 */
function authorised(req: Request, res: Response): boolean {
  if (!AUTH_TOKEN) return true; // auth disabled ("None")

  const authHeader = req.get("authorization") ?? "";
  const bearer = /^bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim();
  const apiKey = (req.get(API_KEY_HEADER) ?? "").trim();
  const provided = bearer || apiKey;

  if (provided && safeEqual(provided, AUTH_TOKEN)) return true;

  res.status(401).json({
    jsonrpc: "2.0",
    error: {
      code: -32001,
      message:
        "Unauthorized: provide the shared secret as `Authorization: Bearer <token>` or the API-key header.",
    },
    id: null,
  });
  return false;
}

const app = express();
// Behind a local reverse proxy (Caddy/Nginx on the same host) — trust its
// X-Forwarded-* headers so req.ip / req.protocol are accurate.
app.set("trust proxy", "loopback");
app.use(express.json({ limit: "1mb" }));

// Optional permissive-ish CORS for browser-based MCP clients.
if (CORS_ORIGIN) {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", CORS_ORIGIN);
    res.header(
      "Access-Control-Allow-Headers",
      `content-type, authorization, mcp-session-id, mcp-protocol-version, ${API_KEY_HEADER}`,
    );
    res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.header("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
}

// Liveness probe (no auth) — handy for Cloudways / PM2 / uptime checks.
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, server: "thenewsapi-mcp", transport: "streamable-http" });
});

/**
 * Active transports keyed by MCP session id. One in-memory map => run a single
 * process (behind a non–load-balanced proxy, or with sticky sessions).
 */
const transports = new Map<string, StreamableHTTPServerTransport>();

app.post(MCP_PATH, async (req, res) => {
  if (!authorised(req, res)) return;

  try {
    const sessionId = req.get("mcp-session-id");
    let transport: StreamableHTTPServerTransport | undefined = sessionId
      ? transports.get(sessionId)
      : undefined;

    if (!transport) {
      if (sessionId || !isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message:
              "Bad Request: no valid MCP session. Send an `initialize` request first (without mcp-session-id).",
          },
          id: null,
        });
        return;
      }

      // New session: create a transport + a fresh server instance.
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport!);
        },
      });
      transport.onclose = () => {
        if (transport!.sessionId) transports.delete(transport!.sessionId);
      };

      const server = createMcpServer(client);
      await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[thenewsapi-mcp] HTTP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// GET (open SSE stream) and DELETE (end session) reuse the existing transport.
async function handleExistingSession(req: Request, res: Response) {
  if (!authorised(req, res)) return;
  const sessionId = req.get("mcp-session-id");
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: unknown or missing mcp-session-id." },
      id: null,
    });
    return;
  }
  await transport.handleRequest(req, res);
}

app.get(MCP_PATH, handleExistingSession);
app.delete(MCP_PATH, handleExistingSession);

const httpServer = app.listen(PORT, HOST, () => {
  console.error(
    `[thenewsapi-mcp] Streamable HTTP listening on http://${HOST}:${PORT}${MCP_PATH} ` +
      `(auth: ${AUTH_TOKEN ? "required" : "NONE"}${CORS_ORIGIN ? ", CORS on" : ""})`,
  );
});

function shutdown(signal: string) {
  console.error(`[thenewsapi-mcp] ${signal} received, shutting down`);
  for (const transport of transports.values()) {
    void transport.close();
  }
  httpServer.close(() => process.exit(0));
  // Safety net if connections don't drain.
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
