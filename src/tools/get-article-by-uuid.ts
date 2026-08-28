/**
 * get_article_by_uuid -> GET /v1/news/uuid/{uuid}
 * Fetch a single article by its UUID.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NewsApiClient } from "../client.js";
import { jsonResult, safeHandler } from "./shared.js";

const inputShape = {
  uuid: z
    .string()
    .min(1)
    .describe(
      "The UUID of the article to fetch (from the `uuid` field of any article returned by the other tools).",
    ),
};

export function registerGetArticleByUuid(
  server: McpServer,
  client: NewsApiClient,
) {
  server.registerTool(
    "get_article_by_uuid",
    {
      title: "Get a single article by UUID",
      description:
        "Fetch the full record for one article by its UUID (GET /v1/news/uuid/{uuid}). " +
        "Use this to re-retrieve or get complete details for an article you already have the UUID for. Returns `resource_not_found` if the UUID does not exist.",
      inputSchema: inputShape,
    },
    safeHandler(async (args: z.objectOutputType<typeof inputShape, z.ZodTypeAny>) => {
      const data = await client.get(
        `news/uuid/${encodeURIComponent(args.uuid)}`,
      );
      return jsonResult(data);
    }),
  );
}
