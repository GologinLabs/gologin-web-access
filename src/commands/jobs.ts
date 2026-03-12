import { Command } from "commander";
import { loadConfig } from "../config";
import { getJob, listJobs, readJobResult } from "../lib/jobRegistry";
import { printJson, printText } from "../lib/output";

export function buildJobsCommand(): Command {
  return new Command("jobs")
    .description("List local web-access jobs such as crawl, run, and batch executions.")
    .option("--json", "Print JSON output")
    .action(async (options: { json?: boolean }) => {
      const config = await loadConfig();
      const jobs = await listJobs(config);
      if (options.json) {
        printJson(jobs);
        return;
      }

      if (jobs.length === 0) {
        printText("No jobs.");
        return;
      }

      printText(
        jobs
          .map((job) => `${job.jobId}  ${job.kind}  ${job.status}  ${job.name}`)
          .join("\n")
      );
    });
}

export function buildJobCommand(): Command {
  return new Command("job")
    .description("Inspect a specific local web-access job.")
    .argument("<jobId>", "Job identifier")
    .option("--json", "Print JSON output")
    .action(async (jobId: string, options: { json?: boolean }) => {
      const config = await loadConfig();
      const job = await getJob(config, jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }
      const result = await readJobResult(config, job);

      if (options.json) {
        printJson({ ...job, result });
        return;
      }

      printText(JSON.stringify({ ...job, result }, null, 2));
    });
}
