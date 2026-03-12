import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { printJson } from "../lib/output";
import { ScrapeFormat } from "../lib/types";
import { ScrapeRequestOptions, scrapeJson, scrapeMarkdown, scrapeRenderedHtml, scrapeText } from "../lib/unlocker";
import { addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";

export function buildBatchScrapeCommand(): Command {
  return addUnlockerRequestOptions(
    new Command("batch-scrape")
    .description("Fetch multiple pages through Web Unlocker and print a JSON array of results.")
    .argument("<urls...>", "One or more URLs")
    .option("--format <format>", "html, markdown, text, or json", "html")
    .option("--concurrency <count>", "Number of concurrent requests", "4")
    .option("--summary", "Print one-line summary stats to stderr after the JSON output")
    .action(
      async (
        urls: string[],
        options: {
          format: ScrapeFormat;
          concurrency: string;
          retry?: string;
          backoffMs?: string;
          timeoutMs?: string;
          summary?: boolean;
        },
      ) => {
      const config = await loadConfig();
      const apiKey = requireWebUnlockerKey(config);
      const format = normalizeFormat(options.format);
      const concurrency = Math.max(1, Number(options.concurrency) || 4);
      const requestOptions = normalizeUnlockerRequestOptions(options);
      const results = await mapWithConcurrency(urls, concurrency, async (url) => {
        try {
          const output = await formatOutput(url, apiKey, format, requestOptions);
          return {
            url,
            ok: true,
            format,
            output,
          };
        } catch (error) {
          return {
            url,
            ok: false,
            format,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      printJson(results);
      if (options.summary) {
        process.stderr.write(formatBatchSummary(results) + "\n");
      }

      if (results.some((result) => !result.ok)) {
        process.exitCode = 1;
      }
    }),
  );
}

function normalizeFormat(value: string): ScrapeFormat {
  if (value === "html" || value === "markdown" || value === "text" || value === "json") {
    return value;
  }

  throw new Error(`Unsupported batch scrape format: ${value}`);
}

async function formatOutput(
  url: string,
  apiKey: string,
  format: ScrapeFormat,
  requestOptions: ScrapeRequestOptions,
): Promise<unknown> {
  switch (format) {
    case "html":
      return (await scrapeRenderedHtml(url, apiKey, requestOptions)).content;
    case "markdown":
      return (await scrapeMarkdown(url, apiKey, requestOptions)).markdown;
    case "text":
      return (await scrapeText(url, apiKey, requestOptions)).text;
    case "json":
      return (await scrapeJson(url, apiKey, requestOptions)).data;
    default:
      return (await scrapeRenderedHtml(url, apiKey, requestOptions)).content;
  }
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results: TOutput[] = new Array(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

function formatBatchSummary(results: Array<{ ok: boolean }>): string {
  const requested = results.length;
  const ok = results.filter((result) => result.ok).length;
  const failed = requested - ok;
  return `Summary: ${requested} requested, ${ok} ok, ${failed} failed.`;
}
