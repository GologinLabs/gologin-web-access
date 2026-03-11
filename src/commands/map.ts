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
    .action(
      async (
        url: string,
        options: {
          limit: string;
          maxDepth: string;
          concurrency: string;
          includeSubdomains?: boolean;
        },
      ) => {
        const config = await loadConfig();
        const apiKey = requireWebUnlockerKey(config);
        const result = await mapSite(url, apiKey, {
          limit: normalizePositiveInt(options.limit, 100),
          maxDepth: normalizeNonNegativeInt(options.maxDepth, 2),
          concurrency: normalizePositiveInt(options.concurrency, 4),
          includeSubdomains: Boolean(options.includeSubdomains),
        });

        printJson(result);

        if (result.failed > 0) {
          process.exitCode = 1;
        }
      },
    );
}

function normalizePositiveInt(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeNonNegativeInt(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}
