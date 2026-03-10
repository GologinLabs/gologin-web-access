import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { printText } from "../lib/output";
import { scrapeText } from "../lib/unlocker";

export function buildScrapeTextCommand(): Command {
  return new Command("scrape-text")
    .description("Fetch a page through Web Unlocker and print plain text.")
    .argument("<url>", "URL to scrape")
    .action(async (url: string) => {
      const config = await loadConfig();
      const apiKey = requireWebUnlockerKey(config);
      const result = await scrapeText(url, apiKey);
      printText(result.text);
    });
}
