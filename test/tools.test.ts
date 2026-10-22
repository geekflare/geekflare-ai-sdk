import { generateText, isStepCount } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GeekflareAPIError,
  geekflareScrape,
  geekflareScreenshot,
  geekflareSearch,
  geekflareTools,
  geekflareWebsiteCheck,
  WEBSITE_CHECKS,
} from "../src";

const execOptions = { toolCallId: "call-1", messages: [] } as never;
const ok = { apiStatus: "success", apiCode: 200, data: { ok: true } };

function mockFetch(status = 200, body: unknown = ok) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function lastRequest(fn: ReturnType<typeof mockFetch>) {
  const [url, init] = fn.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, init, body: JSON.parse(init.body as string), headers: init.headers as Record<string, string> };
}

beforeEach(() => vi.stubEnv("GEEKFLARE_API_KEY", "env-key"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("geekflareSearch", () => {
  it("sends the query, SERP options, and defaults", async () => {
    const fetchMock = mockFetch();
    const search = geekflareSearch({ limit: 5, includeDomains: ["g2.com"] });
    const result = await search.execute!({ query: "best crm", serp: true, city: "London,England,United Kingdom" }, execOptions);

    expect(result).toEqual(ok);
    const { url, body, headers } = lastRequest(fetchMock);
    expect(url).toBe("https://api.geekflare.com/search");
    expect(headers["x-api-key"]).toBe("env-key");
    expect(body).toEqual({
      query: "best crm",
      serp: true,
      limit: 5,
      city: "London,England,United Kingdom",
      includeDomains: ["g2.com"],
    });
  });

  it("prefers an explicit apiKey over the environment", async () => {
    const fetchMock = mockFetch();
    await geekflareSearch({ apiKey: "explicit" }).execute!({ query: "x" }, execOptions);
    expect(lastRequest(fetchMock).headers["x-api-key"]).toBe("explicit");
  });

  it("throws a GeekflareAPIError with the API message", async () => {
    mockFetch(401, { apiCode: 401, message: "Invalid x-api-key" });
    await expect(geekflareSearch().execute!({ query: "x" }, execOptions)).rejects.toThrow(/Invalid x-api-key/);
    await expect(geekflareSearch().execute!({ query: "x" }, execOptions)).rejects.toBeInstanceOf(GeekflareAPIError);
  });

  it("requires an API key", async () => {
    vi.stubEnv("GEEKFLARE_API_KEY", "");
    const fetchMock = mockFetch();
    await expect(geekflareSearch().execute!({ query: "x" }, execOptions)).rejects.toThrow(/Missing Geekflare API key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("geekflareScrape", () => {
  it("normalizes bare domains and sets template mode", async () => {
    const fetchMock = mockFetch();
    await geekflareScrape({ format: "markdown-llm" }).execute!({ url: "example.com", template: "product" }, execOptions);
    const { url, body } = lastRequest(fetchMock);
    expect(url).toBe("https://api.geekflare.com/webscraping");
    expect(body).toEqual({
      url: "https://example.com",
      format: ["markdown-llm"],
      template: "product",
      extractionMode: "template",
    });
  });
});

describe("geekflareScreenshot", () => {
  it("passes full page and defaults", async () => {
    const fetchMock = mockFetch();
    await geekflareScreenshot({ type: "webp" }).execute!({ url: "https://example.com", fullPage: true }, execOptions);
    expect(lastRequest(fetchMock).body).toEqual({ url: "https://example.com", fullPage: true, type: "webp" });
  });
});

describe("geekflareWebsiteCheck", () => {
  it.each(Object.entries(WEBSITE_CHECKS))("routes %s to /%s", async (check, path) => {
    const fetchMock = mockFetch();
    await geekflareWebsiteCheck().execute!({ url: "example.com", check: check as never }, execOptions);
    const { url, body } = lastRequest(fetchMock);
    expect(url).toBe(`https://api.geekflare.com/${path}`);
    expect(body).toEqual({ url: "https://example.com" });
  });
});

describe("with generateText", () => {
  it("runs a tool call end to end through the AI SDK", async () => {
    const fetchMock = mockFetch(200, { apiStatus: "success", data: [{ title: "Geekflare", url: "https://geekflare.com" }] });
    let step = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        step += 1;
        const usage = {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        };
        if (step === 1) {
          return {
            content: [
              { type: "tool-call", toolCallId: "c1", toolName: "geekflareSearch", input: JSON.stringify({ query: "geekflare" }) },
            ],
            finishReason: { unified: "tool-calls", raw: undefined },
            usage,
            warnings: [],
          };
        }
        return {
          content: [{ type: "text", text: "Found Geekflare." }],
          finishReason: { unified: "stop", raw: undefined },
          usage,
          warnings: [],
        };
      },
    });

    const { text, steps } = await generateText({
      model,
      prompt: "Search for geekflare",
      tools: geekflareTools(),
      stopWhen: isStepCount(3),
    });

    expect(text).toBe("Found Geekflare.");
    expect(steps[0].toolResults[0].output).toEqual({
      apiStatus: "success",
      data: [{ title: "Geekflare", url: "https://geekflare.com" }],
    });
    expect(lastRequest(fetchMock).body).toEqual({ query: "geekflare" });
  });
});
