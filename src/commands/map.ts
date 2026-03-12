import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { printJson } from "../lib/output";
import { mapSite } from "../lib/crawl";

export function buildMapCommand(): Command {
  return new Command("map")
    .description("Discover internal website links through Gologin Web Unlocker.")
    .argument("<url>", "Root website URL to map")
    .option("--limit <count>", "Maximum number of pages to visit", "100")
    .option("--max-depth <depth>", "Maximum link depth from the root URL", "2")
    .option("--concurrency <count>", "Number of concurrent requests", "4")
    .option("--include-subdomains", "Include subdomains inside the crawl scope")
    .option("--include <patterns>", "Comma-separated URL patterns to include")
    .option("--exclude <patterns>", "Comma-separated URL patterns to exclude")
    .option("--ignore-query", "Normalize URLs without query parameters")
    .option("--sitemap <mode>", "include, only, or skip", "include")
    .option("--strict", "Exit non-zero when any page fails during mapping")
    .action(
      async (
        url: string,
        options: {
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
        const result = await mapSite(url, apiKey, {
          limit: normalizePositiveInt(options.limit, 100),
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

function normalizePositiveInt(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeNonNegativeInt(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}
