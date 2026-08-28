/**
 * Helpers shared by every tool: a uniform result formatter and an error-catching
 * wrapper that turns NewsApiError into a clean MCP error result.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { NewsApiError } from "../errors.js";

/** Wrap a raw handler so thrown NewsApiErrors become structured MCP error results. */
export function safeHandler<TArgs>(
  fn: (args: TArgs) => Promise<CallToolResult>,
): (args: TArgs) => Promise<CallToolResult> {
  return async (args: TArgs) => {
    try {
      return await fn(args);
    } catch (err) {
      if (err instanceof NewsApiError) {
        return {
          isError: true,
          content: [{ type: "text", text: err.toAssistantText() }],
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: "text", text: `Unexpected error: ${message}` }],
      };
    }
  };
}

/** Pretty-print a JSON payload as a text result. */
export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}
