/**
 * Error handling for TheNewsAPI.
 *
 * TheNewsAPI returns a JSON body shaped like:
 *   { "error": { "code": "invalid_api_token", "message": "..." } }
 * (older / some responses use a flat { "code", "message" } shape, which we also handle).
 *
 * We translate those documented codes into a stable, assistant-friendly message so the
 * calling model can understand what went wrong and whether retrying is worthwhile.
 */

/** Documented error codes from https://www.thenewsapi.com/documentation#errors */
export const KNOWN_ERROR_CODES = [
  "malformed_parameters",
  "invalid_api_token",
  "usage_limit_reached",
  "endpoint_access_restricted",
  "resource_not_found",
  "rate_limit_reached",
  "server_error",
  "maintenance_mode",
] as const;

export type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];

const ERROR_GUIDANCE: Record<KnownErrorCode, string> = {
  malformed_parameters:
    "One or more request parameters were invalid or malformed. Check the parameter names, value formats (dates must be YYYY-MM-DD), and the boolean search syntax, then retry with corrected input.",
  invalid_api_token:
    "The API token is missing or invalid. The server operator must set a valid NEWS_API_TOKEN. This will not succeed on retry until the token is fixed.",
  usage_limit_reached:
    "The account's monthly request quota has been exhausted. Retrying will not help until the quota resets or the plan is upgraded.",
  endpoint_access_restricted:
    "The current TheNewsAPI plan does not include access to this endpoint or parameter. A plan upgrade is required; retrying will not help.",
  resource_not_found:
    "The requested resource (e.g. an article UUID) does not exist. Verify the identifier; retrying the same request will not help.",
  rate_limit_reached:
    "Too many requests were sent in a short window (per-second rate limit). Wait a few seconds and retry.",
  server_error:
    "TheNewsAPI encountered an internal error. This is usually transient — retry after a short delay.",
  maintenance_mode:
    "TheNewsAPI is temporarily down for maintenance. Retry later.",
};

export class NewsApiError extends Error {
  /** Documented error code when recognised, otherwise "unknown_error" / "network_error". */
  readonly code: string;
  /** HTTP status code, when the failure came from an HTTP response. */
  readonly status?: number;
  /** Whether it is worth the assistant retrying the same request later. */
  readonly retryable: boolean;

  constructor(params: {
    code: string;
    message: string;
    status?: number;
    retryable?: boolean;
  }) {
    super(params.message);
    this.name = "NewsApiError";
    this.code = params.code;
    this.status = params.status;
    this.retryable = params.retryable ?? false;
  }

  /** Human-readable block surfaced back to the calling assistant. */
  toAssistantText(): string {
    const lines = [
      `TheNewsAPI request failed.`,
      `Error code: ${this.code}`,
    ];
    if (this.status !== undefined) lines.push(`HTTP status: ${this.status}`);
    lines.push(`Details: ${this.message}`);
    lines.push(`Retryable: ${this.retryable ? "yes" : "no"}`);
    return lines.join("\n");
  }
}

function isKnownCode(code: string): code is KnownErrorCode {
  return (KNOWN_ERROR_CODES as readonly string[]).includes(code);
}

const RETRYABLE_CODES: ReadonlySet<string> = new Set<KnownErrorCode>([
  "rate_limit_reached",
  "server_error",
  "maintenance_mode",
]);

/**
 * Build a NewsApiError from a non-OK HTTP response.
 * `body` is the already-parsed JSON body (or undefined if it could not be parsed).
 */
export function errorFromResponse(status: number, body: unknown): NewsApiError {
  let code = "unknown_error";
  let apiMessage = "";

  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const errObj =
      b.error && typeof b.error === "object"
        ? (b.error as Record<string, unknown>)
        : b;
    if (typeof errObj.code === "string") code = errObj.code;
    if (typeof errObj.message === "string") apiMessage = errObj.message;
  }

  // Fall back to inferring a code from the HTTP status when the body has none.
  if (code === "unknown_error") {
    code =
      status === 400
        ? "malformed_parameters"
        : status === 401
        ? "invalid_api_token"
        : status === 402
        ? "usage_limit_reached"
        : status === 403
        ? "endpoint_access_restricted"
        : status === 404
        ? "resource_not_found"
        : status === 429
        ? "rate_limit_reached"
        : status === 503
        ? "maintenance_mode"
        : status >= 500
        ? "server_error"
        : "unknown_error";
  }

  const guidance = isKnownCode(code) ? ERROR_GUIDANCE[code] : undefined;
  const message = [apiMessage, guidance].filter(Boolean).join(" — ") ||
    `Unexpected error (HTTP ${status}).`;

  return new NewsApiError({
    code,
    message,
    status,
    retryable: RETRYABLE_CODES.has(code),
  });
}
