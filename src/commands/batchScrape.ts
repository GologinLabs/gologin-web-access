import { promises as fs } from "fs";
import path from "path";
import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import type { NextActionHint, PageOutcome } from "../lib/pageOutcome";
import { printText } from "../lib/output";
import { readHtmlContent, readMarkdownContent, readTextContent, normalizeReadSourceMode } from "../lib/readSource";
import { normalizeStructuredFallbackMode, scrapeStructuredJson } from "../lib/structuredScrape";
import { ScrapeFormat } from "../lib/types";
import { ScrapeRequestOptions, scrapeMarkdown, scrapeRenderedHtml, scrapeText } from "../lib/unlocker";
import { addProfileOption, addUnlockerRequestOptions, normalizeUnlockerRequestOptions, resolveOutputPath } from "./shared";

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
        .option("--output <path>", "Write the full batch result JSON to a file")
        .option("--summary", "Print one-line summary stats to stderr after the JSON output")
        .option("--strict", "Exit non-zero if any URL in the batch fails")
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
              output?: string;
              strict?: boolean;
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
                  output: output.output,
                  outcome: output.outcome,
                  outcomeReason: output.outcomeReason,
                  nextActionHint: output.nextActionHint,
                  renderSource: output.renderSource,
                  fallbackAttempted: output.fallbackAttempted,
                  fallbackUsed: output.fallbackUsed,
                  fallbackReason: output.fallbackReason,
                  warning: output.warning,
                  request: output.request,
                };
              } catch (error) {
                const request = extractRequestMeta(error);
                return {
                  url,
                  ok: false,
                  format,
                  error: error instanceof Error ? error.message : "Unknown error",
                  code: extractErrorCode(error),
                  status: extractStatusCode(error),
                  outcome: extractOutcome(error),
                  nextActionHint: extractNextActionHint(error),
                  request,
                };
              }
            });

            const payload = `${JSON.stringify(results, null, 2)}\n`;
            if (options.output) {
              const outputPath = resolveOutputPath(options.output);
              await fs.mkdir(path.dirname(outputPath), { recursive: true });
              await fs.writeFile(outputPath, payload, "utf8");
              printText(outputPath);
            } else {
              printText(payload);
              if (shouldWarnAboutLargeBatchOutput(payload)) {
                process.stderr.write(
                  "Batch output is large. If your shell or agent truncates stdout, rerun with --output <path> to keep the full JSON.\n",
                );
              }
            }
            if (options.summary) {
              process.stderr.write(formatBatchSummary(results) + "\n");
            }

            process.exitCode = resolveBatchScrapeExitCode(results, Boolean(options.strict));
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
): Promise<{
  output: unknown;
  outcome?: PageOutcome;
  outcomeReason?: string;
  nextActionHint?: NextActionHint;
  renderSource?: "unlocker" | "browser";
  fallbackAttempted?: boolean;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  warning?: string;
  request?: unknown;
}> {
  if (options.onlyMainContent && format !== "json") {
    const readOptions = {
      source: options.source,
      profile: options.profile,
      request: requestOptions,
    };

    switch (format) {
      case "html":
        return mapReadableBatchResult(await readHtmlContent(url, config, apiKey, readOptions));
      case "markdown":
        return mapReadableBatchResult(await readMarkdownContent(url, config, apiKey, readOptions));
      case "text":
        return mapReadableBatchResult(await readTextContent(url, config, apiKey, readOptions));
      default:
        break;
    }
  }

  switch (format) {
    case "html":
      return {
        output: (await scrapeRenderedHtml(url, apiKey, requestOptions)).content,
      };
    case "markdown":
      return {
        output: (await scrapeMarkdown(url, apiKey, requestOptions)).markdown,
      };
    case "text":
      return {
        output: (await scrapeText(url, apiKey, requestOptions)).text,
      };
    case "json":
      return mapStructuredBatchResult(await scrapeStructuredJson(url, config, apiKey, {
        fallback,
        request: requestOptions,
      }));
    default:
      return {
        output: (await scrapeRenderedHtml(url, apiKey, requestOptions)).content,
      };
  }
}

function mapReadableBatchResult(result: Awaited<ReturnType<typeof readTextContent>>): {
  output: string;
  outcome: PageOutcome;
  outcomeReason?: string;
  nextActionHint?: NextActionHint;
  renderSource: "unlocker" | "browser";
  fallbackAttempted: boolean;
  fallbackUsed: boolean;
  fallbackReason?: string;
  warning?: string;
  request?: unknown;
} {
  return {
    output: result.content,
    outcome: result.outcome,
    outcomeReason: result.outcomeReason,
    nextActionHint: result.nextActionHint,
    renderSource: result.renderSource,
    fallbackAttempted: result.fallbackAttempted,
    fallbackUsed: result.fallbackUsed,
    fallbackReason: result.fallbackReason,
    warning: result.warning,
    request: result.request,
  };
}

function mapStructuredBatchResult(result: Awaited<ReturnType<typeof scrapeStructuredJson>>): {
  output: Awaited<ReturnType<typeof scrapeStructuredJson>>;
  outcome: PageOutcome;
  outcomeReason?: string;
  nextActionHint?: NextActionHint;
  renderSource: "unlocker" | "browser";
  fallbackAttempted: boolean;
  fallbackUsed: boolean;
  fallbackReason?: string;
  warning?: string;
  request?: unknown;
} {
  return {
    output: result,
    outcome: result.outcome,
    outcomeReason: result.outcomeReason,
    nextActionHint: result.nextActionHint,
    renderSource: result.renderSource,
    fallbackAttempted: result.fallbackAttempted,
    fallbackUsed: result.fallbackUsed,
    fallbackReason: result.fallbackReason,
    warning: result.warning,
    request: result.request,
  };
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

export function resolveBatchScrapeExitCode(results: Array<{ ok: boolean }>, strict: boolean): number {
  const okCount = results.filter((result) => result.ok).length;
  if (okCount === 0) {
    return 1;
  }

  if (strict && okCount !== results.length) {
    return 1;
  }

  return 0;
}

export function shouldWarnAboutLargeBatchOutput(payload: string): boolean {
  return payload.length >= 100_000;
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

function extractErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return undefined;
}

function extractOutcome(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "outcome" in error &&
    typeof (error as { outcome?: unknown }).outcome === "string"
  ) {
    return (error as { outcome: string }).outcome;
  }

  return undefined;
}

function extractNextActionHint(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "nextActionHint" in error &&
    typeof (error as { nextActionHint?: unknown }).nextActionHint === "string"
  ) {
    return (error as { nextActionHint: string }).nextActionHint;
  }

  return undefined;
}
