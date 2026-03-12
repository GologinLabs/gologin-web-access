import { loadConfig } from "./config";
import { finalizeJob, markJobRunning } from "./lib/jobRegistry";
import { runSelfCommandCapture } from "./lib/selfCli";

async function main(): Promise<void> {
  const [jobId, command, ...args] = process.argv.slice(2);
  if (!jobId || !command) {
    throw new Error("Usage: jobRunner <jobId> <command> [args...]");
  }

  const config = await loadConfig();
  await markJobRunning(config, jobId);
  const result = await runSelfCommandCapture([command, ...args]);

  if (result.exitCode === 0) {
    await finalizeJob(config, jobId, {
      status: "ok",
      output: result.stdout,
      errorOutput: result.stderr,
      result: tryParseJson(result.stdout)
    });
    return;
  }

  await finalizeJob(config, jobId, {
    status: "failed",
    output: result.stdout,
    errorOutput: result.stderr,
    error: result.stderr.trim() || result.stdout.trim() || `Command exited with code ${result.exitCode}`
  });

  process.exit(result.exitCode);
}

function tryParseJson(value: string): unknown | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

void main().catch(async (error) => {
  const [jobId] = process.argv.slice(2);
  if (jobId) {
    const config = await loadConfig().catch(() => undefined);
    if (config) {
      await finalizeJob(config, jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      }).catch(() => undefined);
    }
  }

  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
