import path from "path";
import { Command } from "commander";
import { loadConfig } from "../config";
import { createJob, finalizeJob, markJobRunning } from "../lib/jobRegistry";
import { executeRunbook, loadRunbookDefinition, loadVariablesFile } from "../lib/runbooks";
import { printJson, printText } from "../lib/output";

export function buildRunCommand(): Command {
  return new Command("run")
    .description("Execute a JSON runbook through gologin-web-access commands.")
    .argument("<runbookPath>", "Path to the runbook JSON file")
    .option("--session <id>", "Default session id for browser commands")
    .option("--profile <id>", "Default profile id for browser commands that open sessions")
    .option("--vars <path>", "Path to a JSON variables file")
    .option("--name <name>", "Override the stored job name")
    .option("--continue-on-error", "Continue after failed steps")
    .option("--json", "Print the final job record as JSON")
    .action(
      async (
        runbookPath: string,
        options: {
          session?: string;
          profile?: string;
          vars?: string;
          name?: string;
          continueOnError?: boolean;
          json?: boolean;
        }
      ) => {
        const config = await loadConfig();
        const runbook = loadRunbookDefinition(process.cwd(), runbookPath);
        const variables = options.vars ? loadVariablesFile(process.cwd(), options.vars) : undefined;
        const absoluteRunbookPath = path.resolve(runbookPath);
        const job = await createJob(config, {
          kind: "run",
          name: options.name ?? path.basename(absoluteRunbookPath, path.extname(absoluteRunbookPath)),
          cwd: process.cwd(),
          args: process.argv.slice(2),
          metadata: {
            runbookPath: absoluteRunbookPath,
            sessionId: options.session,
            profileId: options.profile
          }
        });
        await markJobRunning(config, job.jobId);

        try {
          const execution = await executeRunbook(runbook, {
            cwd: process.cwd(),
            sessionId: options.session,
            profileId: options.profile,
            variables,
            continueOnError: options.continueOnError === true
          });
          const failed = execution.steps.filter((step) => step.status === "failed").length;
          const output = execution.steps
            .map((step) => [`step=${step.command} status=${step.status} durationMs=${step.durationMs}`, step.stdout.trim(), step.stderr.trim()].filter(Boolean).join("\n"))
            .join("\n\n");
          const record = await finalizeJob(config, job.jobId, {
            status: failed > 0 ? "partial" : "ok",
            output,
            result: execution
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
