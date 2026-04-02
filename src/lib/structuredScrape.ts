import { requireCloudToken } from "../config";
import { CliError } from "./errors";
import { scrapeJsonViaBrowser } from "./browserStructured";
import {
  assessStructuredPageOutcome,
  describeNextActionHint,
  detectStructuredBlockedReason,
  type NextActionHint,
  type PageOutcome,
} from "./pageOutcome";
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
  outcome: PageOutcome;
  outcomeReason?: string;
  nextActionHint?: NextActionHint;
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
  public readonly outcome: PageOutcome;
  public readonly nextActionHint?: NextActionHint;

  public constructor(
    url: string,
    status: number | null | undefined,
    request: ScrapeRequestMeta,
    outcome: PageOutcome,
    reason: string,
    nextActionHint: NextActionHint | undefined,
    options: {
      fallbackAttempted: boolean;
      fallbackUsed: boolean;
      fallbackReason?: string;
    },
  ) {
    super(
      `Structured scrape returned ${outcome.replace(/_/g, " ")} content for ${url}.`,
      1,
      [
        `Reason: ${reason}.`,
        options.fallbackAttempted
          ? options.fallbackUsed
            ? "Browser fallback was used but the page still looked blocked."
            : `Browser fallback was attempted but not used. ${options.fallbackReason ?? "It did not improve the result."}`
          : describeNextActionHint(nextActionHint) ??
            "Retry with --fallback browser, use read --source browser, or switch to gologin-local-agent-browser for full rendered DOM.",
      ].join("\n"),
      outcomeToErrorCode(outcome),
    );
    this.status = status;
    this.request = request;
    this.outcome = outcome;
    this.nextActionHint = nextActionHint;
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
  let { outcome, reason, nextActionHint, browserRecommended, warning } = assessStructuredPageOutcome(data);

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
      ({ outcome, reason, nextActionHint, browserRecommended, warning } = assessStructuredPageOutcome(data));
    } else {
      fallbackReason = "browser fallback did not improve structured output";
    }
  }

  if (outcome === "authwall" || outcome === "challenge" || outcome === "blocked" || outcome === "cookie_wall") {
    throw new StructuredBlockedPageError(url, result.status, result.request, outcome, reason ?? "Outcome matched page markers", nextActionHint, {
      fallbackAttempted,
      fallbackUsed,
      fallbackReason,
    });
  }

  return makeStructuredScrapeEnvelope(url, result, data, {
    renderSource,
    outcome,
    outcomeReason: reason,
    nextActionHint,
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
    outcome?: PageOutcome;
    outcomeReason?: string;
    nextActionHint?: NextActionHint;
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
    outcome: options.outcome ?? "ok",
    outcomeReason: options.outcomeReason,
    nextActionHint: options.nextActionHint,
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
  return assessStructuredPageOutcome(data).outcome !== "ok";
}

export function buildStructuredFallbackAdvisory(
  data: ScrapeJsonData
): { browserRecommended: boolean; warning?: string } {
  const assessment = assessStructuredPageOutcome(data);
  return {
    browserRecommended: assessment.browserRecommended,
    warning: assessment.warning,
  };
}

function isBrowserDataBetter(current: ScrapeJsonData, candidate: ScrapeJsonData): boolean {
  const currentBlocked = Boolean(detectStructuredBlockedReason(current));
  const candidateBlocked = Boolean(detectStructuredBlockedReason(candidate));
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
  return (
    assessStructuredPageOutcome(data).reason ??
    detectStructuredBlockedReason(data)
  );
}

function outcomeToErrorCode(outcome: PageOutcome): string {
  switch (outcome) {
    case "authwall":
      return "AUTHWALL_PAGE";
    case "challenge":
      return "CHALLENGE_PAGE";
    case "cookie_wall":
      return "COOKIE_WALL_PAGE";
    case "blocked":
      return "BLOCKED_PAGE";
    case "empty":
      return "EMPTY_PAGE";
    case "incomplete":
      return "INCOMPLETE_PAGE";
    case "ok":
    default:
      return "PAGE_OUTCOME";
  }
}
