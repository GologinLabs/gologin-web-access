import { scrapeRenderedHtml } from "./unlocker";

export interface SearchOptions {
  limit: number;
  country: string;
  language: string;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet?: string;
  host?: string;
}

export interface SearchResultEnvelope {
  engine: "google";
  query: string;
  url: string;
  resultCount: number;
  results: SearchResultItem[];
}

export async function searchGoogle(
  query: string,
  apiKey: string,
  options: SearchOptions,
): Promise<SearchResultEnvelope> {
  const searchUrl = buildGoogleSearchUrl(query, options);
  const scraped = await scrapeRenderedHtml(searchUrl, apiKey);
  const results = parseGoogleSearchResults(scraped.content, options.limit);

  return {
    engine: "google",
    query,
    url: searchUrl,
    resultCount: results.length,
    results,
  };
}

function buildGoogleSearchUrl(query: string, options: SearchOptions): string {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(Math.max(options.limit, 1), 100)));
  url.searchParams.set("hl", options.language || "en");
  url.searchParams.set("gl", (options.country || "us").toLowerCase());
  return url.toString();
}

function parseGoogleSearchResults(html: string, limit: number): SearchResultItem[] {
  const results: SearchResultItem[] = [];
  const seen = new Set<string>();
  const anchorRegex = /<a\b[^>]*href="\/url\?q=([^"&]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const decodedUrl = decodeGoogleTarget(match[1]);
    if (!decodedUrl || seen.has(decodedUrl)) {
      continue;
    }

    if (!isUsefulSearchResult(decodedUrl)) {
      continue;
    }

    const title = cleanInlineHtml(match[2]);
    if (!title || title.length < 3) {
      continue;
    }

    const snippet = extractNearbySnippet(html, match.index ?? 0);
    const host = getHost(decodedUrl);
    results.push({
      title,
      url: decodedUrl,
      snippet: snippet || undefined,
      host,
    });
    seen.add(decodedUrl);

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

function decodeGoogleTarget(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    const parsed = new URL(decoded);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function isUsefulSearchResult(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "google.com" || host.endsWith(".google.com")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function extractNearbySnippet(html: string, startIndex: number): string {
  const nearby = html.slice(startIndex, startIndex + 4000);
  const snippetMatch =
    nearby.match(/<div\b[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ??
    nearby.match(/<span\b[^>]*class="[^"]*aCOpRe[^"]*"[^>]*>([\s\S]*?)<\/span>/i);

  if (!snippetMatch) {
    return "";
  }

  return cleanInlineHtml(snippetMatch[1]);
}

function cleanInlineHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
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

function getHost(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
