import { promises as fs } from "fs";
import path from "path";
import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import type { ExtractSchema } from "../lib/extract";
import { extractUrlWithSchema } from "../lib/extractRunner";
import { mapWithConcurrency } from "../lib/concurrency";
import { printJson } from "../lib/output";
import { normalizeReadSourceMode } from "../lib/readSource";
import { addProfileOption, addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";

export function buildBatchExtractCommand(): Command {
  return addProfileOption(
    addUnlockerRequestOptions(
      new Command("batch-extract")
        .description("Extract structured data from multiple pages using one selector schema.")
        .argument("<urls...>", "One or more URLs")
        .requiredOption("--schema <path>", "Path to a JSON extraction schema")
        .option("--source <source>", "Read source: auto, unlocker, or browser", "auto")
        .option("--concurrency <count>", "Number of concurrent requests", "4")
        .option("--output <path>", "Write the full batch result JSON to a file")
        .option("--summary", "Print one-line summary stats to stderr after the JSON output")
        .action(
          async (
            urls: string[],
            options: {
              schema: string;
              source?: string;
              concurrency?: string;
              output?: string;
              summary?: boolean;
              profile?: string;
              retry?: string;
              backoffMs?: string;
              timeoutMs?: string;
            },
          ) => {
            const config = await loadConfig();
            const source = normalizeReadSourceMode(options.source, "auto");
            const apiKey = source === "browser" ? "" : requireWebUnlockerKey(config);
            const schema = await readSchema(path.resolve(options.schema));
            const concurrency = Math.max(1, Number(options.concurrency) || 4);
            const request = normalizeUnlockerRequestOptions(options);

            const results = await mapWithConcurrency(urls, concurrency, async (url) => {
              try {
                return {
                  ok: true as const,
                  ...(await extractUrlWithSchema(url, config, apiKey, schema, {
                    source,
                    request,
                    profile: options.profile,
                  })),
                };
              } catch (error) {
                return {
                  url,
                  ok: false as const,
                  error: error instanceof Error ? error.message : "Unknown error",
                  status: extractStatusCode(error),
                  request: extractRequestMeta(error),
                };
              }
            });

            if (options.output) {
              const outputPath = path.resolve(options.output);
              await fs.mkdir(path.dirname(outputPath), { recursive: true });
              await fs.writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
              process.stdout.write(`${outputPath}\n`);
            } else {
              printJson(results);
            }
            if (options.summary) {
              process.stderr.write(formatBatchExtractSummary(results) + "\n");
            }

            if (results.some((result) => !result.ok)) {
              process.exitCode = 1;
            }
          },
        ),
    ),
  );
}

async function readSchema(schemaPath: string): Promise<ExtractSchema> {
  const raw = await fs.readFile(schemaPath, "utf8");
  return JSON.parse(raw) as ExtractSchema;
}

function formatBatchExtractSummary(results: Array<{ ok: boolean }>): string {
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
