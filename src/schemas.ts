/**
 * Shared zod schema fragments for TheNewsAPI tool inputs.
 *
 * MCP `registerTool` takes a *raw shape* (a plain object of zod validators), not a
 * z.object(). Each exported constant here is a raw-shape fragment that individual
 * tools spread into their own input schema.
 */

import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD calendar date string. */
export const dateString = z
  .string()
  .regex(DATE_REGEX, "Must be a calendar date in YYYY-MM-DD format");

/**
 * Accept either a real array of strings or a single comma-separated string
 * (assistants often pass "a,b,c"). Always normalised to string[].
 */
export const csvList = z
  .union([z.array(z.string().min(1)), z.string().min(1)])
  .transform((v) =>
    (Array.isArray(v) ? v : v.split(","))
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );

export const languageList = csvList.describe(
  'Language codes to include, e.g. ["en"], ["en","es"]. Supported: ar, bg, bn, cs, da, de, el, en, es, et, fa, fi, fr, he, hi, hr, hu, id, it, ja, ko, lt, multi, nl, no, pl, pt, ro, ru, sk, sv, th, tr, uk, vi, zh.',
);

/**
 * Boolean search syntax help — reused verbatim in every tool that exposes `search`
 * so the assistant always sees the operator reference.
 */
export const SEARCH_SYNTAX_HELP =
  'Boolean query. Operators: `+` requires a term (AND), `|` is OR, `-` excludes a term, ' +
  '`"..."` matches an exact phrase, and parentheses group sub-expressions. ' +
  'Examples: `+bitcoin +etf` (both terms), `apple | microsoft` (either), ' +
  '`+"artificial intelligence" -crypto` (phrase required, crypto excluded), ' +
  '`(tesla | rivian) +earnings`. Bare space-separated words are treated as OR.';

/** Search-field targeting for the `search` param. */
export const searchFields = csvList.describe(
  'Which article fields the `search` query runs against. Any of: title, description, keywords, main_text. ' +
    'Default when omitted is title, description, keywords. Example: ["title","description"].',
);

/**
 * Category / source / domain filters shared by news/all, news/top,
 * news/similar and (a subset by) news/headlines and news/sources.
 */
export const categoryFilterShape = {
  categories: csvList
    .optional()
    .describe(
      'Restrict to these categories. Any of: general, science, sports, business, health, entertainment, tech, politics, food, travel. Example: ["business","tech"].',
    ),
  exclude_categories: csvList
    .optional()
    .describe("Exclude these categories (same allowed values as `categories`)."),
};

export const sourceFilterShape = {
  domains: csvList
    .optional()
    .describe(
      'Restrict to these publisher domains. Example: ["nytimes.com","bbc.com"].',
    ),
  exclude_domains: csvList
    .optional()
    .describe("Exclude these publisher domains."),
  source_ids: csvList
    .optional()
    .describe(
      'Restrict to these TheNewsAPI source IDs (from `list_sources`). Example: ["arstechnica-com-1"].',
    ),
  exclude_source_ids: csvList
    .optional()
    .describe("Exclude these TheNewsAPI source IDs."),
};

/** published_before / published_after / published_on. */
export const dateFilterShape = {
  published_before: dateString
    .optional()
    .describe("Only articles published strictly before this date (YYYY-MM-DD)."),
  published_after: dateString
    .optional()
    .describe("Only articles published strictly after this date (YYYY-MM-DD)."),
  published_on: dateString
    .optional()
    .describe("Only articles published on exactly this date (YYYY-MM-DD)."),
};

/** limit + page pagination shared by list-returning endpoints. */
export const paginationShape = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      "Number of articles to return per page (1-100). Free plans are typically capped at 3; paid plans allow up to 100.",
    ),
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("1-based page number for paginating through results."),
};

export const languageShape = {
  language: languageList
    .optional()
    .describe(languageList._def.description ?? "Language codes to include."),
};

export const localeShape = {
  locale: csvList
    .optional()
    .describe(
      'Two-letter country codes for the news locale. Example: ["us"], ["us","ca","gb"]. ' +
        "Controls which country/countries' outlets and editions are considered.",
    ),
};
