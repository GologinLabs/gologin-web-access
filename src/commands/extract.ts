import { promises as fs } from "fs";
import path from "path";
import { Command } from "commander";
import { loadConfig, requireScrapingApiKey } from "../config";
import { ExtractSchema } from "../lib/extract";
import { extractUrlWithSchema } from "../lib/extractRunner";
import { printJson } from "../lib/output";
import { normalizeReadSourceMode } from "../lib/readSource";
import { addScrapingApiRequestOptions, normalizeScrapingApiRequestOptions } from "./shared";

export function buildExtractCommand(): Command {
  return addScrapingApiRequestOptions(new Command("extract")
    .description("Extract structured data from a page using a selector schema.")
    .argument("<url>", "Target URL")
    .requiredOption("--schema <path>", "Path to a JSON extraction schema")
    .option("--output <path>", "Write extracted JSON to a file")
    .option("--source <source>", "Read source: auto, scraping, or browser. Legacy alias: unlocker", "auto")
    .action(async (url: string, options: { schema: string; output?: string; source?: string; retry?: string; backoffMs?: string; timeoutMs?: string }) => {
      const config = await loadConfig();
      const source = normalizeReadSourceMode(options.source, "auto");
      const apiKey = source === "browser" ? "" : requireScrapingApiKey(config);
      const schema = await readSchema(path.resolve(options.schema));
      const result = await extractUrlWithSchema(url, config, apiKey, schema, {
        source,
        request: normalizeScrapingApiRequestOptions(options),
      });

      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, `${JSON.stringify(result.extracted, null, 2)}\n`, "utf8");
        process.stdout.write(`${outputPath}\n`);
        return;
      }

      printJson(result);
    }));
}

async function readSchema(schemaPath: string): Promise<ExtractSchema> {
  const raw = await fs.readFile(schemaPath, "utf8");
  return JSON.parse(raw) as ExtractSchema;
}
