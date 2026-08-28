/**
 * get_similar_articles -> GET /v1/news/similar/{uuid}
 * Articles covering the same story as a given article.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NewsApiClient } from "../client.js";
import {
  categoryFilterShape,
  dateFilterShape,
  languageShape,
  paginationShape,
  sourceFilterShape,
} from "../schemas.js";
import { jsonResult, safeHandler } from "./shared.js";

const inputShape = {
  uuid: z
    .string()
    .min(1)
    .describe(
      "The UUID of the reference article (from the `uuid` field of any article returned by the other tools).",
    ),
  ...categoryFilterShape,
  ...sourceFilterShape,
  ...languageShape,
  ...dateFilterShape,
  ...paginationShape,
};

export function registerGetSimilarArticles(
  server: McpServer,
  client: NewsApiClient,
) {
  server.registerTool(
    "get_similar_articles",
    {
      title: "Get articles similar to a given article",
      description:
        "Given an article UUID, return other articles covering the same story from different outlets (GET /v1/news/similar/{uuid}). " +
        "Use this to gather multiple perspectives / corroborating coverage of a story you already have, or to expand from a single result. " +
        "Optionally filter the similar set by category, domain, source ID, language, and publish date, with pagination.",
      inputSchema: inputShape,
    },
    safeHandler(async (args: z.objectOutputType<typeof inputShape, z.ZodTypeAny>) => {
      const { uuid, ...rest } = args;
      const data = await client.get(
        `news/similar/${encodeURIComponent(uuid)}`,
        {
          categories: rest.categories,
          exclude_categories: rest.exclude_categories,
          domains: rest.domains,
          exclude_domains: rest.exclude_domains,
          source_ids: rest.source_ids,
          exclude_source_ids: rest.exclude_source_ids,
          language: rest.language,
          published_before: rest.published_before,
          published_after: rest.published_after,
          published_on: rest.published_on,
          limit: rest.limit,
          page: rest.page,
        },
      );
      return jsonResult(data);
    }),
  );
}
