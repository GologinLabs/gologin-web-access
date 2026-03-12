import path from "path";
import { Command } from "commander";
import { loadConfig } from "../config";
import { createJob, finalizeJob, markJobRunning } from "../lib/jobRegistry";
import { executeBatch, loadBatchDefinition, loadRunbookDefinition, loadVariablesFile } from "../lib/runbooks";
import { printJson, printText } from "../lib/output";

export function buildBatchCommand(): Command {
  return new Command("batch")
    .description("Execute a runbook across multiple profile/session targets.")
    .argument("<runbookPath>", "Path to the runbook JSON file")
    .requiredOption("--targets <path>", "Path to a batch targets JSON file")
    .option("--concurrency <count>", "Maximum number of targets to run in parallel")
    .option("--vars <path>", "Path to a JSON variables file")
    .option("--name <name>", "Override the stored job name")
    .option("--continue-on-error", "Continue after failed steps inside each target")
    .option("--json", "Print the final job record as JSON")
    .action(
      async (
        runbookPath: string,
        options: {
          targets: string;
          concurrency?: string;
          vars?: string;
          name?: string;
          continueOnError?: boolean;
          json?: boolean;
        }
      ) => {
        const config = await loadConfig();
        const runbook = loadRunbookDefinition(process.cwd(), runbookPath);
        const batch = loadBatchDefinition(process.cwd(), options.targets);
        const variables = options.vars ? loadVariablesFile(process.cwd(), options.vars) : undefined;
        const absoluteRunbookPath = path.resolve(runbookPath);
        const job = await createJob(config, {
          kind: "batch",
          name: options.name ?? path.basename(absoluteRunbookPath, path.extname(absoluteRunbookPath)),
          cwd: process.cwd(),
          args: process.argv.slice(2),
          metadata: {
            runbookPath: absoluteRunbookPath,
            targetsPath: path.resolve(options.targets)
          }
        });
        await markJobRunning(config, job.jobId);

        try {
          const results = await executeBatch(runbook, batch, {
            cwd: process.cwd(),
            concurrency: options.concurrency ? Number(options.concurrency) : undefined,
            variables,
            continueOnError: options.continueOnError === true
          });
          const failed = results.filter((target) => target.status === "failed").length;
          const output = results
            .map((target) => {
              const lines = [`target=${target.name} status=${target.status} durationMs=${target.durationMs}`];
              for (const step of target.steps) {
                lines.push(`  step=${step.command} status=${step.status} durationMs=${step.durationMs}`);
              }
              return lines.join("\n");
            })
            .join("\n");
          const record = await finalizeJob(config, job.jobId, {
            status: failed > 0 ? "partial" : "ok",
            output,
            result: results
          });

          if (options.json) {
            printJson(record);
            return;
          }

          printText(output);
        } catch (error) {
          const record = await finalizeJob(config, job.jobId, {
            status: "failed",
            error: error instanceof Error ? error.message : String(error)
          });

          if (options.json) {
            printJson(record);
            process.exitCode = 1;
            return;
          }

          throw error;
        }
      }
    );
}
