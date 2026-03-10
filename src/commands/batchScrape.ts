import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { printJson } from "../lib/output";
import { ScrapeFormat } from "../lib/types";
import { scrapeJson, scrapeMarkdown, scrapeRenderedHtml, scrapeText } from "../lib/unlocker";

export function buildBatchScrapeCommand(): Command {
  return new Command("batch-scrape")
    .description("Fetch multiple pages through Web Unlocker and print a JSON array of results.")
    .argument("<urls...>", "One or more URLs")
    .option("--format <format>", "html, markdown, text, or json", "html")
    .option("--concurrency <count>", "Number of concurrent requests", "4")
    .action(async (urls: string[], options: { format: ScrapeFormat; concurrency: string }) => {
      const config = await loadConfig();
      const apiKey = requireWebUnlockerKey(config);
      const format = normalizeFormat(options.format);
      const concurrency = Math.max(1, Number(options.concurrency) || 4);
      const results = await mapWithConcurrency(urls, concurrency, async (url) => {
        try {
          const output = await formatOutput(url, apiKey, format);
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

      if (results.some((result) => !result.ok)) {
        process.exitCode = 1;
      }
    });
}

function normalizeFormat(value: string): ScrapeFormat {
  if (value === "html" || value === "markdown" || value === "text" || value === "json") {
    return value;
  }

  throw new Error(`Unsupported batch scrape format: ${value}`);
}

async function formatOutput(url: string, apiKey: string, format: ScrapeFormat): Promise<unknown> {
  switch (format) {
    case "html":
      return (await scrapeRenderedHtml(url, apiKey)).content;
    case "markdown":
      return (await scrapeMarkdown(url, apiKey)).markdown;
    case "text":
      return (await scrapeText(url, apiKey)).text;
    case "json":
      return (await scrapeJson(url, apiKey)).data;
    default:
      return (await scrapeRenderedHtml(url, apiKey)).content;
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
