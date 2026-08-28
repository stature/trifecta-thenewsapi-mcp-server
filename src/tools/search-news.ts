/**
 * search_news -> GET /v1/news/all
 * Full-archive search across all articles TheNewsAPI has indexed.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NewsApiClient } from "../client.js";
import {
  SEARCH_SYNTAX_HELP,
  categoryFilterShape,
  dateFilterShape,
  languageShape,
  paginationShape,
  searchFields,
  sourceFilterShape,
} from "../schemas.js";
import { jsonResult, safeHandler } from "./shared.js";

const inputShape = {
  search: z
    .string()
    .min(1)
    .optional()
    .describe(`Keyword / phrase query. ${SEARCH_SYNTAX_HELP}`),
  search_fields: searchFields.optional(),
  ...categoryFilterShape,
  ...sourceFilterShape,
  ...languageShape,
  ...dateFilterShape,
  sort: z
    .enum(["published_at", "relevance_score"])
    .optional()
    .describe(
      "Result ordering. `published_at` (default) = newest first; `relevance_score` = best keyword match first (only meaningful with `search`).",
    ),
  ...paginationShape,
};

export function registerSearchNews(server: McpServer, client: NewsApiClient) {
  server.registerTool(
    "search_news",
    {
      title: "Search news articles",
      description:
        "Search the full TheNewsAPI article archive (GET /v1/news/all). Use this for open-ended research: finding articles about a topic, company, person, or event across all publishers and dates. " +
        "Supports rich boolean keyword search, plus filtering by category, publisher domain, source ID, language, and publish date, with pagination. " +
        "For the current front-page/breaking selection use `get_top_stories`; for per-category headline groupings use `get_headlines`.",
      inputSchema: inputShape,
    },
    safeHandler(async (args: z.objectOutputType<typeof inputShape, z.ZodTypeAny>) => {
      const data = await client.get("news/all", {
        search: args.search,
        search_fields: args.search_fields,
        categories: args.categories,
        exclude_categories: args.exclude_categories,
        domains: args.domains,
        exclude_domains: args.exclude_domains,
        source_ids: args.source_ids,
        exclude_source_ids: args.exclude_source_ids,
        language: args.language,
        published_before: args.published_before,
        published_after: args.published_after,
        published_on: args.published_on,
        sort: args.sort,
        limit: args.limit,
        page: args.page,
      });
      return jsonResult(data);
    }),
  );
}
