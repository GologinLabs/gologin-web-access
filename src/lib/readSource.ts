import { load } from "cheerio";
import { requireCloudToken } from "../config";
import { scrapeReadableContentViaBrowser, scrapeRenderedHtmlViaBrowser } from "./browserRead";
import { assessReadablePageOutcome, type NextActionHint, type PageOutcome } from "./pageOutcome";
import type { ResolvedConfig } from "./types";
import {
  htmlToMarkdown,
  htmlToText,
  scrapeRenderedHtml,
  type ScrapeRequestMeta,
  type ScrapeRequestOptions,
} from "./unlocker";

export type ReadSourceMode = "auto" | "unlocker" | "browser";

export interface ReadContentEnvelope {
  content: string;
  renderSource: "unlocker" | "browser";
  fallbackAttempted: boolean;
  fallbackUsed: boolean;
  fallbackReason?: string;
  outcome: PageOutcome;
  outcomeReason?: string;
  nextActionHint?: NextActionHint;
  warning?: string;
  request?: ScrapeRequestMeta;
}

export interface RenderedHtmlEnvelope {
  html: string;
  renderSource: "unlocker" | "browser";
  fallbackAttempted: boolean;
  fallbackUsed: boolean;
  fallbackReason?: string;
  outcome: PageOutcome;
  outcomeReason?: string;
  nextActionHint?: NextActionHint;
  warning?: string;
  request?: ScrapeRequestMeta;
}

export function normalizeReadSourceMode(value: string | undefined, defaultMode: ReadSourceMode = "auto"): ReadSourceMode {
  if (!value) {
    return defaultMode;
  }

  if (value === "auto" || value === "unlocker" || value === "browser") {
    return value;
  }

  throw new Error(`Unsupported source mode: ${value}`);
}

export async function readMarkdownContent(
  url: string,
  config: ResolvedConfig,
  apiKey: string,
  options: {
    source?: ReadSourceMode;
    request?: ScrapeRequestOptions;
    profile?: string;
  } = {},
): Promise<ReadContentEnvelope> {
  return readReadableContent(url, config, apiKey, {
    ...options,
    format: "markdown",
  });
}

export async function readHtmlContent(
  url: string,
  config: ResolvedConfig,
  apiKey: string,
  options: {
    source?: ReadSourceMode;
    request?: ScrapeRequestOptions;
    profile?: string;
  } = {},
): Promise<ReadContentEnvelope> {
  return readReadableContent(url, config, apiKey, {
    ...options,
    format: "html",
  });
}

export async function readTextContent(
  url: string,
  config: ResolvedConfig,
  apiKey: string,
  options: {
    source?: ReadSourceMode;
    request?: ScrapeRequestOptions;
    profile?: string;
  } = {},
): Promise<ReadContentEnvelope> {
  return readReadableContent(url, config, apiKey, {
    ...options,
    format: "text",
  });
}

export async function readRenderedHtmlContent(
  url: string,
  config: ResolvedConfig,
  apiKey: string,
  options: {
    source?: ReadSourceMode;
    request?: ScrapeRequestOptions;
    profile?: string;
  } = {},
): Promise<RenderedHtmlEnvelope> {
  const source = options.source ?? "auto";

  if (source === "browser") {
    requireCloudToken(config);
    const browser = await scrapeRenderedHtmlViaBrowser(url, config, {
      profile: options.profile,
    });
    return {
      html: browser.html,
      renderSource: "browser",
      fallbackAttempted: false,
      fallbackUsed: false,
      outcome: "ok",
    };
  }

  const unlocker = await scrapeRenderedHtml(url, apiKey, options.request);
  if (source === "unlocker") {
    return {
      html: unlocker.content,
      renderSource: "unlocker",
      fallbackAttempted: false,
      fallbackUsed: false,
      outcome: "ok",
      request: unlocker.request,
    };
  }

  const unlockerText = htmlToText(unlocker.content);
  const assessment = assessReadableContent(unlocker.content, unlockerText);
  const outcomeAssessment = assessReadablePageOutcome(unlocker.content, unlockerText, {
    looksIncomplete: assessment.shouldFallback,
    incompleteReason: assessment.reason,
  });
  if (!assessment.shouldFallback) {
    return {
      html: unlocker.content,
      renderSource: "unlocker",
      fallbackAttempted: false,
      fallbackUsed: false,
      outcome: outcomeAssessment.outcome,
      outcomeReason: outcomeAssessment.reason,
      nextActionHint: outcomeAssessment.nextActionHint,
      warning: outcomeAssessment.warning,
      request: unlocker.request,
    };
  }

  if (!config.cloudToken) {
    return {
      html: unlocker.content,
      renderSource: "unlocker",
      fallbackAttempted: true,
      fallbackUsed: false,
      fallbackReason: `${assessment.reason}; GOLOGIN_TOKEN is not configured`,
      outcome: outcomeAssessment.outcome,
      outcomeReason: outcomeAssessment.reason,
      nextActionHint: outcomeAssessment.nextActionHint,
      warning: outcomeAssessment.warning,
      request: unlocker.request,
    };
  }

  const browser = await scrapeRenderedHtmlViaBrowser(url, config, {
    profile: options.profile,
  });
  return {
    html: browser.html,
    renderSource: "browser",
    fallbackAttempted: true,
    fallbackUsed: true,
    fallbackReason: assessment.reason,
    outcome: "ok",
    request: unlocker.request,
  };
}

export function assessReadableContent(
  html: string,
  content: string,
): { shouldFallback: boolean; reason?: string } {
  const $ = load(html);
  const normalizedContentLength = meaningfulTextLength(content);
  const mainLength = meaningfulTextLength($("main").first().text());
  const articleLength = meaningfulTextLength($("article").first().text());
  const paragraphCount = $("p").length;
  const headingCount = $("h1, h2, h3").length;
  const linkCount = $("a[href]").length;
  const scriptCount = $("script").length;
  const shellMarkers = /__next_data__|__nuxt__|window\.__|astro-|mintlify|vitepress|docusaurus|hydration|application\/json/i.test(html);
  const docsUiChromeMarkers = /open in chatgpt|copyask ai|copy ask ai|on this page/i.test(content);

  if (mainLength < 200 && articleLength < 200 && linkCount > 40 && normalizedContentLength < 5000) {
    return {
      shouldFallback: true,
      reason: "Unlocker returned navigation-heavy shell with weak main/article content",
    };
  }

  if (normalizedContentLength < 600 && (shellMarkers || linkCount > 30 || scriptCount > 10)) {
    return {
      shouldFallback: true,
      reason: "Unlocker returned very little readable text from a likely JS-rendered page",
    };
  }

  if (shellMarkers && mainLength < 300 && paragraphCount < 3) {
    return {
      shouldFallback: true,
      reason: "Unlocker output looks like a JS docs shell without rendered article content",
    };
  }

  if (paragraphCount < 3 && headingCount <= 1 && linkCount > 60 && scriptCount > 15) {
    return {
      shouldFallback: true,
      reason: "Unlocker output is link-heavy and content-light",
    };
  }

  if (docsUiChromeMarkers) {
    return {
      shouldFallback: true,
      reason: "Unlocker output still contains docs UI chrome and action controls",
    };
  }

  return { shouldFallback: false };
}

async function readReadableContent(
  url: string,
  config: ResolvedConfig,
  apiKey: string,
  options: {
    format: "html" | "markdown" | "text";
    source?: ReadSourceMode;
    request?: ScrapeRequestOptions;
    profile?: string;
  },
): Promise<ReadContentEnvelope> {
  const source = options.source ?? "auto";

  if (source === "browser") {
    requireCloudToken(config);
    const browser = await scrapeReadableContentViaBrowser(url, config, {
      profile: options.profile,
    });
    return {
      content: formatReadableContent(options.format, browser.html, browser.text),
      renderSource: "browser",
      fallbackAttempted: false,
      fallbackUsed: false,
      outcome: "ok",
    };
  }

  const unlocker = await scrapeRenderedHtml(url, apiKey, options.request);
  const readable = extractReadableSegmentFromHtml(unlocker.content);
  const unlockerContent = formatReadableContent(options.format, readable.html, readable.text);
  const assessment = assessReadableContent(unlocker.content, unlockerContent);
  const outcomeAssessment = assessReadablePageOutcome(unlocker.content, unlockerContent, {
    looksIncomplete: assessment.shouldFallback,
    incompleteReason: assessment.reason,
  });

  if (source === "unlocker") {
    return {
      content: unlockerContent,
      renderSource: "unlocker",
      fallbackAttempted: false,
      fallbackUsed: false,
      outcome: outcomeAssessment.outcome,
      outcomeReason: outcomeAssessment.reason,
      nextActionHint: outcomeAssessment.nextActionHint,
      warning: outcomeAssessment.warning,
      request: unlocker.request,
    };
  }

  if (!assessment.shouldFallback) {
    return {
      content: unlockerContent,
      renderSource: "unlocker",
      fallbackAttempted: false,
      fallbackUsed: false,
      outcome: outcomeAssessment.outcome,
      outcomeReason: outcomeAssessment.reason,
      nextActionHint: outcomeAssessment.nextActionHint,
      warning: outcomeAssessment.warning,
      request: unlocker.request,
    };
  }

  if (!config.cloudToken) {
    return {
      content: unlockerContent,
      renderSource: "unlocker",
      fallbackAttempted: true,
      fallbackUsed: false,
      fallbackReason: `${assessment.reason}; GOLOGIN_TOKEN is not configured`,
      outcome: outcomeAssessment.outcome,
      outcomeReason: outcomeAssessment.reason,
      nextActionHint: outcomeAssessment.nextActionHint,
      warning: outcomeAssessment.warning,
      request: unlocker.request,
    };
  }

  const browser = await scrapeReadableContentViaBrowser(url, config, {
    profile: options.profile,
  });
  const browserContent = formatReadableContent(options.format, browser.html, browser.text);

  if (meaningfulTextLength(browserContent) < Math.max(300, meaningfulTextLength(unlockerContent))) {
    return {
      content: unlockerContent,
      renderSource: "unlocker",
      fallbackAttempted: true,
      fallbackUsed: false,
      fallbackReason: "Browser fallback did not improve readable output",
      outcome: outcomeAssessment.outcome,
      outcomeReason: outcomeAssessment.reason,
      nextActionHint: outcomeAssessment.nextActionHint,
      warning: outcomeAssessment.warning,
      request: unlocker.request,
    };
  }

  return {
    content: browserContent,
    renderSource: "browser",
    fallbackAttempted: true,
    fallbackUsed: true,
    fallbackReason: assessment.reason,
    outcome: "ok",
    request: unlocker.request,
  };
}

function formatReadableContent(format: "html" | "markdown" | "text", html: string, text: string): string {
  if (format === "html") {
    return html;
  }

  return format === "markdown" ? htmlToMarkdown(html) : text.trim();
}

function meaningfulTextLength(value: string): number {
  return value.replace(/\s+/g, " ").trim().length;
}

export function extractReadableSegmentFromHtml(html: string): { html: string; text: string; selector: string } {
  const $ = load(html);
  const candidates: Array<{ selector: string; element: ReturnType<typeof $> }> = [
    { selector: "#content-area", element: $("#content-area").first() },
    { selector: "main article", element: $("main article").first() },
    { selector: "article", element: $("article").first() },
    { selector: "main .prose", element: $("main .prose").first() },
    { selector: "main", element: $("main").first() },
    { selector: "[role='main']", element: $("[role='main']").first() },
    { selector: ".mintlify-content", element: $(".mintlify-content").first() },
    { selector: ".docs-content", element: $(".docs-content").first() },
    { selector: ".content", element: $(".content").first() },
    { selector: ".prose", element: $(".prose").first() },
    { selector: "body", element: $("body").first() },
  ];

  for (const candidate of candidates.filter((item) => item.selector !== "body")) {
    if (candidate.element.length === 0) {
      continue;
    }

    const text = candidate.element.text();
    const normalizedLength = meaningfulTextLength(text);
    const headings = candidate.element.find("h1, h2, h3").length;
    const paragraphs = candidate.element.find("p, li").length;
    if (normalizedLength >= 600 && (headings >= 1 || paragraphs >= 3)) {
      const cleaned = sanitizeReadableFragment($.html(candidate.element));
      return {
        selector: candidate.selector,
        html: cleaned.html,
        text: cleaned.text,
      };
    }
  }

  let best = {
    selector: "body",
    html: $("body").html() ?? html,
    text: $("body").text(),
    score: Number.NEGATIVE_INFINITY,
  };

  for (const candidate of candidates) {
    if (candidate.element.length === 0) {
      continue;
    }

    const text = candidate.element.text();
    const normalizedLength = meaningfulTextLength(text);
    if (normalizedLength === 0) {
      continue;
    }

    const headings = candidate.element.find("h1, h2, h3").length;
    const paragraphs = candidate.element.find("p, li").length;
    const codeBlocks = candidate.element.find("pre, code").length;
    const links = candidate.element.find("a[href]").length;
    let score = Math.min(normalizedLength, 12_000) + headings * 180 + paragraphs * 120 + codeBlocks * 80 - links * 8;
    if (/^(#content-area|article|main|\[role='main'\])/.test(candidate.selector)) {
      score += 400;
    }

    if (score > best.score) {
      const cleaned = sanitizeReadableFragment($.html(candidate.element));
      best = {
        selector: candidate.selector,
        html: cleaned.html,
        text: cleaned.text,
        score,
      };
    }
  }

  return {
    selector: best.selector,
    html: best.html,
    text: best.text.replace(/\s+/g, " ").trim(),
  };
}

function sanitizeReadableFragment(fragmentHtml: string): { html: string; text: string } {
  const $ = load(fragmentHtml);
  $(
    "script, style, nav, aside, form, button, svg, dialog, [role='button'], [aria-label='More actions'], .sr-only",
  ).remove();

  return {
    html: $.root().html() ?? fragmentHtml,
    text: $.root().text().replace(/\s+/g, " ").trim(),
  };
}
