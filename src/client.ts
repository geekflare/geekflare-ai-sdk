export const DEFAULT_BASE_URL = "https://api.geekflare.com";
export const DEFAULT_TIMEOUT_MS = 180_000;

export interface GeekflareClientOptions {
  /** Geekflare API key. Defaults to the `GEEKFLARE_API_KEY` environment variable. */
  apiKey?: string;
  /** API base URL. Defaults to `https://api.geekflare.com`. */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 180000. */
  timeoutMs?: number;
}

export class GeekflareAPIError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "GeekflareAPIError";
    this.status = status;
  }
}

/** Accept bare domains such as `example.com` by adding `https://`. */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed && !trimmed.includes("://") ? `https://${trimmed}` : trimmed;
}

function resolveApiKey(apiKey?: string): string {
  const key = apiKey ?? (typeof process !== "undefined" ? process.env?.GEEKFLARE_API_KEY : undefined);
  if (!key) {
    throw new GeekflareAPIError(
      "Missing Geekflare API key. Pass `apiKey` or set the GEEKFLARE_API_KEY environment variable.",
    );
  }
  return key;
}

/**
 * POST a JSON body to a Geekflare endpoint and return the parsed response.
 * `undefined` values are dropped so the API applies its defaults.
 */
export async function callGeekflare<T = Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
  options: GeekflareClientOptions = {},
  abortSignal?: AbortSignal,
): Promise<T> {
  const apiKey = resolveApiKey(options.apiKey);
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const payload = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));

  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = abortSignal ? AbortSignal.any([abortSignal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/${path}`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "geekflare-ai-sdk",
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    throw new GeekflareAPIError(`Request to Geekflare failed: ${(error as Error).message}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = { message: response.statusText };
  }
  const record = (data && typeof data === "object" ? data : { data }) as Record<string, unknown>;

  if (!response.ok || record.apiStatus === "failure") {
    const message = typeof record.message === "string" ? record.message : response.statusText || "request failed";
    throw new GeekflareAPIError(`Geekflare API error ${response.status}: ${message}`, response.status);
  }
  return record as T;
}
