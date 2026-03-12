import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import * as cheerio from "cheerio";
import { resolveProfileId } from "../config";
import { CliError } from "./errors";
import { runAgentCommandCapture } from "./agentCli";
import type { ResolvedConfig } from "./types";
import { scrapeRenderedHtml } from "./unlocker";

export type SearchSourceMode = "auto" | "unlocker" | "browser";
export type SearchProvider = "google" | "bing" | "duckduckgo";
export type SearchTransport = "unlocker" | "browser";

export interface SearchOptions {
  limit: number;
  country: string;
  language: string;
  source: SearchSourceMode;
}

export interface SearchResultItem {
  position: number;
  title: string;
  url: string;
  snippet?: string;
  host?: string;
}

export interface SearchAttempt {
  engine: SearchProvider;
  source: SearchTransport;
  url: string;
  ok: boolean;
  resultCount: number;
  warning?: string;
  error?: string;
}

export interface SearchResultEnvelope {
  engine: SearchProvider;
  source: SearchTransport;
  query: string;
  url: string;
  requestedLimit: number;
  resultCount: number;
  returnedCount: number;
  results: SearchResultItem[];
  attempts: SearchAttempt[];
  warnings: string[];
  cacheHit: boolean;
  cachedAt?: string;
  cacheTtlMs: number;
}

type SearchAttemptPlanItem = {
  engine: SearchProvider;
  source: SearchTransport;
};

type SearchExecutor = (
  query: string,
  config: ResolvedConfig,
  options: SearchOptions,
  engine: SearchProvider,
) => Promise<{
  url: string;
  results: SearchResultItem[];
}>;

type SearchPageState = "valid" | "empty" | "blocked" | "invalid";

interface CachedSearchRecord {
  version: 1;
  createdAt: string;
  query: string;
  options: SearchOptions;
  envelope: Partial<Omit<SearchResultEnvelope, "cacheHit" | "cachedAt">> & {
    engine: SearchProvider;
    source: SearchTransport;
    query: string;
    url: string;
    resultCount: number;
    results: SearchResultItem[];
    attempts: SearchAttempt[];
  };
}

const SEARCH_CACHE_VERSION = 1;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

export async function searchWeb(
  query: string,
  config: ResolvedConfig,
  options: SearchOptions,
): Promise<SearchResultEnvelope> {
  const cached = await readSearchCache(config, query, options);
  if (cached) {
    return cached;
  }

  const attempts: SearchAttempt[] = [];
  let lastError: Error | undefined;
  let emptyCandidate:
    | {
        engine: SearchProvider;
        source: SearchTransport;
        url: string;
        results: SearchResultItem[];
        warning?: string;
      }
    | undefined;

  for (const planItem of buildSearchAttemptPlan(options.source, Boolean(config.cloudToken))) {
    const searchUrl = buildSearchUrl(planItem.engine, query, options);

    try {
      const executor =
        planItem.source === "unlocker" ? searchViaUnlocker : searchViaBrowser;
      const result = await executor(query, config, options, planItem.engine);
      const attempt: SearchAttempt = {
        engine: planItem.engine,
        source: planItem.source,
        url: result.url,
        ok: result.results.length > 0,
        resultCount: result.results.length,
      };

      if (result.results.length === 0) {
        attempt.warning = `No results parsed from ${planItem.engine} ${planItem.source} response`;
      }
      attempts.push(attempt);

      if (result.results.length > 0) {
        const warnings = buildSearchWarnings(options.limit, result.results.length);
        const envelope: SearchResultEnvelope = {
          engine: planItem.engine,
          source: planItem.source,
          query,
          url: result.url,
          requestedLimit: options.limit,
          resultCount: result.results.length,
          returnedCount: result.results.length,
          results: result.results,
          attempts,
          warnings,
          cacheHit: false,
          cacheTtlMs: SEARCH_CACHE_TTL_MS,
        };
        await writeSearchCache(config, query, options, envelope);
        return envelope;
      }

      emptyCandidate ??= {
        engine: planItem.engine,
        source: planItem.source,
        url: result.url,
        results: result.results,
        warning: attempt.warning,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({
        engine: planItem.engine,
        source: planItem.source,
        url: searchUrl,
        ok: false,
        resultCount: 0,
        error: message,
      });
      lastError = error instanceof Error ? error : new Error(message);
    }
  }

  if (emptyCandidate) {
    const warnings = [
      ...(emptyCandidate.warning ? [emptyCandidate.warning] : []),
      ...buildSearchWarnings(options.limit, 0),
    ];
    const envelope: SearchResultEnvelope = {
      engine: emptyCandidate.engine,
      source: emptyCandidate.source,
      query,
      url: emptyCandidate.url,
      requestedLimit: options.limit,
      resultCount: 0,
      returnedCount: 0,
      results: [],
      attempts,
      warnings,
      cacheHit: false,
      cacheTtlMs: SEARCH_CACHE_TTL_MS,
    };
    await writeSearchCache(config, query, options, envelope);
    return envelope;
  }

  const detail = attempts
    .map((attempt) =>
      `${attempt.source}:${attempt.engine}=${attempt.ok ? `ok(${attempt.resultCount})` : `error(${attempt.error})`}`,
    )
    .join(", ");

  throw new CliError(
    "Search failed across all available search paths.",
    1,
    detail || lastError?.message,
  );
}

export function buildSearchAttemptPlan(
  source: SearchSourceMode,
  hasCloudToken: boolean,
): SearchAttemptPlanItem[] {
  if (source === "browser") {
    return hasCloudToken ? [{ engine: "bing", source: "browser" }] : [];
  }

  if (source === "unlocker") {
    return [
      { engine: "google", source: "unlocker" },
      { engine: "duckduckgo", source: "unlocker" },
      { engine: "bing", source: "unlocker" },
    ];
  }

  const plan: SearchAttemptPlanItem[] = [
    { engine: "google", source: "unlocker" },
    { engine: "duckduckgo", source: "unlocker" },
    { engine: "bing", source: "unlocker" },
  ];

  if (hasCloudToken) {
    plan.push({ engine: "bing", source: "browser" });
  }

  return plan;
}

export function buildSearchUrl(
  engine: SearchProvider,
  query: string,
  options: Pick<SearchOptions, "limit" | "country" | "language">,
): string {
  if (engine === "bing") {
    const url = new URL("https://www.bing.com/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(Math.max(options.limit, 1), 50)));
    url.searchParams.set("cc", (options.country || "us").toLowerCase());
    const locale = normalizeBingLocale(options.country, options.language);
    url.searchParams.set("setlang", locale);
    url.searchParams.set("mkt", locale);
    return url.toString();
  }

  if (engine === "duckduckgo") {
    const url = new URL("https://html.duckduckgo.com/html/");
    url.searchParams.set("q", query);
    url.searchParams.set("kl", normalizeDuckDuckGoLocale(options.country, options.language));
    return url.toString();
  }

  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(Math.max(options.limit, 1), 100)));
  url.searchParams.set("hl", options.language || "en");
  url.searchParams.set("gl", (options.country || "us").toLowerCase());
  return url.toString();
}

export function parseGoogleSearchResults(html: string, limit: number): SearchResultItem[] {
  const results: SearchResultItem[] = [];
  const seen = new Set<string>();
  const anchorRegex = /<a\b[^>]*href="\/url\?q=([^"&]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const decodedUrl = decodeGoogleTarget(match[1]);
    if (!decodedUrl || seen.has(decodedUrl) || !isUsefulSearchResult(decodedUrl)) {
      continue;
    }

    const title = cleanInlineHtml(match[2]);
    if (!title || title.length < 3) {
      continue;
    }

    results.push({
      position: results.length + 1,
      title,
      url: decodedUrl,
      snippet: extractGoogleSnippet(html, match.index ?? 0) || undefined,
      host: getHost(decodedUrl),
    });
    seen.add(decodedUrl);

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

export function parseBingSearchResults(html: string, limit: number): SearchResultItem[] {
  const $ = cheerio.load(html);
  const results: SearchResultItem[] = [];
  const seen = new Set<string>();

  $("li.b_algo").each((_, element) => {
    if (results.length >= limit) {
      return false;
    }

    const anchor = $(element).find("h2 a").first();
    const href = normalizeAbsoluteUrl(anchor.attr("href"));
    const title = anchor.text().replace(/\s+/g, " ").trim();
    if (!href || !title || seen.has(href)) {
      return;
    }

    const snippet = $(element)
      .find(".b_caption p, p")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    results.push({
      position: results.length + 1,
      title,
      url: href,
      snippet: snippet || undefined,
      host: getHost(href),
    });
    seen.add(href);
  });

  return results;
}

export function parseDuckDuckGoSearchResults(html: string, limit: number): SearchResultItem[] {
  const $ = cheerio.load(html);
  const results: SearchResultItem[] = [];
  const seen = new Set<string>();

  $("a.result__a").each((_, element) => {
    if (results.length >= limit) {
      return false;
    }

    const anchor = $(element);
    const href = normalizeAbsoluteUrl(anchor.attr("href"));
    const title = anchor.text().replace(/\s+/g, " ").trim();
    if (!href || !title || seen.has(href)) {
      return;
    }

    const snippet = anchor
      .closest(".result")
      .find(".result__snippet")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    results.push({
      position: results.length + 1,
      title,
      url: href,
      snippet: snippet || undefined,
      host: getHost(href),
    });
    seen.add(href);
  });

  return results;
}

export function classifySearchPage(
  engine: SearchProvider,
  html: string,
  results: SearchResultItem[],
): SearchPageState {
  const lower = html.toLowerCase();
  if (matchesBlockedSearchPage(engine, lower)) {
    return "blocked";
  }

  if (results.length > 0) {
    return "valid";
  }

  if (matchesEmptySearchPage(engine, lower) || matchesValidSearchShell(engine, lower)) {
    return "empty";
  }

  return "invalid";
}

async function searchViaUnlocker(
  query: string,
  config: ResolvedConfig,
  options: SearchOptions,
  engine: SearchProvider,
): Promise<{ url: string; results: SearchResultItem[] }> {
  if (!config.webUnlockerApiKey) {
    throw new CliError("Missing GOLOGIN_WEB_UNLOCKER_API_KEY for unlocker search.");
  }

  const searchUrl = buildSearchUrl(engine, query, options);
  const scraped = await scrapeRenderedHtml(searchUrl, config.webUnlockerApiKey);
  const results =
    engine === "google"
      ? parseGoogleSearchResults(scraped.content, options.limit)
      : engine === "bing"
        ? parseBingSearchResults(scraped.content, options.limit)
        : parseDuckDuckGoSearchResults(scraped.content, options.limit);
  const pageState = classifySearchPage(engine, scraped.content, results);

  if (pageState === "blocked") {
    throw new CliError(`Unlocker search was blocked on ${engine}.`, 1);
  }

  if (pageState === "invalid") {
    throw new CliError(`Unlocker search did not return a valid ${engine} search results page.`, 1);
  }

  return {
    url: searchUrl,
    results,
  };
}

async function searchViaBrowser(
  query: string,
  config: ResolvedConfig,
  options: SearchOptions,
  engine: SearchProvider,
): Promise<{ url: string; results: SearchResultItem[] }> {
  if (!config.cloudToken) {
    throw new CliError("Missing GOLOGIN_CLOUD_TOKEN for browser search fallback.");
  }

  const sessionId = `search-${randomUUID()}`;
  const searchUrl = buildSearchUrl(engine, query, options);
  const openArgs = ["open", searchUrl, "--session", sessionId];
  const profileId = resolveProfileId(config);
  if (profileId) {
    openArgs.push("--profile", profileId);
  }

  const open = await runAgentCommandCapture(openArgs, config);
  ensureAgentCommandOk("open", open, searchUrl);

  try {
    const evalExpression =
      engine === "bing"
        ? buildBingBrowserExtractionExpression(options.limit)
        : buildGoogleBrowserExtractionExpression(options.limit);
    const evaluated = await runAgentCommandCapture(
      ["eval", evalExpression, "--json", "--session", sessionId],
      config,
    );
    ensureAgentCommandOk("eval", evaluated, searchUrl);

    const payload = JSON.parse(evaluated.stdout.trim()) as {
      results?: SearchResultItem[];
      blocked?: boolean;
      title?: string;
    };
    const results = Array.isArray(payload.results)
      ? payload.results
          .map((item) => ({
            ...item,
            url: normalizeAbsoluteUrl(item.url) ?? item.url,
            host: normalizeAbsoluteUrl(item.url)
              ? getHost(normalizeAbsoluteUrl(item.url)!)
              : item.host,
          }))
          .filter((item) => Boolean(item.url))
      : [];

    if (payload.blocked) {
      throw new CliError(
        `Browser search was blocked on ${engine}.`,
        1,
        payload.title ? `Blocked page title: ${payload.title}` : undefined,
      );
    }

    return {
      url: searchUrl,
      results,
    };
  } finally {
    await runAgentCommandCapture(["close", "--session", sessionId], config).catch(() => undefined);
  }
}

function ensureAgentCommandOk(
  step: string,
  response: { exitCode: number; stdout: string; stderr: string },
  url: string,
): void {
  if (response.exitCode === 0) {
    return;
  }

  const message = response.stderr.trim() || response.stdout.trim() || `Command failed while handling ${url}`;
  throw new CliError(`Browser search ${step} failed.`, 1, message);
}

function buildBingBrowserExtractionExpression(limit: number): string {
  return `(() => {
    const items = [];
    const seen = new Set();
    const nodes = Array.from(document.querySelectorAll("li.b_algo"));
    for (const node of nodes) {
      const link = node.querySelector("h2 a");
      const href = link?.href;
      const title = link?.textContent?.replace(/\\s+/g, " ").trim();
      if (!href || !title || seen.has(href)) continue;
      let host;
      try { host = new URL(href).hostname; } catch {}
      const snippet = node.querySelector(".b_caption p, p")?.textContent?.replace(/\\s+/g, " ").trim() || undefined;
      items.push({ title, url: href, snippet, host });
      seen.add(href);
      if (items.length >= ${Math.max(limit, 1)}) break;
    }
    const body = document.body.innerText || "";
    const blocked =
      body.includes("One last step") ||
      body.includes("Please solve the challenge below to continue") ||
      body.includes("Enter the characters you see below");
    return {
      blocked,
      title: document.title,
      results: items
    };
  })()`;
}

function buildGoogleBrowserExtractionExpression(limit: number): string {
  return `(() => {
    const blocked = location.pathname.startsWith("/sorry/") || document.body.innerText.includes("About this page");
    const items = [];
    const seen = new Set();
    const nodes = Array.from(document.querySelectorAll('a[href^="/url?q="]'));
    for (const node of nodes) {
      const raw = node.getAttribute("href") || "";
      const match = raw.match(/\\/url\\?q=([^&]+)/);
      if (!match) continue;
      let href;
      try { href = decodeURIComponent(match[1]); } catch { continue; }
      const title = node.textContent?.replace(/\\s+/g, " ").trim();
      if (!href || !title || seen.has(href)) continue;
      let host;
      try { host = new URL(href).hostname; } catch {}
      items.push({ title, url: href, host });
      seen.add(href);
      if (items.length >= ${Math.max(limit, 1)}) break;
    }
    return {
      blocked,
      title: document.title,
      results: items
    };
  })()`;
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

function matchesBlockedSearchPage(engine: SearchProvider, lowerHtml: string): boolean {
  const markers =
    engine === "google"
      ? [
          "our systems have detected unusual traffic",
          "about this page",
          "/sorry/",
          "to continue, please type the characters below",
          "captcha",
        ]
      : engine === "bing"
        ? [
            "one last step",
            "please solve the challenge below to continue",
            "enter the characters you see below",
            "verify you are human",
            "captcha",
          ]
        : ["anomaly", "captcha", "automated requests", "unusual traffic"];

  return markers.some((marker) => lowerHtml.includes(marker));
}

function matchesEmptySearchPage(engine: SearchProvider, lowerHtml: string): boolean {
  const markers =
    engine === "google"
      ? ["did not match any documents", "no results found for"]
      : engine === "bing"
        ? ["there are no results for", "no results for"]
        : ["no results.", "no more results."];

  return markers.some((marker) => lowerHtml.includes(marker));
}

function matchesValidSearchShell(engine: SearchProvider, lowerHtml: string): boolean {
  const markers =
    engine === "google"
      ? ['name="q"', 'href="/search?', 'google search']
      : engine === "bing"
        ? ['id="b_results"', 'name="q"', 'class="b_algo"']
        : ['class="result__a"', 'name="q"', 'duckduckgo'];

  return markers.some((marker) => lowerHtml.includes(marker));
}

function extractGoogleSnippet(html: string, startIndex: number): string {
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

function buildSearchCacheKey(query: string, options: SearchOptions): string {
  return createHash("sha1")
    .update(
      JSON.stringify({
        query,
        limit: options.limit,
        country: options.country.toLowerCase(),
        language: options.language.toLowerCase(),
        source: options.source,
      }),
    )
    .digest("hex");
}

function getSearchCachePath(config: ResolvedConfig, query: string, options: SearchOptions): string {
  return path.join(config.stateDir, "search-cache", `${buildSearchCacheKey(query, options)}.json`);
}

async function readSearchCache(
  config: ResolvedConfig,
  query: string,
  options: SearchOptions,
): Promise<SearchResultEnvelope | null> {
  const cachePath = getSearchCachePath(config, query, options);

  try {
    const raw = await fs.readFile(cachePath, "utf8");
    const parsed = JSON.parse(raw) as CachedSearchRecord;
    if (parsed.version !== SEARCH_CACHE_VERSION) {
      return null;
    }

    const createdAtMs = Date.parse(parsed.createdAt);
    if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > SEARCH_CACHE_TTL_MS) {
      return null;
    }

    const normalized = normalizeCachedEnvelope(parsed.envelope, options.limit);

    return {
      ...normalized,
      cacheHit: true,
      cachedAt: parsed.createdAt,
      cacheTtlMs: SEARCH_CACHE_TTL_MS,
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return null;
    }

    return null;
  }
}

function normalizeCachedEnvelope(
  envelope: CachedSearchRecord["envelope"],
  requestedLimit: number,
): Omit<SearchResultEnvelope, "cacheHit" | "cachedAt"> {
  const results = Array.isArray(envelope.results)
    ? envelope.results.map((result, index) => ({
        ...result,
        position: typeof result.position === "number" ? result.position : index + 1,
      }))
    : [];
  const returnedCount = typeof envelope.returnedCount === "number"
    ? envelope.returnedCount
    : results.length;
  const normalizedRequestedLimit = typeof envelope.requestedLimit === "number"
    ? envelope.requestedLimit
    : requestedLimit;
  const attempts = Array.isArray(envelope.attempts)
    ? envelope.attempts.map((attempt) => normalizeCachedAttempt(attempt))
    : [];
  const warnings = Array.isArray(envelope.warnings)
    ? envelope.warnings
    : buildSearchWarnings(normalizedRequestedLimit, returnedCount);

  return {
    engine: envelope.engine,
    source: envelope.source,
    query: envelope.query,
    url: envelope.url,
    requestedLimit: normalizedRequestedLimit,
    resultCount: typeof envelope.resultCount === "number" ? envelope.resultCount : returnedCount,
    returnedCount,
    results,
    attempts,
    warnings,
    cacheTtlMs: typeof envelope.cacheTtlMs === "number" ? envelope.cacheTtlMs : SEARCH_CACHE_TTL_MS,
  };
}

function normalizeCachedAttempt(attempt: SearchAttempt): SearchAttempt {
  if (!attempt.ok || attempt.resultCount > 0 || attempt.error) {
    return attempt;
  }

  return {
    ...attempt,
    ok: false,
    warning: attempt.warning ?? `No results parsed from ${attempt.engine} ${attempt.source} response`,
  };
}

async function writeSearchCache(
  config: ResolvedConfig,
  query: string,
  options: SearchOptions,
  envelope: SearchResultEnvelope,
): Promise<void> {
  const cachePath = getSearchCachePath(config, query, options);
  const record: CachedSearchRecord = {
    version: SEARCH_CACHE_VERSION,
    createdAt: new Date().toISOString(),
    query,
    options,
    envelope: {
      engine: envelope.engine,
      source: envelope.source,
      query: envelope.query,
      url: envelope.url,
      cacheTtlMs: envelope.cacheTtlMs,
      resultCount: envelope.resultCount,
      requestedLimit: envelope.requestedLimit,
      returnedCount: envelope.returnedCount,
      results: envelope.results,
      attempts: envelope.attempts,
      warnings: envelope.warnings,
    },
  };

  try {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(record, null, 2) + "\n", "utf8");
  } catch {
    // Cache write failures should never block search results.
  }
}

function buildSearchWarnings(requestedLimit: number, returnedCount: number): string[] {
  if (returnedCount >= requestedLimit) {
    return [];
  }

  return [`Requested ${requestedLimit} results but received ${returnedCount}.`];
}

function normalizeAbsoluteUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value.startsWith("//") ? `https:${value}` : value);
    if (
      parsed.hostname.toLowerCase() === "www.bing.com" &&
      parsed.pathname.startsWith("/ck/")
    ) {
      const decoded = decodeBingTrackingUrl(parsed);
      if (decoded) {
        return decoded;
      }
    }
    if (
      parsed.hostname.toLowerCase().endsWith("duckduckgo.com") &&
      parsed.pathname.startsWith("/l/")
    ) {
      const decoded = decodeDuckDuckGoTrackingUrl(parsed);
      if (decoded) {
        return decoded;
      }
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function decodeBingTrackingUrl(parsed: URL): string | null {
  const encoded = parsed.searchParams.get("u");
  if (!encoded) {
    return null;
  }

  const payload = encoded.startsWith("a1") ? encoded.slice(2) : encoded;

  try {
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    const url = new URL(decoded);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeBingLocale(country: string, language: string): string {
  const normalizedLanguage = (language || "en").trim().toLowerCase();
  const normalizedCountry = (country || "us").trim().toUpperCase();
  if (!normalizedLanguage) {
    return `en-${normalizedCountry || "US"}`;
  }

  if (normalizedLanguage.includes("-")) {
    const [lang, region] = normalizedLanguage.split("-", 2);
    return `${lang.toLowerCase()}-${region.toUpperCase()}`;
  }

  return `${normalizedLanguage}-${normalizedCountry || "US"}`;
}

function normalizeDuckDuckGoLocale(country: string, language: string): string {
  const normalizedLanguage = (language || "en").trim().toLowerCase() || "en";
  const normalizedCountry = (country || "us").trim().toLowerCase() || "us";
  return `${normalizedCountry}-${normalizedLanguage}`;
}

function decodeDuckDuckGoTrackingUrl(parsed: URL): string | null {
  const encoded = parsed.searchParams.get("uddg");
  if (!encoded) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(encoded);
    const url = new URL(decoded);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
