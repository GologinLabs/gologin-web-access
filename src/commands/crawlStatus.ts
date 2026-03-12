import { Command } from "commander";
import { loadConfig } from "../config";
import { getJob } from "../lib/jobRegistry";
import { printJson, printText } from "../lib/output";

export function buildCrawlStatusCommand(): Command {
  return new Command("crawl-status")
    .description("Show the status of a detached crawl job.")
    .argument("<jobId>", "Crawl job identifier")
    .option("--json", "Print JSON output")
    .action(async (jobId: string, options: { json?: boolean }) => {
      const config = await loadConfig();
      const job = await getJob(config, jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (options.json) {
        printJson(job);
        return;
      }

      printText(`job=${job.jobId}\nkind=${job.kind}\nstatus=${job.status}\nname=${job.name}`);
    });
}
