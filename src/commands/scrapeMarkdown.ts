import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";
import { printText } from "../lib/output";
import { scrapeMarkdown } from "../lib/unlocker";

export function buildScrapeMarkdownCommand(): Command {
  return addUnlockerRequestOptions(
    new Command("scrape-markdown")
    .description("Fetch a page through Web Unlocker and print Markdown.")
    .argument("<url>", "URL to scrape")
    .action(async (url: string, options: { retry?: string; backoffMs?: string; timeoutMs?: string }) => {
      const config = await loadConfig();
      const apiKey = requireWebUnlockerKey(config);
      const result = await scrapeMarkdown(url, apiKey, normalizeUnlockerRequestOptions(options));
      printText(result.markdown);
    }),
  );
}
