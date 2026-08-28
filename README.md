# TheNewsAPI MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes the read endpoints of
**[TheNewsAPI.com](https://www.thenewsapi.com)** as tools, so an AI assistant (Claude
Code, Claude Desktop, or any MCP client) can query news articles from natural-language
prompts.

> This targets **TheNewsAPI.com** (`https://api.thenewsapi.com/v1/`) — *not* the
> unrelated `newsapi.org` service.

npm package: `@trifecta/thenewsapi-mcp-server` (not yet published).

## Tools

| Tool | Endpoint | Purpose |
| --- | --- | --- |
| `search_news` | `GET /v1/news/all` | Full-archive keyword/boolean search across all articles. |
| `get_top_stories` | `GET /v1/news/top` | Current top / trending stories, optionally by `locale`. |
| `get_headlines` | `GET /v1/news/headlines` | Current headlines grouped by category. |
| `get_similar_articles` | `GET /v1/news/similar/{uuid}` | Other coverage of the same story as a given article. |
| `get_article_by_uuid` | `GET /v1/news/uuid/{uuid}` | Fetch one article by its UUID. |
| `list_sources` | `GET /v1/news/sources` | Enumerate indexed publishers and their `source_id`s. |

### Boolean search syntax (`search` param)

`search_news` and `get_top_stories` accept a boolean query:

| Operator | Meaning | Example |
| --- | --- | --- |
| `+` | term is required (AND) | `+bitcoin +etf` |
| `\|` | either term (OR) | `apple \| microsoft` |
| `-` | exclude term | `+tesla -musk` |
| `"..."` | exact phrase | `+"artificial intelligence"` |
| `( )` | group | `(tesla \| rivian) +earnings` |

Bare space-separated words are treated as OR.

## Requirements

- **Node.js 18 or newer** (the MCP SDK and the native `fetch` used for HTTP calls both
  require it). Check with `node --version`; upgrade via [nvm](https://github.com/nvm-sh/nvm)
  (`nvm install 20 && nvm use 20`) or [nodejs.org](https://nodejs.org).
- A free or paid TheNewsAPI account.

## Getting an API token

1. Register at <https://www.thenewsapi.com/register>.
2. Open your dashboard: <https://www.thenewsapi.com/account/dashboard>.
3. Copy the **API Token**.

Free-plan notes: the free tier caps `limit` at 3 articles per request and has a low
monthly quota; some endpoints/parameters are paid-only and will return
`endpoint_access_restricted`.

The token is supplied by each user at runtime via the `NEWS_API_TOKEN` environment
variable. It is never bundled into the package and never logged by the server.

---

## Install & configure — published package (for end users, once on npm)

No clone or build needed. Point your MCP client at the package via `npx`.

### Claude Code

```bash
claude mcp add thenewsapi \
  --env NEWS_API_TOKEN=your_token_here \
  -- npx -y @trifecta/thenewsapi-mcp-server
```

Then run `claude`, check `/mcp` — `thenewsapi` should be connected with 6 tools.

### Claude Desktop

Edit `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "thenewsapi": {
      "command": "npx",
      "args": ["-y", "@trifecta/thenewsapi-mcp-server"],
      "env": { "NEWS_API_TOKEN": "your_token_here" }
    }
  }
}
```

Restart Claude Desktop.

### Global install alternative

```bash
npm install -g @trifecta/thenewsapi-mcp-server
# then use command "thenewsapi-mcp-server" instead of "npx -y @trifecta/..."
```

---

## Local development setup (while unpublished)

```bash
git clone https://github.com/stature/trifecta-thenewsapi-mcp-server.git
cd trifecta-thenewsapi-mcp-server

npm install
cp .env.example .env
# edit .env and set NEWS_API_TOKEN=...

npm run build
```

`.env` is gitignored — keep the real token there, never in `.env.example`.

Quick check that it starts:

```bash
npm start
# -> "[thenewsapi-mcp] server ready (stdio)" on stderr, then Ctrl-C
```

Point Claude Code at your local build:

```bash
claude mcp add thenewsapi \
  --env NEWS_API_TOKEN=your_token_here \
  -- node /absolute/path/to/newsapi-mcp/dist/index.js
```

Or the config JSON directly (`~/.claude.json`, or `.mcp.json` in a project):

```jsonc
{
  "mcpServers": {
    "thenewsapi": {
      "command": "node",
      "args": ["/absolute/path/to/newsapi-mcp/dist/index.js"],
      "env": { "NEWS_API_TOKEN": "your_token_here" }
    }
  }
}
```

---

## Remote deployment — Streamable HTTP (SecureAI / HatzAI and other HTTP MCP clients)

Two entrypoints ship in this package:

| Entrypoint | Transport | Use with |
| --- | --- | --- |
| `dist/index.js` (`npm start`) | stdio | Claude Code / Claude Desktop (client spawns it locally) |
| `dist/http.js` (`npm run start:http`) | Streamable HTTP | SecureAI / HatzAI, or any client that takes a **Server URL** |

The HTTP server keeps `NEWS_API_TOKEN` entirely server-side; remote clients authenticate
with a **separate** shared secret (`MCP_AUTH_TOKEN`) and never see the TheNewsAPI token.

### Configuration (env vars)

| Var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NEWS_API_TOKEN` | yes | — | TheNewsAPI token (server-side only). |
| `MCP_AUTH_TOKEN` | recommended | _(none)_ | Shared secret clients must send. Unset = **no auth**. |
| `MCP_API_KEY_HEADER` | no | `x-api-key` | Header accepted for "API Key" style auth. |
| `MCP_HTTP_PORT` | no | `3000` | Listen port (`PORT` also honoured). |
| `MCP_HTTP_HOST` | no | `127.0.0.1` | Bind address — keep on loopback behind a TLS proxy. |
| `MCP_HTTP_PATH` | no | `/mcp` | Route the MCP endpoint is served on. |
| `MCP_CORS_ORIGIN` | no | _(none)_ | Set to an origin or `*` to emit CORS headers. |

`GET /healthz` is an unauthenticated liveness probe.

### Point SecureAI / HatzAI at it

In the custom connection form:

| Field | Value |
| --- | --- |
| **Server URL** | `https://your-domain.example/mcp` (must be HTTPS in production) |
| **Transport** | Streamable HTTP |
| **Authentication Method** | `Bearer Token` → token = your `MCP_AUTH_TOKEN` value |
| | _or_ `API Key` → key = your `MCP_AUTH_TOKEN` value, sent as `X-API-Key` |
| | _or_ `None` → only if `MCP_AUTH_TOKEN` is unset and the URL is not public |

### Try it locally first

```bash
cp .env.example .env
# set NEWS_API_TOKEN=... and MCP_AUTH_TOKEN=some-long-random-string
npm run dev:http
# -> [thenewsapi-mcp] Streamable HTTP listening on http://127.0.0.1:3000/mcp (auth: required)
```

```bash
# handshake check
curl -sD- http://127.0.0.1:3000/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'authorization: Bearer some-long-random-string' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
# 200 + an `mcp-session-id` response header + the server capabilities
```

### Deploy on an Oracle Cloud "Always Free" VM + Caddy

The recommended host: a free, always-on VM with Caddy terminating TLS (automatic
Let's Encrypt certs) and reverse-proxying to the Node process managed by systemd.

Config templates live in [`deploy/`](deploy/):

- `deploy/Caddyfile` → `/etc/caddy/Caddyfile`
- `deploy/thenewsapi-mcp.service` → `/etc/systemd/system/`
- `deploy/env.production.example` → `/opt/thenewsapi-mcp/.env`

**Full step-by-step (VM creation, both Oracle firewalls, DNS, TLS, verification):
[`deploy/README.md`](deploy/README.md).** Outline:

1. Create an Ubuntu 22.04 `VM.Standard.A1.Flex` (Ampere) instance; reserve its public IP.
2. Open TCP 80 + 443 in **both** the VCN Security List *and* the instance `iptables`.
3. Install Node 20 (NodeSource) and Caddy (apt).
4. Point a domain's A record at the VM.
5. Clone to `/opt/thenewsapi-mcp`, `npm ci && npm run build`, create `.env` (with an
   `openssl rand -hex 32` value for `MCP_AUTH_TOKEN`), `chmod 600`.
6. Install the systemd unit: `systemctl enable --now thenewsapi-mcp`.
7. Install the Caddyfile (swap in your domain), `systemctl restart caddy`.
8. Verify `https://your-domain/mcp` with the `curl` handshake above, then add it to
   SecureAI.

No domain? `deploy/README.md` Appendix A covers a free DuckDNS hostname.

Scaling note: sessions are held in memory in one process — perfect for a single
always-on VM. Multiple instances would need sticky-session routing.

## Example prompts

- "Search the news for articles about the EU AI Act from the last two weeks, English only."
- "What are the top business stories in the US right now?"
- "Give me a news briefing — headlines across tech, business, and science."
- "Find coverage of `+\"interest rate\" +\"Federal Reserve\" -crypto` sorted by relevance."
- "Get everything from nytimes.com and bbc.com about the Mars sample return mission."
- "Here's an article UUID `abc-123` — find other outlets covering the same story."
- "List the news sources you can access in the `tech` category."
- "Fetch the full article with UUID `abc-123`."

## Error handling

TheNewsAPI's documented error codes are surfaced back to the assistant with guidance
and a retryable flag:

| Code | Retryable | Meaning |
| --- | --- | --- |
| `malformed_parameters` | no | Bad parameter name/format — fix and retry. |
| `invalid_api_token` | no | `NEWS_API_TOKEN` missing/invalid. |
| `usage_limit_reached` | no | Monthly quota exhausted. |
| `endpoint_access_restricted` | no | Not available on current plan. |
| `resource_not_found` | no | UUID / resource does not exist. |
| `rate_limit_reached` | yes | Per-second rate limit — wait and retry. |
| `server_error` | yes | Transient upstream error. |
| `maintenance_mode` | yes | API temporarily down. |

## Project layout

```
src/
  index.ts              stdio entrypoint (Claude Code / Desktop)
  http.ts               Streamable HTTP entrypoint (SecureAI / remote clients) + auth
  server.ts             shared McpServer factory used by both entrypoints
  client.ts             API client wrapper: base URL, auth, query building, error mapping
  errors.ts             NewsApiError + documented error-code translation
  schemas.ts            Shared zod schema fragments (filters, pagination, search help)
  tools/
    shared.ts           safeHandler wrapper + JSON result formatter
    search-news.ts
    get-top-stories.ts
    get-headlines.ts
    get-similar-articles.ts
    get-article-by-uuid.ts
    list-sources.ts
```

Compiled output goes to `dist/`. Only `dist/`, `README.md`, and `LICENSE` are included
in the published package (see `files` in `package.json`).

## Scripts

| Script | Action |
| --- | --- |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm run watch` | Recompile on change. |
| `npm run typecheck` | Type-check without emitting. |
| `npm run clean` | Remove `dist/`. |
| `npm start` | Run the compiled stdio server. |
| `npm run start:http` | Run the compiled Streamable HTTP server. |
| `npm run dev` | Build then run (stdio). |
| `npm run dev:http` | Build then run (HTTP). |
| `prepublishOnly` | Auto-runs `clean` + `build` before `npm publish`. |

## Publishing

```bash
npm run typecheck
npm publish            # scoped package; publishConfig.access is already "public"
```

Before the first publish: make sure you're a member of the `@trifecta` npm org. Repo:
<https://github.com/stature/trifecta-thenewsapi-mcp-server>.

Versioning: starts at `0.1.0` (pre-1.0 — the tool surface may still change). Follow semver
afterwards.

## Out of scope (this phase)

No database, caching, webhooks, or downstream integrations — just the read endpoints
as MCP tools.

## License

MIT — see [LICENSE](LICENSE).
