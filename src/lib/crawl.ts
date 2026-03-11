import { ScrapeFormat } from "./types";
import {
  htmlToMarkdown,
  htmlToStructuredData,
  htmlToText,
  scrapeRenderedHtml,
  ScrapeJsonData,
} from "./unlocker";

export interface CrawlOptions {
  limit: number;
  maxDepth: number;
  concurrency: number;
  includeSubdomains: boolean;
}

interface TraversedSuccessPage {
  url: string;
  depth: number;
  ok: true;
  data: ScrapeJsonData;
  links: string[];
  outputByFormat: Record<ScrapeFormat, unknown>;
}

interface TraversedErrorPage {
  url: string;
  depth: number;
  ok: false;
  error: string;
  links: string[];
}

type TraversedPage = TraversedSuccessPage | TraversedErrorPage;

export interface MapPageResult {
  url: string;
  depth: number;
  ok: boolean;
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  links?: string[];
  error?: string;
}

export interface MapSiteResult {
  rootUrl: string;
  visited: number;
  failed: number;
  limit: number;
  maxDepth: number;
  includeSubdomains: boolean;
  pages: MapPageResult[];
}

export interface CrawlPageResult extends MapPageResult {
  format?: ScrapeFormat;
  output?: unknown;
}

export interface CrawlSiteResult {
  rootUrl: string;
  format: ScrapeFormat;
  visited: number;
  failed: number;
  limit: number;
  maxDepth: number;
  includeSubdomains: boolean;
  pages: CrawlPageResult[];
}

interface Scope {
  rootUrl: string;
  rootHost: string;
  rootOrigin: string;
  includeSubdomains: boolean;
}

interface ScrapedPage {
  url: string;
  data: ScrapeJsonData;
  links: string[];
  outputByFormat: Record<ScrapeFormat, unknown>;
}

export async function mapSite(rootUrl: string, apiKey: string, options: CrawlOptions): Promise<MapSiteResult> {
  const pages = await traverseSite(rootUrl, apiKey, options);

  return {
    rootUrl: pages.rootUrl,
    visited: pages.pages.length,
    failed: pages.pages.filter((page) => !page.ok).length,
    limit: options.limit,
    maxDepth: options.maxDepth,
    includeSubdomains: options.includeSubdomains,
    pages: pages.pages.map((page) =>
      page.ok
        ? {
            url: page.url,
            depth: page.depth,
            ok: true,
            title: page.data.title ?? null,
            description: page.data.description ?? null,
            canonical: page.data.canonical ?? null,
            links: page.links,
          }
        : {
            url: page.url,
            depth: page.depth,
            ok: false,
            links: page.links,
            error: page.error,
          },
    ),
  };
}

export async function crawlSite(
  rootUrl: string,
  apiKey: string,
  format: ScrapeFormat,
  options: CrawlOptions,
): Promise<CrawlSiteResult> {
  const pages = await traverseSite(rootUrl, apiKey, options);

  return {
    rootUrl: pages.rootUrl,
    format,
    visited: pages.pages.length,
    failed: pages.pages.filter((page) => !page.ok).length,
    limit: options.limit,
    maxDepth: options.maxDepth,
    includeSubdomains: options.includeSubdomains,
    pages: pages.pages.map((page) =>
      page.ok
        ? {
            url: page.url,
            depth: page.depth,
            ok: true,
            title: page.data.title ?? null,
            description: page.data.description ?? null,
            canonical: page.data.canonical ?? null,
            links: page.links,
            format,
            output: page.outputByFormat[format],
          }
        : {
            url: page.url,
            depth: page.depth,
            ok: false,
            links: page.links,
            error: page.error,
          },
    ),
  };
}

async function traverseSite(
  rootUrl: string,
  apiKey: string,
  options: CrawlOptions,
): Promise<{
  rootUrl: string;
  pages: TraversedPage[];
}> {
  const normalizedRootUrl = normalizeVisitUrl(rootUrl);
  const scope = createScope(normalizedRootUrl, options.includeSubdomains);
  const visited = new Set<string>([normalizedRootUrl]);
  const pages: TraversedPage[] = [];

  let frontier = [normalizedRootUrl];

  for (let depth = 0; depth <= options.maxDepth && frontier.length > 0 && pages.length < options.limit; depth += 1) {
    const remaining = options.limit - pages.length;
    const levelUrls = frontier.slice(0, remaining);
    const levelResults = await mapWithConcurrency(levelUrls, options.concurrency, async (url) => {
      try {
        const page = await scrapePage(url, apiKey, scope);
        return {
          url,
          depth,
          ok: true as const,
          data: page.data,
          links: page.links,
          outputByFormat: page.outputByFormat,
        };
      } catch (error) {
        return {
          url,
          depth,
          ok: false as const,
          error: error instanceof Error ? error.message : "Unknown error",
          links: [],
        };
      }
    });

    pages.push(...levelResults);

    if (depth === options.maxDepth || pages.length >= options.limit) {
      break;
    }

    const nextFrontier: string[] = [];
    for (const page of levelResults) {
      if (!page.ok) {
        continue;
      }

      for (const link of page.links) {
        if (visited.has(link)) {
          continue;
        }

        if (visited.size >= options.limit) {
          break;
        }

        visited.add(link);
        nextFrontier.push(link);
      }
    }

    frontier = nextFrontier;
  }

  return {
    rootUrl: normalizedRootUrl,
    pages,
  };
}

async function scrapePage(url: string, apiKey: string, scope: Scope): Promise<ScrapedPage> {
  const scraped = await scrapeRenderedHtml(url, apiKey);
  const data = htmlToStructuredData(scraped.content);
  const links = extractScopedLinks(url, data.links, scope);

  return {
    url,
    data,
    links,
    outputByFormat: {
      html: scraped.content,
      markdown: htmlToMarkdown(scraped.content),
      text: htmlToText(scraped.content),
      json: data,
    },
  };
}

function createScope(rootUrl: string, includeSubdomains: boolean): Scope {
  const parsed = new URL(rootUrl);
  return {
    rootUrl,
    rootHost: parsed.hostname.toLowerCase(),
    rootOrigin: parsed.origin,
    includeSubdomains,
  };
}

function extractScopedLinks(
  pageUrl: string,
  links: Array<{ href: string; text: string }>,
  scope: Scope,
): string[] {
  const normalized = new Set<string>();

  for (const link of links) {
    const candidate = normalizeDiscoveredUrl(link.href, pageUrl);
    if (!candidate) {
      continue;
    }

    if (!isInScope(candidate, scope)) {
      continue;
    }

    normalized.add(candidate);
  }

  return Array.from(normalized);
}

function normalizeVisitUrl(value: string): string {
  const parsed = new URL(value);
  parsed.hash = "";
  if (parsed.pathname === "") {
    parsed.pathname = "/";
  }
  return parsed.toString();
}

function normalizeDiscoveredUrl(href: string, pageUrl: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }

  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("data:")
  ) {
    return null;
  }

  try {
    const resolved = new URL(trimmed, pageUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }

    resolved.hash = "";
    if (resolved.pathname === "") {
      resolved.pathname = "/";
    }

    return resolved.toString();
  } catch {
    return null;
  }
}

function isInScope(url: string, scope: Scope): boolean {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();

  if (scope.includeSubdomains) {
    return host === scope.rootHost || host.endsWith(`.${scope.rootHost}`);
  }

  return parsed.origin === scope.rootOrigin;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results: TOutput[] = new Array(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}
