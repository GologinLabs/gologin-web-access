import { ScrapeFormat } from "./types";
import { extractReadableSegmentFromHtml } from "./readSource";
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
  includePatterns: string[];
  excludePatterns: string[];
  ignoreQueryParameters: boolean;
  sitemapMode: "include" | "only" | "skip";
  onlyMainContent?: boolean;
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
  status: "ok" | "partial" | "failed";
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
  status: "ok" | "partial" | "failed";
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
  const status = resolveTraversalStatus(pages.pages.length, pages.pages.filter((page) => !page.ok).length);

  return {
    status,
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
  const status = resolveTraversalStatus(pages.pages.length, pages.pages.filter((page) => !page.ok).length);

  return {
    status,
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

export function resolveTraversalStatus(
  visited: number,
  failed: number,
): "ok" | "partial" | "failed" {
  if (visited === 0 || failed >= visited) {
    return "failed";
  }

  if (failed > 0) {
    return "partial";
  }

  return "ok";
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
  const initialFrontier = await buildInitialFrontier(normalizedRootUrl, apiKey, scope, options);
  const visited = new Set<string>(initialFrontier);
  const pages: TraversedPage[] = [];

  let frontier = initialFrontier;

  for (let depth = 0; depth <= options.maxDepth && frontier.length > 0 && pages.length < options.limit; depth += 1) {
    const remaining = options.limit - pages.length;
    const levelUrls = frontier.slice(0, remaining);
    const levelResults = await mapWithConcurrency(levelUrls, options.concurrency, async (url) => {
      try {
        const page = await scrapePage(url, apiKey, scope, options);
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

async function scrapePage(url: string, apiKey: string, scope: Scope, options: CrawlOptions): Promise<ScrapedPage> {
  const scraped = await scrapeRenderedHtml(url, apiKey);
  const data = htmlToStructuredData(scraped.content);
  const links = extractScopedLinks(url, data.links, scope, options);
  const readable = options.onlyMainContent ? extractReadableSegmentFromHtml(scraped.content) : null;
  const htmlOutput = readable ? readable.html : scraped.content;

  return {
    url,
    data,
    links,
    outputByFormat: {
      html: htmlOutput,
      markdown: htmlToMarkdown(htmlOutput),
      text: readable ? readable.text : htmlToText(scraped.content),
      json: data,
    },
  };
}

async function buildInitialFrontier(
  rootUrl: string,
  apiKey: string,
  scope: Scope,
  options: CrawlOptions,
): Promise<string[]> {
  const rootAllowed = matchesScopeRules(rootUrl, options);
  const sitemapUrls =
    options.sitemapMode === "skip" ? [] : await fetchSitemapUrls(rootUrl, apiKey, scope, options).catch(() => []);

  if (options.sitemapMode === "only") {
    const seeded = sitemapUrls.filter((url) => matchesScopeRules(url, options));
    return seeded.length > 0 ? seeded.slice(0, options.limit) : rootAllowed ? [rootUrl] : [];
  }

  const urls = [
    ...(rootAllowed ? [rootUrl] : []),
    ...sitemapUrls.filter((url) => matchesScopeRules(url, options)),
  ];

  return Array.from(new Set(urls)).slice(0, options.limit);
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
  options: CrawlOptions,
): string[] {
  const normalized = new Set<string>();

  for (const link of links) {
    const candidate = normalizeDiscoveredUrl(link.href, pageUrl, options.ignoreQueryParameters);
    if (!candidate) {
      continue;
    }

    if (!isInScope(candidate, scope)) {
      continue;
    }

    if (!matchesScopeRules(candidate, options)) {
      continue;
    }

    normalized.add(candidate);
  }

  return Array.from(normalized);
}

function normalizeVisitUrl(value: string, ignoreQueryParameters = false): string {
  const parsed = new URL(value);
  parsed.hash = "";
  if (ignoreQueryParameters) {
    parsed.search = "";
  }
  if (parsed.pathname === "") {
    parsed.pathname = "/";
  }
  return parsed.toString();
}

function normalizeDiscoveredUrl(href: string, pageUrl: string, ignoreQueryParameters: boolean): string | null {
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
    if (ignoreQueryParameters) {
      resolved.search = "";
    }
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

async function fetchSitemapUrls(
  rootUrl: string,
  apiKey: string,
  scope: Scope,
  options: CrawlOptions,
): Promise<string[]> {
  const root = new URL(rootUrl);
  const sitemapUrl = new URL("/sitemap.xml", root.origin).toString();
  const scraped = await scrapeRenderedHtml(sitemapUrl, apiKey);
  const directEntries = extractXmlLocValues(scraped.content)
    .map((url) => normalizeVisitUrl(url, options.ignoreQueryParameters))
    .filter((url) => isInScope(url, scope) && matchesScopeRules(url, options));

  if (!scraped.content.includes("<sitemapindex")) {
    return Array.from(new Set(directEntries));
  }

  const nested = directEntries.filter((url) => url.endsWith(".xml"));
  const pageUrls = directEntries.filter((url) => !url.endsWith(".xml"));
  const nestedPages = await mapWithConcurrency(nested.slice(0, 10), 2, async (url) => {
    try {
      const nestedScrape = await scrapeRenderedHtml(url, apiKey);
      return extractXmlLocValues(nestedScrape.content)
        .map((item) => normalizeVisitUrl(item, options.ignoreQueryParameters))
        .filter((item) => isInScope(item, scope) && matchesScopeRules(item, options));
    } catch {
      return [];
    }
  });

  return Array.from(new Set([...pageUrls, ...nestedPages.flat()]));
}

function extractXmlLocValues(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi))
    .map((match) => decodeXmlEntities(match[1].trim()))
    .filter(Boolean);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function matchesScopeRules(url: string, options: CrawlOptions): boolean {
  if (options.includePatterns.length > 0 && !matchesAnyPattern(url, options.includePatterns)) {
    return false;
  }

  if (options.excludePatterns.length > 0 && matchesAnyPattern(url, options.excludePatterns)) {
    return false;
  }

  return true;
}

function matchesAnyPattern(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => buildPatternRegex(pattern).test(url));
}

function buildPatternRegex(pattern: string): RegExp {
  const escaped = pattern
    .trim()
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(escaped, "i");
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
