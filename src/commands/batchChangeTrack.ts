import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { buildTrackingKey, compareAndPersistSnapshot, normalizeTrackingFormat, scrapeForTracking } from "../lib/changeTracking";
import { mapWithConcurrency } from "../lib/concurrency";
import { printJson } from "../lib/output";
import { addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";

type BatchChangeTrackResult =
  | {
      url: string;
      ok: true;
      key: string;
      format: "html" | "markdown" | "text" | "json";
      status: "new" | "same" | "changed";
      previousHash?: string;
      currentHash: string;
      updatedAt: string;
      diff?: string;
      request?: unknown;
    }
  | {
      url: string;
      ok: false;
      error: string;
      status?: number;
      request?: unknown;
    };

export function buildBatchChangeTrackCommand(): Command {
  return addUnlockerRequestOptions(
    new Command("batch-change-track")
      .description("Track multiple pages over time and report which ones are new, same, or changed.")
      .argument("<urls...>", "One or more URLs")
      .option("--format <format>", "html, markdown, text, or json", "markdown")
      .option("--concurrency <count>", "Number of concurrent requests", "4")
      .option("--summary", "Print one-line status counts to stderr after the JSON output")
      .action(
        async (
          urls: string[],
          options: {
            format: string;
            concurrency?: string;
            summary?: boolean;
            retry?: string;
            backoffMs?: string;
            timeoutMs?: string;
          },
        ) => {
          const config = await loadConfig();
          const apiKey = requireWebUnlockerKey(config);
          const format = normalizeTrackingFormat(options.format);
          const concurrency = Math.max(1, Number(options.concurrency) || 4);
          const requestOptions = normalizeUnlockerRequestOptions(options);

          const results = await mapWithConcurrency(urls, concurrency, async (url): Promise<BatchChangeTrackResult> => {
            try {
              const key = buildTrackingKey(url);
              const snapshot = await scrapeForTracking(url, apiKey, format, requestOptions);
              const result = await compareAndPersistSnapshot(config, {
                key,
                url,
                format,
                title: snapshot.title,
                content: snapshot.content,
              });

              return {
                ok: true,
                ...result,
                request: snapshot.request,
              };
            } catch (error) {
              return {
                url,
                ok: false,
                error: error instanceof Error ? error.message : "Unknown error",
                status: extractStatusCode(error),
                request: extractRequestMeta(error),
              };
            }
          });

          printJson(results);
          if (options.summary) {
            process.stderr.write(formatBatchChangeTrackSummary(results) + "\n");
          }

          if (results.some((result) => !result.ok)) {
            process.exitCode = 1;
          }
        },
      ),
  );
}

function formatBatchChangeTrackSummary(results: BatchChangeTrackResult[]): string {
  const requested = results.length;
  const failed = results.filter((result) => !result.ok).length;
  const successful = results.filter((result): result is Extract<BatchChangeTrackResult, { ok: true }> => result.ok);
  const created = successful.filter((result) => result.status === "new").length;
  const same = successful.filter((result) => result.status === "same").length;
  const changed = successful.filter((result) => result.status === "changed").length;
  return `Summary: ${requested} requested, ${created} new, ${same} same, ${changed} changed, ${failed} failed.`;
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
