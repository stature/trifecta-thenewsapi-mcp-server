/**
 * list_sources -> GET /v1/news/sources
 * Enumerate the publishers / sources TheNewsAPI indexes.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NewsApiClient } from "../client.js";
import { categoryFilterShape, languageShape } from "../schemas.js";
import { jsonResult, safeHandler } from "./shared.js";

const inputShape = {
  ...categoryFilterShape,
  ...languageShape,
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("1-based page number for paginating through the source list."),
};

export function registerListSources(server: McpServer, client: NewsApiClient) {
  server.registerTool(
    "list_sources",
    {
      title: "List available news sources",
      description:
        "List the publishers / sources TheNewsAPI indexes (GET /v1/news/sources), each with its `source_id`, domain, categories, language, and locale. " +
        "Use this to discover valid `source_ids` values for the other tools, or to check whether a given outlet is covered. Filter by category and language; paginate with `page`.",
      inputSchema: inputShape,
    },
    safeHandler(async (args: z.objectOutputType<typeof inputShape, z.ZodTypeAny>) => {
      const data = await client.get("news/sources", {
        categories: args.categories,
        exclude_categories: args.exclude_categories,
        language: args.language,
        page: args.page,
      });
      return jsonResult(data);
    }),
  );
}
