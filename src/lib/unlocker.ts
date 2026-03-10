import { HttpError } from "./errors";

const DEFAULT_BASE_URL = "https://parsing.webunlocker.gologin.com";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_EXTRACTED_LINKS = 100;
const MAX_EXTRACTED_HEADINGS = 50;

export interface ScrapeResult {
  success: true;
  url: string;
  content: string;
  contentType?: string | null;
  status?: number | null;
  headers?: Record<string, string>;
}

export interface ScrapeTextResult extends ScrapeResult {
  text: string;
}

export interface ScrapeMarkdownResult extends ScrapeResult {
  markdown: string;
}

export interface ScrapeJsonData {
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  meta: Record<string, string>;
  headings: string[];
  links: Array<{
    text: string;
    href: string;
  }>;
}

export interface ScrapeJsonResult extends ScrapeResult {
  data: ScrapeJsonData;
}

interface WebUnlockerOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

class WebUnlockerClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  public constructor(options: WebUnlockerOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

    if (!this.apiKey.trim()) {
      throw new Error("apiKey is required");
    }
  }

  public async scrape(url: string): Promise<ScrapeResult> {
    assertValidTargetUrl(url);

    const requestUrl = new URL("/v1/scrape", this.baseUrl);
    requestUrl.searchParams.set("url", url);

    const response = await fetchWithRetry(requestUrl.toString(), {
      headers: {
        apikey: this.apiKey,
      },
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
    });

    if (!response.ok) {
      const body = await safeReadText(response);
      throw new HttpError(
        `Web Unlocker request failed with status ${response.status}.`,
        response.status,
        body ? truncate(body, 300) : undefined,
      );
    }

    const content = await response.text();

    return {
      success: true,
      url,
      content,
      contentType: response.headers.get("content-type"),
      status: response.status,
      headers: headersToRecord(response.headers),
    };
  }
}

export async function scrapeRenderedHtml(url: string, apiKey: string): Promise<ScrapeResult> {
  return createWebUnlockerClient(apiKey).scrape(url);
}

export async function scrapeText(url: string, apiKey: string): Promise<ScrapeTextResult> {
  const scraped = await createWebUnlockerClient(apiKey).scrape(url);
  return {
    ...scraped,
    text: htmlToText(scraped.content),
  };
}

export async function scrapeMarkdown(url: string, apiKey: string): Promise<ScrapeMarkdownResult> {
  const scraped = await createWebUnlockerClient(apiKey).scrape(url);
  return {
    ...scraped,
    markdown: htmlToMarkdown(scraped.content),
  };
}

export async function scrapeJson(url: string, apiKey: string): Promise<ScrapeJsonResult> {
  const scraped = await createWebUnlockerClient(apiKey).scrape(url);
  return {
    ...scraped,
    data: htmlToStructuredData(scraped.content),
  };
}

function createWebUnlockerClient(apiKey: string): WebUnlockerClient {
  return new WebUnlockerClient({ apiKey });
}

async function fetchWithRetry(
  url: string,
  options: {
    headers: Record<string, string>;
    timeoutMs: number;
    maxRetries: number;
  },
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: options.headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      if (attempt === options.maxRetries) {
        break;
      }

      await sleep(250 * (attempt + 1));
    }
  }

  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new HttpError("Web Unlocker request timed out.", 408);
  }

  throw lastError instanceof Error
    ? new HttpError(lastError.message, 500)
    : new HttpError("Web Unlocker request failed.", 500);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function assertValidTargetUrl(url: string): void {
  if (!url.trim()) {
    throw new Error("url is required");
  }

  try {
    new URL(url);
  } catch {
    throw new Error("url must be a valid absolute URL");
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function truncate(value: string, maxLength = 300): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gis, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gis, " ");

  const withBreaks = withoutScripts
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|tr|h1|h2|h3|h4|h5|h6)>/gi, "\n");

  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(stripped);

  return decoded
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function htmlToMarkdown(html: string): string {
  let markdown = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gis, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gis, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  markdown = markdown.replace(
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_, level: string, text: string) => `${"#".repeat(Number(level))} ${cleanInlineHtml(text)}\n\n`,
  );

  markdown = markdown.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href: string, text: string) => `[${cleanInlineHtml(text)}](${href})`,
  );

  markdown = markdown
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, text: string) => `**${cleanInlineHtml(text)}**`)
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, text: string) => `*${cleanInlineHtml(text)}*`)
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, text: string) => `\`${cleanInlineHtml(text)}\``)
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, text: string) => `- ${cleanInlineHtml(text)}\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|ul|ol|table|tr)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(markdown)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function htmlToStructuredData(html: string): ScrapeJsonData {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const canonicalMatch = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i);
  const meta: Record<string, string> = {};
  const metaTagMatches = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of metaTagMatches) {
    const name = getTagAttr(tag, "name") || getTagAttr(tag, "property");
    const content = getTagAttr(tag, "content");

    if (!name || !content) {
      continue;
    }

    meta[name] = decodeHtmlEntities(content).trim();
  }

  const headings = (html.match(/<h[1-3]\b[^>]*>[\s\S]*?<\/h[1-3]>/gi) ?? [])
    .slice(0, MAX_EXTRACTED_HEADINGS)
    .map((headingHtml) => decodeHtmlEntities(headingHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim())
    .filter(Boolean);

  const links = Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .slice(0, MAX_EXTRACTED_LINKS)
    .map((match) => ({
      href: decodeHtmlEntities(match[1]).trim(),
      text: decodeHtmlEntities(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim(),
    }))
    .filter((link) => link.href.length > 0);

  const canonical = canonicalMatch ? getTagAttr(canonicalMatch[0], "href") ?? null : null;
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : null;
  const description = meta.description ?? meta["og:description"] ?? null;

  return {
    title,
    description,
    canonical: canonical ? decodeHtmlEntities(canonical).trim() : null,
    meta,
    headings,
    links,
  };
}

function cleanInlineHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function getTagAttr(tag: string, attrName: string): string | null {
  const regex = new RegExp(`${attrName}\\s*=\\s*["']([^"']*)["']`, "i");
  const match = tag.match(regex);
  return match ? match[1] : null;
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&#39;": "'",
    "&nbsp;": " ",
  };

  let decoded = value;
  for (const [entity, plain] of Object.entries(namedEntities)) {
    decoded = decoded.split(entity).join(plain);
  }

  decoded = decoded.replace(/&#(\d+);/g, (_, num: string) => String.fromCharCode(Number(num)));
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  return decoded;
}
