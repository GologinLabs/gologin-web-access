import { promises as fs } from "fs";
import path from "path";
import { Command } from "commander";
import { parseDocumentSource } from "../lib/document";
import { printJson, printText } from "../lib/output";

export function buildParseDocumentCommand(): Command {
  return new Command("parse-document")
    .description("Parse PDF, DOCX, XLSX, HTML, or text-like documents from a URL or local path.")
    .argument("<source>", "Document URL or local file path")
    .option("--json", "Print structured JSON output")
    .option("--output <path>", "Write parsed output to a file")
    .action(async (source: string, options: { json?: boolean; output?: string }) => {
      const parsed = await parseDocumentSource(source);

      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        const payload = options.json ? JSON.stringify(parsed, null, 2) : parsed.text;
        await fs.writeFile(outputPath, `${payload}\n`, "utf8");
        process.stdout.write(`${outputPath}\n`);
        return;
      }

      if (options.json) {
        printJson(parsed);
        return;
      }

      printText(parsed.text);
    });
}
