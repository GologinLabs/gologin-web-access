import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { printJson } from "../lib/output";
import { readHtmlContent, readMarkdownContent, readTextContent, normalizeReadSourceMode } from "../lib/readSource";
import { normalizeStructuredFallbackMode, scrapeStructuredJson } from "../lib/structuredScrape";
import { ScrapeFormat } from "../lib/types";
import { ScrapeRequestOptions, scrapeMarkdown, scrapeRenderedHtml, scrapeText } from "../lib/unlocker";
import { addProfileOption, addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";

export function buildBatchScrapeCommand(): Command {
  return addProfileOption(
    addUnlockerRequestOptions(
      new Command("batch-scrape")
        .description("Fetch multiple pages through Web Unlocker and print a JSON array of results.")
        .argument("<urls...>", "One or more URLs")
        .option("--format <format>", "html, markdown, text, or json", "html")
        .option("--concurrency <count>", "Number of concurrent requests", "4")
        .option("--fallback <mode>", "Structured scrape fallback: none or browser", "none")
        .option("--source <source>", "Read source for --only-main-content mode: auto, unlocker, or browser", "auto")
        .option("--only-main-content", "For html, markdown, or text formats, isolate the most readable content block per page")
        .option("--summary", "Print one-line summary stats to stderr after the JSON output")
        .action(
          async (
            urls: string[],
            options: {
              format: ScrapeFormat;
              concurrency: string;
              fallback?: string;
              source?: string;
              onlyMainContent?: boolean;
              profile?: string;
              retry?: string;
              backoffMs?: string;
              timeoutMs?: string;
              summary?: boolean;
            },
          ) => {
            const config = await loadConfig();
            const format = normalizeFormat(options.format);
            const source = normalizeReadSourceMode(options.source, "auto");
            const usingBrowserOnlyMainContent = Boolean(options.onlyMainContent) && format !== "json" && source === "browser";
            const apiKey = usingBrowserOnlyMainContent ? "" : requireWebUnlockerKey(config);
            const concurrency = Math.max(1, Number(options.concurrency) || 4);
            const requestOptions = normalizeUnlockerRequestOptions(options);
            const fallback = normalizeStructuredFallbackMode(options.fallback);
            const results = await mapWithConcurrency(urls, concurrency, async (url) => {
              try {
                const output = await formatOutput(url, config, apiKey, format, requestOptions, fallback, {
                  source,
                  onlyMainContent: Boolean(options.onlyMainContent),
                  profile: options.profile,
                });
                return {
                  url,
                  ok: true,
                  format,
                  output,
                };
              } catch (error) {
                const request = extractRequestMeta(error);
                return {
                  url,
                  ok: false,
                  format,
                  error: error instanceof Error ? error.message : "Unknown error",
                  status: extractStatusCode(error),
                  request,
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
    ),
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
  config: Awaited<ReturnType<typeof loadConfig>>,
  apiKey: string,
  format: ScrapeFormat,
  requestOptions: ScrapeRequestOptions,
  fallback: "none" | "browser",
  options: {
    source: "auto" | "unlocker" | "browser";
    onlyMainContent: boolean;
    profile?: string;
  },
): Promise<unknown> {
  if (options.onlyMainContent && format !== "json") {
    const readOptions = {
      source: options.source,
      profile: options.profile,
      request: requestOptions,
    };

    switch (format) {
      case "html":
        return (await readHtmlContent(url, config, apiKey, readOptions)).content;
      case "markdown":
        return (await readMarkdownContent(url, config, apiKey, readOptions)).content;
      case "text":
        return (await readTextContent(url, config, apiKey, readOptions)).content;
      default:
        break;
    }
  }

  switch (format) {
    case "html":
      return (await scrapeRenderedHtml(url, apiKey, requestOptions)).content;
    case "markdown":
      return (await scrapeMarkdown(url, apiKey, requestOptions)).markdown;
    case "text":
      return (await scrapeText(url, apiKey, requestOptions)).text;
    case "json":
      return await scrapeStructuredJson(url, config, apiKey, {
        fallback,
        request: requestOptions,
      });
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

function extractStatusCode(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }

  return undefined;
}

function extractRequestMeta(error: unknown): unknown {
  if (
    typeof error === "object" &&
    error !== null &&
    "request" in error &&
    typeof (error as { request?: unknown }).request === "object"
  ) {
    return (error as { request: unknown }).request;
  }

  return undefined;
}
