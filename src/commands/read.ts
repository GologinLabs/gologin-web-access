import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { readHtmlContent, readMarkdownContent, readTextContent, normalizeReadSourceMode } from "../lib/readSource";
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

          emitReadNotice(result.fallbackAttempted, result.fallbackUsed, result.fallbackReason);
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
