import { Command } from "commander";
import { loadConfig, requireCloudToken, requireWebUnlockerKey } from "../config";
import { scrapeJsonViaBrowser } from "../lib/browserStructured";
import { printJson } from "../lib/output";
import { ScrapeJsonData, scrapeJson } from "../lib/unlocker";
import { addProfileOption, addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";

export function buildScrapeJsonCommand(): Command {
  return addProfileOption(
    addUnlockerRequestOptions(
      new Command("scrape-json")
    .description("Fetch a page through Web Unlocker and print a structured JSON envelope.")
    .argument("<url>", "URL to scrape")
    .option("--fallback <mode>", "none or browser structured fallback for JS-heavy pages", "none")
    .action(
      async (
        url: string,
        options: {
          retry?: string;
          backoffMs?: string;
          timeoutMs?: string;
          fallback?: string;
          profile?: string;
        },
      ) => {
      const config = await loadConfig();
      const apiKey = requireWebUnlockerKey(config);
      const result = await scrapeJson(url, apiKey, normalizeUnlockerRequestOptions(options));
      const fallbackMode = normalizeFallbackMode(options.fallback);
      let data = result.data;
      let renderSource: "unlocker" | "browser" = "unlocker";
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

      printJson({
        url,
        status: result.status,
        renderSource,
        fallbackAttempted,
        fallbackUsed,
        fallbackReason,
        data,
      });
    }),
    ),
  );
}

function normalizeFallbackMode(value: string | undefined): "none" | "browser" {
  if (!value || value === "none") {
    return "none";
  }

  if (value === "browser") {
    return "browser";
  }

  throw new Error(`Unsupported scrape-json fallback mode: ${value}`);
}

function shouldUseBrowserFallback(data: ScrapeJsonData): boolean {
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
