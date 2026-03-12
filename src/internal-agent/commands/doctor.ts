import { inspectDaemon } from "../lib/daemon";
import type { CommandContext, DoctorResponse } from "../lib/types";
import { getFlagBoolean, parseArgs } from "../lib/utils";

function writeJson(context: CommandContext, payload: unknown): void {
  context.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function writeDoctorReport(context: CommandContext, report: DoctorResponse): void {
  context.stdout.write(`ok=${report.ok}\n`);
  context.stdout.write(`tokenConfigured=${report.tokenConfigured}\n`);
  if (report.defaultProfileId) {
    context.stdout.write(`defaultProfileId=${report.defaultProfileId}\n`);
  }
  context.stdout.write(`connectBase=${report.connectBase}\n`);
  context.stdout.write(`configPath=${report.configPath}\n`);
  context.stdout.write(`daemonLogPath=${report.daemonLogPath}\n`);
  if (report.currentProjectRoot) {
    context.stdout.write(`currentProjectRoot=${report.currentProjectRoot}\n`);
  }
  if (report.currentVersion) {
    context.stdout.write(`currentVersion=${report.currentVersion}\n`);
  }

  for (const transport of report.transports) {
    const parts = [`transport=${transport.label}`, `reachable=${transport.reachable}`];
    if (transport.pid !== undefined) {
      parts.push(`pid=${transport.pid}`);
    }
    if (transport.projectRoot) {
      parts.push(`projectRoot=${transport.projectRoot}`);
    }
    if (transport.version) {
      parts.push(`version=${transport.version}`);
    }
    if (transport.startedAt) {
      parts.push(`startedAt=${transport.startedAt}`);
    }
    if (transport.matchesCurrentBuild !== undefined) {
      parts.push(`matchesCurrentBuild=${transport.matchesCurrentBuild}`);
    }
    context.stdout.write(`${parts.join(" ")}\n`);
  }
}

export async function runDoctorCommand(context: CommandContext, argv: string[]): Promise<void> {
  const parsed = parseArgs(argv);
  const json = getFlagBoolean(parsed, "json");
  const report = await inspectDaemon(context.config);

  if (json) {
    writeJson(context, report);
    return;
  }

  writeDoctorReport(context, report);
}
