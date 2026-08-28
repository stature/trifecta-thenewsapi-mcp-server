/** Register every tool on the MCP server. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NewsApiClient } from "../client.js";

import { registerSearchNews } from "./search-news.js";
import { registerGetTopStories } from "./get-top-stories.js";
import { registerGetHeadlines } from "./get-headlines.js";
import { registerGetSimilarArticles } from "./get-similar-articles.js";
import { registerGetArticleByUuid } from "./get-article-by-uuid.js";
import { registerListSources } from "./list-sources.js";

export function registerAllTools(server: McpServer, client: NewsApiClient) {
  registerSearchNews(server, client);
  registerGetTopStories(server, client);
  registerGetHeadlines(server, client);
  registerGetSimilarArticles(server, client);
  registerGetArticleByUuid(server, client);
  registerListSources(server, client);
}
