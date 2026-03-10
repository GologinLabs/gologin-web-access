import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { printJson } from "../lib/output";
import { scrapeJson } from "../lib/unlocker";

export function buildScrapeJsonCommand(): Command {
  return new Command("scrape-json")
    .description("Fetch a page through Web Unlocker and print a structured JSON envelope.")
    .argument("<url>", "URL to scrape")
    .action(async (url: string) => {
      const config = await loadConfig();
      const apiKey = requireWebUnlockerKey(config);
      const result = await scrapeJson(url, apiKey);
      printJson({
        url,
        status: result.status,
        data: result.data,
      });
    });
}
