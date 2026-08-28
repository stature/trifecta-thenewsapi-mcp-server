/**
 * get_headlines -> GET /v1/news/headlines
 * Current headlines grouped by category.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NewsApiClient } from "../client.js";
import { csvList, dateString, languageShape, localeShape } from "../schemas.js";
import { jsonResult, safeHandler } from "./shared.js";

const inputShape = {
  ...localeShape,
  domains: csvList
    .optional()
    .describe('Restrict to these publisher domains. Example: ["bbc.com","reuters.com"].'),
  exclude_domains: csvList.optional().describe("Exclude these publisher domains."),
  source_ids: csvList
    .optional()
    .describe("Restrict to these TheNewsAPI source IDs (from `list_sources`)."),
  exclude_source_ids: csvList
    .optional()
    .describe("Exclude these TheNewsAPI source IDs."),
  ...languageShape,
  published_on: dateString
    .optional()
    .describe("Only headlines published on exactly this date (YYYY-MM-DD)."),
  headlines_per_category: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("How many headlines to return for each category (1-10, default 6)."),
  include_similar: z
    .boolean()
    .optional()
    .describe(
      "When true, include a `similar` array of related articles alongside each headline.",
    ),
};

export function registerGetHeadlines(server: McpServer, client: NewsApiClient) {
  server.registerTool(
    "get_headlines",
    {
      title: "Get headlines by category",
      description:
        "Get current headlines grouped by news category (GET /v1/news/headlines) — the response is keyed by category (general, business, tech, sports, ...), each with its top N articles. " +
        "Use this for a broad \"news briefing\" style overview across topics. For a single ranked list of top stories use `get_top_stories`; for archive search use `search_news`. " +
        "Note: this endpoint does not accept a keyword `search` query.",
      inputSchema: inputShape,
    },
    safeHandler(async (args: z.objectOutputType<typeof inputShape, z.ZodTypeAny>) => {
      const data = await client.get("news/headlines", {
        locale: args.locale,
        domains: args.domains,
        exclude_domains: args.exclude_domains,
        source_ids: args.source_ids,
        exclude_source_ids: args.exclude_source_ids,
        language: args.language,
        published_on: args.published_on,
        headlines_per_category: args.headlines_per_category,
        include_similar: args.include_similar,
      });
      return jsonResult(data);
    }),
  );
}
