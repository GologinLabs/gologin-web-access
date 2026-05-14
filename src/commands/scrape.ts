import { Command } from "commander";
import { loadConfig, requireScrapingApiKey } from "../config";
import { addScrapingApiRequestOptions, normalizeScrapingApiRequestOptions } from "./shared";
import { printText } from "../lib/output";
import { scrapeRenderedHtml } from "../lib/scrapingApi";

export function buildScrapeCommand(): Command {
  return addScrapingApiRequestOptions(
    new Command("scrape")
    .description("Fetch rendered HTML through GoLogin Scraping API.")
    .argument("<url>", "URL to scrape")
    .action(async (url: string, options: { retry?: string; backoffMs?: string; timeoutMs?: string }) => {
      const config = await loadConfig();
      const apiKey = requireScrapingApiKey(config);
      const result = await scrapeRenderedHtml(url, apiKey, normalizeScrapingApiRequestOptions(options));
      printText(result.content);
    }),
  );
}
