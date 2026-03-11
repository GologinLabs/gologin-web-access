import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { printJson } from "../lib/output";
import { searchGoogle } from "../lib/search";

export function buildSearchCommand(): Command {
  return new Command("search")
    .description("Search Google through Gologin Web Unlocker and return structured results.")
    .argument("<query>", "Search query")
    .option("--limit <count>", "Maximum number of results", "10")
    .option("--country <country>", "Country code for Google search", "us")
    .option("--language <language>", "Language for Google search", "en")
    .action(
      async (
        query: string,
        options: {
          limit: string;
          country: string;
          language: string;
        },
      ) => {
        const config = await loadConfig();
        const apiKey = requireWebUnlockerKey(config);
        const result = await searchGoogle(query, apiKey, {
          limit: normalizeLimit(options.limit),
          country: options.country,
          language: options.language,
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
