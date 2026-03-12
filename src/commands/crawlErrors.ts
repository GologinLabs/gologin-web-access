import { Command } from "commander";
import { loadConfig } from "../config";
import { getJob, readJobErrors } from "../lib/jobRegistry";
import { printText } from "../lib/output";

export function buildCrawlErrorsCommand(): Command {
  return new Command("crawl-errors")
    .description("Print stderr captured for a detached crawl job.")
    .argument("<jobId>", "Crawl job identifier")
    .action(async (jobId: string) => {
      const config = await loadConfig();
      const job = await getJob(config, jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      printText(await readJobErrors(job));
    });
}
