import { Command } from "commander";
import { loadConfig } from "../config";
import { printJson } from "../lib/output";
import { searchWeb } from "../lib/search";

export function buildSearchCommand(): Command {
  return new Command("search")
    .description("Search the web through Gologin and return structured results with automatic fallback.")
    .argument("<query>", "Search query")
    .option("--limit <count>", "Maximum number of results", "10")
    .option("--country <country>", "Country code for Google search", "us")
    .option("--language <language>", "Language for Google search", "en")
    .option("--source <mode>", "Search path: auto, unlocker, or browser", "auto")
    .action(
      async (
        query: string,
        options: {
          limit: string;
          country: string;
          language: string;
          source: string;
        },
      ) => {
        const config = await loadConfig();
        const result = await searchWeb(query, config, {
          limit: normalizeLimit(options.limit),
          country: options.country,
          language: options.language,
          source: normalizeSource(options.source),
        });
        printJson(result);
      },
    );
}

function normalizeLimit(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }
  return Math.min(Math.floor(parsed), 100);
}

function normalizeSource(value: string): "auto" | "unlocker" | "browser" {
  if (value === "auto" || value === "unlocker" || value === "browser") {
    return value;
  }

  throw new Error(`Unsupported search source: ${value}`);
}
