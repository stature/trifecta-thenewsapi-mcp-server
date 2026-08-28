/**
 * get_top_stories -> GET /v1/news/top
 * The current top / trending stories, optionally scoped to a locale.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NewsApiClient } from "../client.js";
import {
  SEARCH_SYNTAX_HELP,
  categoryFilterShape,
  dateFilterShape,
  languageShape,
  localeShape,
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
    .describe(`Optional keyword / phrase query to narrow the top stories. ${SEARCH_SYNTAX_HELP}`),
  search_fields: searchFields.optional(),
  ...localeShape,
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

export function registerGetTopStories(server: McpServer, client: NewsApiClient) {
  server.registerTool(
    "get_top_stories",
    {
      title: "Get top / trending stories",
      description:
        "Get the stories TheNewsAPI currently ranks as top news (GET /v1/news/top). Use this for \"what's the big news right now\", optionally filtered by country via `locale`, by category, or by a keyword query. " +
        "Differs from `search_news` (which searches the whole archive with no trending signal) and from `get_headlines` (which returns articles grouped per category).",
      inputSchema: inputShape,
    },
    safeHandler(async (args: z.objectOutputType<typeof inputShape, z.ZodTypeAny>) => {
      const data = await client.get("news/top", {
        search: args.search,
        search_fields: args.search_fields,
        locale: args.locale,
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
