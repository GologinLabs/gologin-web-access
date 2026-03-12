import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";
import { printText } from "../lib/output";
import { scrapeText } from "../lib/unlocker";

export function buildScrapeTextCommand(): Command {
  return addUnlockerRequestOptions(
    new Command("scrape-text")
    .description("Fetch a page through Web Unlocker and print plain text.")
    .argument("<url>", "URL to scrape")
    .action(async (url: string, options: { retry?: string; backoffMs?: string; timeoutMs?: string }) => {
      const config = await loadConfig();
      const apiKey = requireWebUnlockerKey(config);
      const result = await scrapeText(url, apiKey, normalizeUnlockerRequestOptions(options));
      printText(result.text);
    }),
  );
}
