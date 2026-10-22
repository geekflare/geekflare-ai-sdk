import { tool } from "ai";
import { z } from "zod";

import { callGeekflare, type GeekflareClientOptions, normalizeUrl } from "./client";

export const WEBSITE_CHECKS = {
  site_status: "up",
  dns_records: "dnsrecord",
  dnssec: "dnssec",
  tls_scan: "tlsscan",
  redirect_check: "redirectcheck",
  broken_links: "brokenlink",
  load_time: "loadtime",
  mixed_content: "mixedcontent",
  lighthouse: "lighthouse",
} as const;

export type WebsiteCheck = keyof typeof WEBSITE_CHECKS;

const checkNames = Object.keys(WEBSITE_CHECKS) as [WebsiteCheck, ...WebsiteCheck[]];

export interface GeekflareSearchOptions extends GeekflareClientOptions {
  /** Default number of results (1-100). The model can override it per call. */
  limit?: number;
  /** Default country code (ISO alpha-2), e.g. `us`. */
  location?: string;
  /** Default city, e.g. `London,England,United Kingdom`. Takes priority over `location`. */
  city?: string;
  /** Only return results from these domains. */
  includeDomains?: string[];
  /** Exclude results from these domains. */
  excludeDomains?: string[];
}

/**
 * Web, news, or image search with Geekflare. With `serp: true` the tool returns the
 * full Google results page (organic results, AI Overview, People Also Ask).
 */
export const geekflareSearch = (options: GeekflareSearchOptions = {}) =>
  tool({
    description:
      "Search the live web, news, or images and return titles, URLs, and snippets. " +
      "Set serp to true to get the full Google results page (organic results, AI Overview, People Also Ask) " +
      "for a country or city. Use for current information and cite the returned URLs.",
    inputSchema: z.object({
      query: z.string().min(1).describe("The search query."),
      serp: z.boolean().optional().describe("Return the full Google results page."),
      source: z.enum(["web", "news", "images"]).optional().describe("Search source. Defaults to web."),
      limit: z.number().int().min(1).max(100).optional().describe("Number of results, 1-100."),
      location: z.string().optional().describe("Country code (ISO alpha-2) for localized results, e.g. us."),
      city: z.string().optional().describe("City for localized results, e.g. London,England,United Kingdom."),
      time: z.string().optional().describe("Recency filter: any, h, d, w, m, y, or with a count such as d7."),
    }),
    execute: async (input, execOptions) =>
      callGeekflare(
        "search",
        {
          query: input.query,
          serp: input.serp,
          source: input.source,
          limit: input.limit ?? options.limit,
          location: input.location ?? options.location,
          city: input.city ?? options.city,
          time: input.time,
          includeDomains: options.includeDomains,
          excludeDomains: options.excludeDomains,
        },
        options,
        execOptions?.abortSignal,
      ),
  });

export interface GeekflareScrapeOptions extends GeekflareClientOptions {
  /** Default output format. Defaults to `markdown`. */
  format?: "markdown" | "markdown-llm" | "text" | "text-llm" | "html" | "html-llm" | "json";
}

/** Fetch a public web page and return its content as Markdown, text, HTML, or structured JSON. */
export const geekflareScrape = (options: GeekflareScrapeOptions = {}) =>
  tool({
    description:
      "Fetch a public web page and return its content (Markdown by default). Use template product or contact " +
      "for structured data. Only for publicly accessible pages.",
    inputSchema: z.object({
      url: z.string().min(1).describe("Full URL of the page, or a domain such as example.com."),
      template: z
        .enum(["product", "contact"])
        .optional()
        .describe("Structured extraction: product (price, availability, ratings) or contact (emails, phones, socials)."),
    }),
    execute: async (input, execOptions) =>
      callGeekflare(
        "webscraping",
        {
          url: normalizeUrl(input.url),
          format: [options.format ?? "markdown"],
          template: input.template,
          extractionMode: input.template ? "template" : undefined,
        },
        options,
        execOptions?.abortSignal,
      ),
  });

export interface GeekflareScreenshotOptions extends GeekflareClientOptions {
  /** Device to emulate. Defaults to `desktop`. */
  device?: "desktop" | "mobile";
  /** Image format. Defaults to `png`. */
  type?: "png" | "jpeg" | "webp";
}

/** Capture a screenshot of a web page and return a hosted image URL. */
export const geekflareScreenshot = (options: GeekflareScreenshotOptions = {}) =>
  tool({
    description: "Take a screenshot of a web page (viewport or full page) and return a hosted image URL.",
    inputSchema: z.object({
      url: z.string().min(1).describe("Full URL of the page, or a domain such as example.com."),
      fullPage: z.boolean().optional().describe("Capture the whole page instead of the viewport."),
    }),
    execute: async (input, execOptions) =>
      callGeekflare(
        "screenshot",
        {
          url: normalizeUrl(input.url),
          fullPage: input.fullPage,
          device: options.device,
          type: options.type,
        },
        options,
        execOptions?.abortSignal,
      ),
  });

/** Run one website diagnostic: uptime, DNS, DNSSEC, TLS, redirects, broken links, load time, mixed content, Lighthouse. */
export const geekflareWebsiteCheck = (options: GeekflareClientOptions = {}) =>
  tool({
    description:
      "Run one website check and return the result: site_status (up/down), dns_records, dnssec, tls_scan " +
      "(certificate and TLS versions), redirect_check, broken_links, load_time, mixed_content, or lighthouse " +
      "(performance/SEO/accessibility scores; slow). Reports findings only.",
    inputSchema: z.object({
      url: z.string().min(1).describe("Website URL or domain, e.g. example.com."),
      check: z.enum(checkNames).describe("Which check to run."),
    }),
    execute: async (input, execOptions) =>
      callGeekflare(WEBSITE_CHECKS[input.check], { url: normalizeUrl(input.url) }, options, execOptions?.abortSignal),
  });

/** All Geekflare tools, keyed by tool name, sharing the same client options. */
export const geekflareTools = (options: GeekflareClientOptions = {}) => ({
  geekflareSearch: geekflareSearch(options),
  geekflareScrape: geekflareScrape(options),
  geekflareScreenshot: geekflareScreenshot(options),
  geekflareWebsiteCheck: geekflareWebsiteCheck(options),
});
