import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { describeNextActionHint } from "../lib/pageOutcome";
import { normalizeReadSourceMode, readMarkdownContent, type ReadContentEnvelope } from "../lib/readSource";
import { addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";
import { printText } from "../lib/output";

export function buildScrapeMarkdownCommand(): Command {
  return addUnlockerRequestOptions(
    new Command("scrape-markdown")
    .description("Fetch a page through Web Unlocker and print Markdown.")
    .argument("<url>", "URL to scrape")
    .option("--source <source>", "Read source: auto, unlocker, or browser", "auto")
    .action(async (url: string, options: { source?: string; retry?: string; backoffMs?: string; timeoutMs?: string }) => {
      const config = await loadConfig();
      const source = normalizeReadSourceMode(options.source, "auto");
      const apiKey = source === "browser" ? "" : requireWebUnlockerKey(config);
      const result = await readMarkdownContent(url, config, apiKey, {
        source,
        request: normalizeUnlockerRequestOptions(options),
      });
      emitReadNotice(result);
      printText(result.content);
    }),
  );
}

function emitReadNotice(result: Pick<ReadContentEnvelope, "fallbackAttempted" | "fallbackUsed" | "fallbackReason" | "outcome" | "warning" | "nextActionHint">): void {
  if (result.fallbackAttempted) {
    if (result.fallbackUsed) {
      process.stderr.write(`JS-rendered page detected, retrying with browser. ${result.fallbackReason ?? ""}\n`);
    } else if (result.fallbackReason) {
      process.stderr.write(`${result.fallbackReason}\n`);
    }
  }

  if (result.outcome !== "ok") {
    process.stderr.write(`Outcome: ${result.outcome}\n`);
  }

  if (result.warning) {
    process.stderr.write(`${result.warning}\n`);
    return;
  }

  const hint = describeNextActionHint(result.nextActionHint);
  if (hint && result.outcome !== "ok") {
    process.stderr.write(`${hint}\n`);
  }
}
