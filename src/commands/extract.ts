import { promises as fs } from "fs";
import path from "path";
import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { extractWithSchema, ExtractSchema } from "../lib/extract";
import { printJson } from "../lib/output";
import { normalizeReadSourceMode, readRenderedHtmlContent } from "../lib/readSource";
import { addUnlockerRequestOptions, normalizeUnlockerRequestOptions } from "./shared";

export function buildExtractCommand(): Command {
  return addUnlockerRequestOptions(new Command("extract")
    .description("Extract structured data from a page using a selector schema.")
    .argument("<url>", "Target URL")
    .requiredOption("--schema <path>", "Path to a JSON extraction schema")
    .option("--output <path>", "Write extracted JSON to a file")
    .option("--source <source>", "Read source: auto, unlocker, or browser", "auto")
    .action(async (url: string, options: { schema: string; output?: string; source?: string; retry?: string; backoffMs?: string; timeoutMs?: string }) => {
      const config = await loadConfig();
      const source = normalizeReadSourceMode(options.source, "auto");
      const apiKey = source === "browser" ? "" : requireWebUnlockerKey(config);
      const schema = await readSchema(path.resolve(options.schema));
      const rendered = await readRenderedHtmlContent(url, config, apiKey, {
        source,
        request: normalizeUnlockerRequestOptions(options),
      });
      const extracted = extractWithSchema(rendered.html, schema);

      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, `${JSON.stringify(extracted, null, 2)}\n`, "utf8");
        process.stdout.write(`${outputPath}\n`);
        return;
      }

      printJson({
        url,
        renderSource: rendered.renderSource,
        fallbackAttempted: rendered.fallbackAttempted,
        fallbackUsed: rendered.fallbackUsed,
        fallbackReason: rendered.fallbackReason,
        request: rendered.request,
        extracted,
      });
    }));
}

async function readSchema(schemaPath: string): Promise<ExtractSchema> {
  const raw = await fs.readFile(schemaPath, "utf8");
  return JSON.parse(raw) as ExtractSchema;
}
