import { promises as fs } from "fs";
import path from "path";
import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { extractWithSchema, ExtractSchema } from "../lib/extract";
import { printJson } from "../lib/output";
import { scrapeRenderedHtml } from "../lib/unlocker";

export function buildExtractCommand(): Command {
  return new Command("extract")
    .description("Extract structured data from a page using a selector schema.")
    .argument("<url>", "Target URL")
    .requiredOption("--schema <path>", "Path to a JSON extraction schema")
    .option("--output <path>", "Write extracted JSON to a file")
    .action(async (url: string, options: { schema: string; output?: string }) => {
      const config = await loadConfig();
      const apiKey = requireWebUnlockerKey(config);
      const schema = await readSchema(path.resolve(options.schema));
      const scraped = await scrapeRenderedHtml(url, apiKey);
      const extracted = extractWithSchema(scraped.content, schema);

      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, `${JSON.stringify(extracted, null, 2)}\n`, "utf8");
        process.stdout.write(`${outputPath}\n`);
        return;
      }

      printJson({
        url: scraped.url,
        extracted
      });
    });
}

async function readSchema(schemaPath: string): Promise<ExtractSchema> {
  const raw = await fs.readFile(schemaPath, "utf8");
  return JSON.parse(raw) as ExtractSchema;
}
