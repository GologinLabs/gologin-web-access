import { requireCloudToken } from "../config";
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
  request: ScrapeRequestMeta;
  data: ScrapeJsonData;
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
    } else {
      fallbackReason = "browser fallback did not improve structured output";
    }
  }

  return makeStructuredScrapeEnvelope(url, result, data, {
    renderSource,
    fallbackAttempted,
    fallbackUsed,
    fallbackReason,
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
  } = {},
): StructuredScrapeEnvelope {
  return {
    url,
    status: result.status,
    renderSource: options.renderSource ?? "unlocker",
    fallbackAttempted: options.fallbackAttempted ?? false,
    fallbackUsed: options.fallbackUsed ?? false,
    fallbackReason: options.fallbackReason,
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
  const firstH1 = data.headingsByLevel.h1[0];
  if (!firstH1) {
    return true;
  }

  return looksSuspiciousHeadingText(firstH1);
}

function looksSuspiciousHeadingText(value: string): boolean {
  return /function\s*\(|window\.|document\.|const\s+|let\s+|var\s+|=>|import\s+/i.test(value) || value.length > 240;
}

function isBrowserDataBetter(current: ScrapeJsonData, candidate: ScrapeJsonData): boolean {
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
