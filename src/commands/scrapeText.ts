import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { normalizeReadSourceMode, readTextContent } from "../lib/readSource";
import { addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";
import { printText } from "../lib/output";

export function buildScrapeTextCommand(): Command {
  return addUnlockerRequestOptions(
    new Command("scrape-text")
    .description("Fetch a page through Web Unlocker and print plain text.")
    .argument("<url>", "URL to scrape")
    .option("--source <source>", "Read source: auto, unlocker, or browser", "auto")
    .action(async (url: string, options: { source?: string; retry?: string; backoffMs?: string; timeoutMs?: string }) => {
      const config = await loadConfig();
      const source = normalizeReadSourceMode(options.source, "auto");
      const apiKey = source === "browser" ? "" : requireWebUnlockerKey(config);
      const result = await readTextContent(url, config, apiKey, {
        source,
        request: normalizeUnlockerRequestOptions(options),
      });
      emitReadNotice(result.fallbackAttempted, result.fallbackUsed, result.fallbackReason);
      printText(result.content);
    }),
  );
}

function emitReadNotice(fallbackAttempted: boolean, fallbackUsed: boolean, fallbackReason?: string): void {
  if (!fallbackAttempted) {
    return;
  }

  if (fallbackUsed) {
    process.stderr.write(`JS-rendered page detected, retrying with browser. ${fallbackReason ?? ""}\n`);
    return;
  }

  if (fallbackReason) {
    process.stderr.write(`${fallbackReason}\n`);
  }
}
