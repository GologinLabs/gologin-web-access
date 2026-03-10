import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { printText } from "../lib/output";
import { scrapeRenderedHtml } from "../lib/unlocker";

export function buildScrapeCommand(): Command {
  return new Command("scrape")
    .description("Fetch rendered HTML through Gologin Web Unlocker.")
    .argument("<url>", "URL to scrape")
    .action(async (url: string) => {
      const config = await loadConfig();
      const apiKey = requireWebUnlockerKey(config);
      const result = await scrapeRenderedHtml(url, apiKey);
      printText(result.content);
    });
}
