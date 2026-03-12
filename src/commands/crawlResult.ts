import { Command } from "commander";
import { loadConfig } from "../config";
import { getJob, readJobOutput, readJobResult } from "../lib/jobRegistry";
import { printJson, printText } from "../lib/output";

export function buildCrawlResultCommand(): Command {
  return new Command("crawl-result")
    .description("Print the stored result of a detached crawl job.")
    .argument("<jobId>", "Crawl job identifier")
    .option("--json", "Print structured JSON result when available")
    .action(async (jobId: string, options: { json?: boolean }) => {
      const config = await loadConfig();
      const job = await getJob(config, jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const result = await readJobResult(config, job);
      if (options.json && result !== undefined) {
        printJson(result);
        return;
      }

      const output = await readJobOutput(job);
      printText(output || (result !== undefined ? JSON.stringify(result, null, 2) : ""));
    });
}
