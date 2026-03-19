import { requireCloudToken } from "../config";
import { CliError } from "./errors";
import { scrapeJsonViaBrowser } from "./browserStructured";
import type { ResolvedConfig } from "./types";
import {
  scrapeJson,
  type ScrapeJsonData,
  type ScrapeJsonResult,
  type ScrapeRequestMeta,
  type ScrapeRequestOptions,
} from "./unlocker";

export type StructuredRenderSource = "unlocker" | "browser";
export type StructuredFallbackMode = "none" | "browser";

export interface StructuredScrapeEnvelope {
  url: string;
  status: number | null | undefined;
  renderSource: StructuredRenderSource;
  fallbackAttempted: boolean;
  fallbackUsed: boolean;
  fallbackReason?: string;
  browserRecommended?: boolean;
  warning?: string;
  request: ScrapeRequestMeta;
  data: ScrapeJsonData;
}

class StructuredBlockedPageError extends CliError {
  public readonly status: number | null | undefined;
  public readonly request: ScrapeRequestMeta;

  public constructor(
    url: string,
    status: number | null | undefined,
    request: ScrapeRequestMeta,
    reason: string,
    options: {
      fallbackAttempted: boolean;
      fallbackUsed: boolean;
      fallbackReason?: string;
    },
  ) {
    super(
      `Structured scrape returned a likely blocked or challenge page for ${url}.`,
      1,
      [
        `Reason: ${reason}.`,
        options.fallbackAttempted
          ? options.fallbackUsed
            ? "Browser fallback was used but the page still looked blocked."
            : `Browser fallback was attempted but not used. ${options.fallbackReason ?? "It did not improve the result."}`
          : "Retry with --fallback browser, use read --source browser, or switch to gologin-local-agent-browser for full rendered DOM.",
      ].join("\n"),
      "BLOCKED_PAGE",
    );
    this.status = status;
    this.request = request;
  }
}

export async function scrapeStructuredJson(
  url: string,
  config: ResolvedConfig,
  apiKey: string,
  options: {
    fallback?: StructuredFallbackMode;
    profile?: string;
    request?: ScrapeRequestOptions;
  } = {},
): Promise<StructuredScrapeEnvelope> {
  const result = await scrapeJson(url, apiKey, options.request);
  const fallbackMode = options.fallback ?? "none";
  let data = result.data;
  let renderSource: StructuredRenderSource = "unlocker";
  let fallbackAttempted = false;
  let fallbackUsed = false;
  let fallbackReason: string | undefined;
  let { browserRecommended, warning } = buildStructuredFallbackAdvisory(data);

  if (fallbackMode === "browser" && shouldUseBrowserFallback(data)) {
    fallbackAttempted = true;
    requireCloudToken(config);
    const browserData = await scrapeJsonViaBrowser(url, config, {
      profile: options.profile,
    });

    if (isBrowserDataBetter(data, browserData)) {
      data = browserData;
      renderSource = "browser";
      fallbackUsed = true;
      fallbackReason = "unlocker structured data looked incomplete";
      browserRecommended = false;
      warning = undefined;
    } else {
      fallbackReason = "browser fallback did not improve structured output";
    }
  }

  const blockedReason = detectStructuredBlockReason(data);
  if (blockedReason) {
    throw new StructuredBlockedPageError(url, result.status, result.request, blockedReason, {
      fallbackAttempted,
      fallbackUsed,
      fallbackReason,
    });
  }

  return makeStructuredScrapeEnvelope(url, result, data, {
    renderSource,
    fallbackAttempted,
    fallbackUsed,
    fallbackReason,
    browserRecommended,
    warning,
  });
}

export function makeStructuredScrapeEnvelope(
  url: string,
  result: Pick<ScrapeJsonResult, "status" | "request">,
  data: ScrapeJsonData,
  options: {
    renderSource?: StructuredRenderSource;
    fallbackAttempted?: boolean;
    fallbackUsed?: boolean;
    fallbackReason?: string;
    browserRecommended?: boolean;
    warning?: string;
  } = {},
): StructuredScrapeEnvelope {
  return {
    url,
    status: result.status,
    renderSource: options.renderSource ?? "unlocker",
    fallbackAttempted: options.fallbackAttempted ?? false,
    fallbackUsed: options.fallbackUsed ?? false,
    fallbackReason: options.fallbackReason,
    browserRecommended: options.browserRecommended,
    warning: options.warning,
    request: result.request,
    data,
  };
}

export function normalizeStructuredFallbackMode(value: string | undefined): StructuredFallbackMode {
  if (!value || value === "none") {
    return "none";
  }

  if (value === "browser") {
    return "browser";
  }

  throw new Error(`Unsupported scrape-json fallback mode: ${value}`);
}

export function shouldUseBrowserFallback(data: ScrapeJsonData): boolean {
  if (detectStructuredBlockReason(data)) {
    return true;
  }

  const firstH1 = data.headingsByLevel.h1[0];
  if (!firstH1) {
    return true;
  }

  return looksSuspiciousHeadingText(firstH1);
}

export function buildStructuredFallbackAdvisory(
  data: ScrapeJsonData
): { browserRecommended: boolean; warning?: string } {
  const blockedReason = detectStructuredBlockReason(data);
  if (blockedReason) {
    return {
      browserRecommended: true,
      warning: `Structured output looks blocked or challenge-gated (${blockedReason}). Retry with --fallback browser or use a rendered browser path.`,
    };
  }

  if (!shouldUseBrowserFallback(data)) {
    return { browserRecommended: false };
  }

  return {
    browserRecommended: true,
    warning: "Structured output looks incomplete or client-rendered. Retry with --fallback browser or use read/open for rendered DOM.",
  };
}

function looksSuspiciousHeadingText(value: string): boolean {
  return /function\s*\(|window\.|document\.|const\s+|let\s+|var\s+|=>|import\s+/i.test(value) || value.length > 240;
}

function isBrowserDataBetter(current: ScrapeJsonData, candidate: ScrapeJsonData): boolean {
  const currentBlocked = Boolean(detectStructuredBlockReason(current));
  const candidateBlocked = Boolean(detectStructuredBlockReason(candidate));
  if (currentBlocked !== candidateBlocked) {
    return currentBlocked && !candidateBlocked;
  }

  if (candidate.headingsByLevel.h1.length > current.headingsByLevel.h1.length) {
    return true;
  }

  if (!current.title && Boolean(candidate.title)) {
    return true;
  }

  if (candidate.headings.length > current.headings.length) {
    return true;
  }

  return false;
}

export function detectStructuredBlockReason(data: ScrapeJsonData): string | undefined {
  const candidates = [
    data.title,
    data.description,
    ...data.headingsByLevel.h1.slice(0, 2),
    ...data.headingsByLevel.h2.slice(0, 2),
  ].filter((value): value is string => Boolean(value && value.trim()));

  for (const candidate of candidates) {
    const reason = classifyBlockedText(candidate);
    if (reason) {
      return reason;
    }
  }

  return undefined;
}

function classifyBlockedText(value: string): string | undefined {
  const text = value.trim();

  if (
    /(verify you are human|verify you are a human|are you human|captcha|security check|attention required|just a moment|checking your browser|enable javascript and cookies to continue|one more step)/i.test(
      text,
    )
  ) {
    return "challenge markers matched the page title or heading";
  }

  if (
    /(access denied|forbidden|blocked request|request blocked|request unsuccessful|temporarily blocked|temporarily unavailable|you have been blocked|access to this page has been denied)/i.test(
      text,
    )
  ) {
    return "blocked-page markers matched the page title or heading";
  }

  return undefined;
}
