import { promises as fs } from "fs";
import path from "path";
import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { buildTrackingKey, compareAndPersistSnapshot, normalizeTrackingFormat, scrapeForTracking } from "../lib/changeTracking";
import { printJson, printText } from "../lib/output";
import { addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";

export function buildChangeTrackCommand(): Command {
  return addUnlockerRequestOptions(new Command("change-track")
    .description("Track a page over time and report whether it changed since the last snapshot.")
    .argument("<url>", "Target URL")
    .option("--format <format>", "html, markdown, text, or json", "markdown")
    .option("--key <key>", "Custom tracking key instead of deriving one from the URL")
    .option("--json", "Print JSON output")
    .option("--output <path>", "Write the current tracking result to a file")
    .action(
      async (
        url: string,
        options: { format: string; key?: string; json?: boolean; output?: string; retry?: string; backoffMs?: string; timeoutMs?: string }
      ) => {
        const config = await loadConfig();
        const apiKey = requireWebUnlockerKey(config);
        const format = normalizeTrackingFormat(options.format);
        const key = buildTrackingKey(url, options.key);
        const snapshot = await scrapeForTracking(url, apiKey, format, normalizeUnlockerRequestOptions(options));
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
          printJson({
            ...result,
            request: snapshot.request,
          });
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
    ));
}
