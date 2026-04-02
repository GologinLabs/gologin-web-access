import { load } from "cheerio";
import type { ScrapeJsonData } from "./unlocker";

export type PageOutcome = "ok" | "empty" | "incomplete" | "authwall" | "challenge" | "blocked" | "cookie_wall";
export type NextActionHint = "retry_with_browser" | "use_logged_in_session" | "use_local_profile";

export interface PageOutcomeAssessment {
  outcome: PageOutcome;
  reason?: string;
  nextActionHint?: NextActionHint;
  browserRecommended: boolean;
  warning?: string;
}

export function assessStructuredPageOutcome(data: ScrapeJsonData): PageOutcomeAssessment {
  const authwallReason = detectStructuredAuthwallReason(data);
  if (authwallReason) {
    return buildAssessment("authwall", authwallReason, "use_logged_in_session", true);
  }

  const challengeReason = detectStructuredChallengeReason(data);
  if (challengeReason) {
    return buildAssessment("challenge", challengeReason, "use_local_profile", true);
  }

  const blockedReason = detectStructuredBlockedReason(data);
  if (blockedReason) {
    return buildAssessment("blocked", blockedReason, "use_local_profile", true);
  }

  const cookieWallReason = detectStructuredCookieWallReason(data);
  if (cookieWallReason) {
    return buildAssessment("cookie_wall", cookieWallReason, "retry_with_browser", true);
  }

  if (isStructuredDataEmpty(data)) {
    return buildAssessment(
      "empty",
      "Structured output contained almost no readable fields",
      "retry_with_browser",
      true,
    );
  }

  if (isStructuredDataLikelyIncomplete(data)) {
    return buildAssessment(
      "incomplete",
      "Structured output looks incomplete or client-rendered",
      "retry_with_browser",
      true,
    );
  }

  return {
    outcome: "ok",
    browserRecommended: false,
  };
}

export function assessReadablePageOutcome(
  html: string,
  content: string,
  options: {
    looksIncomplete?: boolean;
    incompleteReason?: string;
  } = {},
): PageOutcomeAssessment {
  const $ = load(html);
  const title = $("title").first().text().trim();
  const firstHeading = $("h1").first().text().trim();
  const canonical = ($("link[rel='canonical']").attr("href") ?? "").trim();
  const normalizedText = normalizeText(content);
  const inputCount = $("input, textarea, select").length;
  const formCount = $("form").length;
  const candidates = [
    title,
    firstHeading,
    canonical,
    normalizedText.slice(0, 1_500),
  ].filter(Boolean);

  if (canonical.includes("/authwall")) {
    return buildAssessment(
      "authwall",
      "Canonical URL points to an authwall path",
      "use_logged_in_session",
      true,
    );
  }

  for (const candidate of candidates) {
    const authwallReason = classifyAuthwallText(candidate);
    if (authwallReason && (formCount > 0 || inputCount > 0 || normalizedText.length < 3_000)) {
      return buildAssessment("authwall", authwallReason, "use_logged_in_session", true);
    }
  }

  for (const candidate of candidates) {
    const challengeReason = classifyChallengeText(candidate);
    if (challengeReason) {
      return buildAssessment("challenge", challengeReason, "use_local_profile", true);
    }
  }

  for (const candidate of candidates) {
    const blockedReason = classifyBlockedText(candidate);
    if (blockedReason) {
      return buildAssessment("blocked", blockedReason, "use_local_profile", true);
    }
  }

  for (const candidate of candidates) {
    const cookieWallReason = classifyCookieWallText(candidate);
    if (cookieWallReason && (formCount > 0 || normalizedText.length < 2_500)) {
      return buildAssessment("cookie_wall", cookieWallReason, "retry_with_browser", true);
    }
  }

  if (normalizedText.length === 0) {
    return buildAssessment("empty", "Readable output was empty", "retry_with_browser", true);
  }

  if (options.looksIncomplete) {
    return buildAssessment(
      "incomplete",
      options.incompleteReason ?? "Readable output looks incomplete",
      "retry_with_browser",
      true,
    );
  }

  return {
    outcome: "ok",
    browserRecommended: false,
  };
}

export function detectStructuredChallengeReason(data: ScrapeJsonData): string | undefined {
  return findStructuredReason(data, classifyChallengeText);
}

export function detectStructuredBlockedReason(data: ScrapeJsonData): string | undefined {
  return findStructuredReason(data, classifyBlockedText);
}

export function detectStructuredAuthwallReason(data: ScrapeJsonData): string | undefined {
  if ((data.canonical ?? "").includes("/authwall")) {
    return "Canonical URL points to an authwall path";
  }

  return findStructuredReason(data, classifyAuthwallText);
}

export function detectStructuredCookieWallReason(data: ScrapeJsonData): string | undefined {
  return findStructuredReason(data, classifyCookieWallText);
}

export function describeNextActionHint(hint: NextActionHint | undefined): string | undefined {
  switch (hint) {
    case "retry_with_browser":
      return "Retry with --source browser or --fallback browser.";
    case "use_logged_in_session":
      return "Use a logged-in browser session or a GoLogin profile with saved cookies.";
    case "use_local_profile":
      return "Switch to gologin-local-agent-browser or another profile-backed browser path.";
    default:
      return undefined;
  }
}

function buildAssessment(
  outcome: Exclude<PageOutcome, "ok">,
  reason: string,
  nextActionHint: NextActionHint,
  browserRecommended: boolean,
): PageOutcomeAssessment {
  const actionText = describeNextActionHint(nextActionHint);
  return {
    outcome,
    reason,
    nextActionHint,
    browserRecommended,
    warning: actionText ? `${capitalizeOutcome(outcome)} detected: ${reason}. ${actionText}` : `${capitalizeOutcome(outcome)} detected: ${reason}.`,
  };
}

function capitalizeOutcome(value: Exclude<PageOutcome, "ok">): string {
  return value.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());
}

function isStructuredDataEmpty(data: ScrapeJsonData): boolean {
  return !data.title && !data.description && data.headings.length === 0 && data.links.length === 0;
}

function isStructuredDataLikelyIncomplete(data: ScrapeJsonData): boolean {
  const firstH1 = data.headingsByLevel.h1[0];
  if (!firstH1) {
    return true;
  }

  if (looksSuspiciousHeadingText(firstH1)) {
    return true;
  }

  if (!data.title && data.headings.length < 2) {
    return true;
  }

  return false;
}

function looksSuspiciousHeadingText(value: string): boolean {
  return /function\s*\(|window\.|document\.|const\s+|let\s+|var\s+|=>|import\s+/i.test(value) || value.length > 240;
}

function findStructuredReason(
  data: ScrapeJsonData,
  matcher: (value: string) => string | undefined,
): string | undefined {
  const candidates = [
    data.title,
    data.description,
    data.canonical,
    ...data.headingsByLevel.h1.slice(0, 2),
    ...data.headingsByLevel.h2.slice(0, 2),
  ].filter((value): value is string => Boolean(value && value.trim()));

  for (const candidate of candidates) {
    const reason = matcher(candidate);
    if (reason) {
      return reason;
    }
  }

  return undefined;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function classifyChallengeText(value: string): string | undefined {
  if (
    /(verify you are human|verify you are a human|are you human|captcha|security check|attention required|just a moment|checking your browser|enable javascript and cookies to continue|one more step|security verification)/i.test(
      value,
    )
  ) {
    return "Challenge or verification markers matched the page";
  }

  return undefined;
}

function classifyBlockedText(value: string): string | undefined {
  if (
    /(access denied|forbidden|blocked request|request blocked|request unsuccessful|temporarily blocked|temporarily unavailable|you have been blocked|access to this page has been denied)/i.test(
      value,
    )
  ) {
    return "Blocked-page markers matched the page";
  }

  return undefined;
}

function classifyAuthwallText(value: string): string | undefined {
  if (
    /(sign in to view|sign in to continue|log in to continue|join to view|join now|join linkedin|join to continue|sign up to view|create a free account|view full profile|view profile|join to see more)/i.test(
      value,
    )
  ) {
    return "Login or signup wall markers matched the page";
  }

  return undefined;
}

function classifyCookieWallText(value: string): string | undefined {
  if (
    /(cookie preferences|accept cookies|manage cookies|consent preferences|we use cookies|your privacy choices|respects your privacy)/i.test(
      value,
    )
  ) {
    return "Cookie or consent wall markers matched the page";
  }

  return undefined;
}
