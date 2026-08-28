/**
 * Central API client wrapper for TheNewsAPI.com.
 *
 * Responsibilities:
 *  - hold the base URL (https://api.thenewsapi.com/v1/)
 *  - inject the api_token from the environment (never logged, never hardcoded)
 *  - serialise query parameters (arrays -> comma-separated, booleans -> "true"/"false")
 *  - parse responses and convert documented API errors into NewsApiError
 */

import { NewsApiError, errorFromResponse } from "./errors.js";

const BASE_URL = "https://api.thenewsapi.com/v1/";
const DEFAULT_TIMEOUT_MS = 20_000;

export type QueryValue =
  | string
  | number
  | boolean
  | Array<string | number>
  | undefined
  | null;

export type QueryParams = Record<string, QueryValue>;

export interface NewsApiClientOptions {
  token: string;
  /** Override base URL (tests only). */
  baseUrl?: string;
  timeoutMs?: number;
}

export class NewsApiClient {
  #token: string;
  #baseUrl: string;
  #timeoutMs: number;

  constructor(opts: NewsApiClientOptions) {
    if (!opts.token || !opts.token.trim()) {
      throw new Error(
        "NEWS_API_TOKEN is not set. Create a .env file (see .env.example) with a token from https://www.thenewsapi.com/account/dashboard",
      );
    }
    this.#token = opts.token.trim();
    this.#baseUrl = opts.baseUrl ?? BASE_URL;
    this.#timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Perform a GET request against `path` (relative to the v1 base, no leading slash),
   * returning the parsed JSON body. Throws NewsApiError on any failure.
   */
  async get<T = unknown>(path: string, params: QueryParams = {}): Promise<T> {
    const url = new URL(path.replace(/^\/+/, ""), this.#baseUrl);

    // Auth: TheNewsAPI expects the token as the `api_token` query parameter.
    url.searchParams.set("api_token", this.#token);

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        if (value.length === 0) continue;
        url.searchParams.set(key, value.join(","));
      } else if (typeof value === "boolean") {
        url.searchParams.set(key, value ? "true" : "false");
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      throw new NewsApiError({
        code: aborted ? "server_error" : "network_error",
        message: aborted
          ? `Request timed out after ${this.#timeoutMs}ms.`
          : `Network error contacting TheNewsAPI: ${
              err instanceof Error ? err.message : String(err)
            }`,
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      body = undefined;
    }

    if (!response.ok) {
      throw errorFromResponse(response.status, body ?? raw);
    }

    if (body === undefined) {
      throw new NewsApiError({
        code: "server_error",
        message: "TheNewsAPI returned a non-JSON success response.",
        status: response.status,
        retryable: true,
      });
    }

    return body as T;
  }
}

/** Build a client from the NEWS_API_TOKEN environment variable. */
export function clientFromEnv(): NewsApiClient {
  return new NewsApiClient({ token: process.env.NEWS_API_TOKEN ?? "" });
}
