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

## Running on a server (e.g. Cloudways)

This is a **stdio** MCP server: the MCP client launches the process and talks to it over
stdin/stdout. There is no HTTP port and nothing to expose. "Installing on Cloudways"
therefore just means:

1. Use an app/stack with **Node.js 18+** available (set the Node version in the Cloudways
   app settings).
2. `npm install -g @trifecta/thenewsapi-mcp-server` (or `npm install` + `npm run build`
   from a checkout).
3. Set `NEWS_API_TOKEN` in the environment where the process is launched.

Note: a stdio server only helps a client running *on the same machine*. To let a remote
Claude Desktop/Code talk to a server hosted on Cloudways you'd need an HTTP/SSE transport
instead — out of scope for this phase.

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
  index.ts              MCP server entrypoint + tool registration
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
| `npm start` | Run the compiled server. |
| `npm run dev` | Build then run. |
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
