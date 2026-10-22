# @geekflare/ai-sdk

[Geekflare](https://geekflare.com) tools for the [Vercel AI SDK](https://ai-sdk.dev): live web search (including the full Google results page), page scraping, screenshots, and website diagnostics.

```bash
npm install @geekflare/ai-sdk
```

Works with AI SDK 5, 6, and 7, with `zod` 3.25+ or 4.

## Setup

Get an API key at [dash.geekflare.com](https://dash.geekflare.com) (free tier available) and set it as an environment variable:

```bash
export GEEKFLARE_API_KEY="your-api-key"
```

Or pass it to any tool: `geekflareSearch({ apiKey: "..." })`.

## Usage

```ts
import { generateText, isStepCount } from "ai";
import { geekflareSearch } from "@geekflare/ai-sdk";

const { text } = await generateText({
  model: "openai/gpt-5-mini",
  prompt: "What are the latest developments in AI agents? Cite sources.",
  tools: {
    geekflareSearch: geekflareSearch(),
  },
  stopWhen: isStepCount(3),
});

console.log(text);
```

Use every tool at once:

```ts
import { geekflareTools } from "@geekflare/ai-sdk";

const { text } = await generateText({
  model: "openai/gpt-5-mini",
  prompt: "Is the TLS setup on example.com healthy, and what does its homepage say?",
  tools: geekflareTools(),
  stopWhen: isStepCount(5),
});
```

## Tools

| Tool | What the model can do | Inputs |
| --- | --- | --- |
| `geekflareSearch()` | Web, news, or image search. `serp: true` returns the full Google results page (organic results, AI Overview, People Also Ask) by country or city | `query`, `serp`, `source`, `limit`, `location`, `city`, `time` |
| `geekflareScrape()` | Page content as Markdown (default), text, HTML, or JSON; `template: "product"` or `"contact"` for structured data | `url`, `template` |
| `geekflareScreenshot()` | Viewport or full-page screenshot, returned as a hosted image URL | `url`, `fullPage` |
| `geekflareWebsiteCheck()` | One website check: `site_status`, `dns_records`, `dnssec`, `tls_scan`, `redirect_check`, `broken_links`, `load_time`, `mixed_content`, `lighthouse` | `url`, `check` |
| `geekflareTools()` | All of the above, keyed by name | – |

Each tool returns the Geekflare API response. URLs can be full URLs or bare domains such as `example.com`.

### Options

Every tool accepts `apiKey`, `baseUrl`, and `timeoutMs` (default 180000). Some also take defaults:

```ts
geekflareSearch({ limit: 5, location: "us", includeDomains: ["github.com"] });
geekflareScrape({ format: "markdown-llm" }); // markdown | markdown-llm | text | text-llm | html | html-llm | json
geekflareScreenshot({ device: "mobile", type: "webp" });
```

### Errors

API errors (invalid key, no credits, unreachable site) throw `GeekflareAPIError` with the API's message. The AI SDK passes tool errors back to the model as a tool error result, so the model can react or retry.

## Notes

- Each call uses Geekflare credits on your account; see [pricing](https://geekflare.com/pricing/).
- Use the tools for publicly accessible pages only.
- The tools send the queries, URLs, and options you pass to `api.geekflare.com`. See the [Geekflare privacy policy](https://geekflare.com/privacy/).

## Links

- Docs: <https://docs.geekflare.com/integrations/ai-sdk>
- API reference: <https://docs.geekflare.com>
- LangChain: [`langchain-geekflare`](https://github.com/geekflare/langchain-geekflare) · LlamaIndex: [`llama-index-tools-geekflare`](https://github.com/geekflare/llama-index-tools-geekflare) · MCP server: <https://docs.geekflare.com/mcp/overview>

## License

MIT
