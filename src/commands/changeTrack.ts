import { promises as fs } from "fs";
import path from "path";
import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { buildTrackingKey, compareAndPersistSnapshot } from "../lib/changeTracking";
import { printJson, printText } from "../lib/output";
import { ScrapeFormat } from "../lib/types";
import { scrapeJson, scrapeMarkdown, scrapeRenderedHtml, scrapeText } from "../lib/unlocker";

export function buildChangeTrackCommand(): Command {
  return new Command("change-track")
    .description("Track a page over time and report whether it changed since the last snapshot.")
    .argument("<url>", "Target URL")
    .option("--format <format>", "html, markdown, text, or json", "markdown")
    .option("--key <key>", "Custom tracking key instead of deriving one from the URL")
    .option("--json", "Print JSON output")
    .option("--output <path>", "Write the current tracking result to a file")
    .action(
      async (
        url: string,
        options: { format: string; key?: string; json?: boolean; output?: string }
      ) => {
        const config = await loadConfig();
        const apiKey = requireWebUnlockerKey(config);
        const format = normalizeFormat(options.format);
        const key = buildTrackingKey(url, options.key);
        const snapshot = await scrapeForTracking(url, apiKey, format);
        const result = await compareAndPersistSnapshot(config, {
          key,
          url,
          format,
          title: snapshot.title,
          content: snapshot.content
        });

        if (options.output) {
          const outputPath = path.resolve(options.output);
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
          process.stdout.write(`${outputPath}\n`);
          return;
        }

        if (options.json) {
          printJson(result);
          return;
        }

        const lines = [
          `key=${result.key}`,
          `url=${result.url}`,
          `format=${result.format}`,
          `status=${result.status}`,
          `currentHash=${result.currentHash}`
        ];
        if (result.previousHash) {
          lines.push(`previousHash=${result.previousHash}`);
        }
        if (result.diff) {
          lines.push("");
          lines.push(result.diff);
        }
        printText(lines.join("\n"));
      },
    );
}

async function scrapeForTracking(
  url: string,
  apiKey: string,
  format: ScrapeFormat
): Promise<{ title?: string; content: string }> {
  switch (format) {
    case "html": {
      const result = await scrapeRenderedHtml(url, apiKey);
      return {
        content: result.content
      };
    }
    case "text": {
      const result = await scrapeText(url, apiKey);
      return {
        content: result.text
      };
    }
    case "json": {
      const result = await scrapeJson(url, apiKey);
      return {
        title: result.data.title ?? undefined,
        content: JSON.stringify(result.data, null, 2)
      };
    }
    case "markdown":
    default: {
      const result = await scrapeMarkdown(url, apiKey);
      return {
        content: result.markdown
      };
    }
  }
}

function normalizeFormat(value: string): ScrapeFormat {
  if (value === "html" || value === "markdown" || value === "text" || value === "json") {
    return value;
  }

  throw new Error(`Unsupported change-track format: ${value}`);
}
