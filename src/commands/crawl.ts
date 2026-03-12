import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { crawlSite } from "../lib/crawl";
import { printJson } from "../lib/output";
import { ScrapeFormat } from "../lib/types";

export function buildCrawlCommand(): Command {
  return new Command("crawl")
    .description("Crawl a website through Gologin Web Unlocker and return per-page extracted content.")
    .argument("<url>", "Root website URL to crawl")
    .option("--format <format>", "html, markdown, text, or json", "markdown")
    .option("--limit <count>", "Maximum number of pages to visit", "25")
    .option("--max-depth <depth>", "Maximum link depth from the root URL", "2")
    .option("--concurrency <count>", "Number of concurrent requests", "4")
    .option("--include-subdomains", "Include subdomains inside the crawl scope")
    .option("--include <patterns>", "Comma-separated URL patterns to include")
    .option("--exclude <patterns>", "Comma-separated URL patterns to exclude")
    .option("--ignore-query", "Normalize URLs without query parameters")
    .option("--sitemap <mode>", "include, only, or skip", "include")
    .option("--strict", "Exit non-zero when any page fails during crawling")
    .action(
      async (
        url: string,
        options: {
          format: string;
          limit: string;
          maxDepth: string;
          concurrency: string;
          includeSubdomains?: boolean;
          include?: string;
          exclude?: string;
          ignoreQuery?: boolean;
          sitemap: string;
          strict?: boolean;
        },
      ) => {
        const config = await loadConfig();
        const apiKey = requireWebUnlockerKey(config);
        const format = normalizeFormat(options.format);
        const result = await crawlSite(url, apiKey, format, {
          limit: normalizePositiveInt(options.limit, 25),
          maxDepth: normalizeNonNegativeInt(options.maxDepth, 2),
          concurrency: normalizePositiveInt(options.concurrency, 4),
          includeSubdomains: Boolean(options.includeSubdomains),
          includePatterns: splitPatterns(options.include),
          excludePatterns: splitPatterns(options.exclude),
          ignoreQueryParameters: Boolean(options.ignoreQuery),
          sitemapMode: normalizeSitemapMode(options.sitemap),
        });

        printJson(result);

        if (result.status === "failed" || (options.strict && result.failed > 0)) {
          process.exitCode = 1;
        }
      },
    );
}

function splitPatterns(value?: string): string[] {
  return value
    ? value
        .split(",")
        .map((pattern) => pattern.trim())
        .filter(Boolean)
    : [];
}

function normalizeSitemapMode(value: string): "include" | "only" | "skip" {
  if (value === "include" || value === "only" || value === "skip") {
    return value;
  }
  throw new Error(`Unsupported sitemap mode: ${value}`);
}

function normalizeFormat(value: string): ScrapeFormat {
  if (value === "html" || value === "markdown" || value === "text" || value === "json") {
    return value;
  }

  throw new Error(`Unsupported crawl format: ${value}`);
}

function normalizePositiveInt(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeNonNegativeInt(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}
