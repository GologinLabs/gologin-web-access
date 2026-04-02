import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { describeNextActionHint } from "../lib/pageOutcome";
import { readHtmlContent, readMarkdownContent, readTextContent, normalizeReadSourceMode, type ReadContentEnvelope } from "../lib/readSource";
import { printText } from "../lib/output";
import { addProfileOption, addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";

type ReadFormat = "html" | "markdown" | "text";

export function buildReadCommand(): Command {
  return addProfileOption(
    addUnlockerRequestOptions(
      new Command("read")
        .description("Read the main content of a docs page or article with automatic fallback to Cloud Browser when needed.")
        .argument("<url>", "URL to read")
        .option("--format <format>", "Output format: html, markdown, or text", "text")
        .option("--source <source>", "Read source: auto, unlocker, or browser", "auto")
        .action(async (url: string, options: {
          format?: string;
          source?: string;
          profile?: string;
          retry?: string;
          backoffMs?: string;
          timeoutMs?: string;
        }) => {
          const config = await loadConfig();
          const format = normalizeReadFormat(options.format);
          const source = normalizeReadSourceMode(options.source, "auto");
          const apiKey = source === "browser" ? "" : requireWebUnlockerKey(config);
          const readOptions = {
            source,
            profile: options.profile,
            request: normalizeUnlockerRequestOptions(options),
          };

          const result = format === "html"
            ? await readHtmlContent(url, config, apiKey, readOptions)
            : format === "markdown"
              ? await readMarkdownContent(url, config, apiKey, readOptions)
              : await readTextContent(url, config, apiKey, readOptions);

          emitReadNotice(result);
          printText(result.content);
        }),
    ),
  );
}

function normalizeReadFormat(value: string | undefined): ReadFormat {
  if (!value || value === "text" || value === "markdown" || value === "html") {
    return (value ?? "text") as ReadFormat;
  }

  throw new Error(`Unsupported read format: ${value}`);
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
