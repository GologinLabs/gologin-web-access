import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";
import { printText } from "../lib/output";
import { scrapeRenderedHtml } from "../lib/unlocker";

export function buildScrapeCommand(): Command {
  return addUnlockerRequestOptions(
    new Command("scrape")
    .description("Fetch rendered HTML through Gologin Web Unlocker.")
    .argument("<url>", "URL to scrape")
    .action(async (url: string, options: { retry?: string; backoffMs?: string; timeoutMs?: string }) => {
      const config = await loadConfig();
      const apiKey = requireWebUnlockerKey(config);
      const result = await scrapeRenderedHtml(url, apiKey, normalizeUnlockerRequestOptions(options));
      printText(result.content);
    }),
  );
}
