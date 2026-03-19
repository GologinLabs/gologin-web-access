import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { printJson } from "../lib/output";
import { normalizeStructuredFallbackMode, scrapeStructuredJson } from "../lib/structuredScrape";
import { addProfileOption, addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";

export function buildScrapeJsonCommand(): Command {
  return addProfileOption(
    addUnlockerRequestOptions(
      new Command("scrape-json")
    .description("Fetch a page through Web Unlocker and print a structured JSON envelope.")
    .argument("<url>", "URL to scrape")
    .option("--fallback <mode>", "none or browser structured fallback for JS-heavy pages", "none")
    .action(
      async (
        url: string,
        options: {
          retry?: string;
          backoffMs?: string;
          timeoutMs?: string;
          fallback?: string;
          profile?: string;
        },
      ) => {
      const config = await loadConfig();
      const apiKey = requireWebUnlockerKey(config);
      const envelope = await scrapeStructuredJson(url, config, apiKey, {
        fallback: normalizeStructuredFallbackMode(options.fallback),
        profile: options.profile,
        request: normalizeUnlockerRequestOptions(options),
      });
      if (envelope.fallbackAttempted) {
        const fallbackStatus = envelope.fallbackUsed
          ? "Browser fallback succeeded and replaced the unlocker result."
          : `Browser fallback was attempted but not used. ${envelope.fallbackReason ?? "It did not improve the structured output."}`;
        process.stderr.write(`${fallbackStatus}\n`);
      }
      if (envelope.warning) {
        process.stderr.write(`${envelope.warning}\n`);
      }
      printJson(envelope);
    }),
    ),
  );
}
