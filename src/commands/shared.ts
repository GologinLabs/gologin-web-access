import path from "path";
import { Command } from "commander";
import { loadConfig, requireCloudToken, resolveProfileId } from "../config";
import { runAgentCommand } from "../lib/agentCli";
import type { ScrapeRequestOptions } from "../lib/unlocker";

export function addSessionOption(command: Command): Command {
  return command.option("--session <id>", "Session ID. Defaults to the current session.");
}

export function addProfileOption(command: Command): Command {
  return command.option("--profile <id>", "Gologin profile ID to use");
}

export async function runBrowserCommand(
  commandArgs: string[],
  options?: {
    requiresToken?: boolean;
    session?: string;
  },
): Promise<void> {
  const config = await loadConfig();
  if (options?.requiresToken !== false) {
    requireCloudToken(config);
  }

  const args = [...commandArgs];
  if (options?.session) {
    args.push("--session", options.session);
  }

  await runAgentCommand(args, config);
}

export async function runOpenLikeCommand(
  url: string,
  options: {
    profile?: string;
    session?: string;
    idleTimeoutMs?: string;
    proxyCountry?: string;
    proxyMode?: string;
    proxyHost?: string;
    proxyPort?: string;
    proxyUser?: string;
    proxyPass?: string;
  },
): Promise<void> {
  const config = await loadConfig();
  requireCloudToken(config);

  const args = ["open", url];
  const profileId = resolveProfileId(config, options.profile);
  if (profileId) {
    args.push("--profile", profileId);
  }
  if (options.session) {
    args.push("--session", options.session);
  }
  if (options.idleTimeoutMs) {
    args.push("--idle-timeout-ms", options.idleTimeoutMs);
  }
  if (options.proxyCountry) {
    args.push("--proxy-country", options.proxyCountry);
  }
  if (options.proxyMode) {
    args.push("--proxy-mode", options.proxyMode);
  }
  if (options.proxyHost) {
    args.push("--proxy-host", options.proxyHost);
  }
  if (options.proxyPort) {
    args.push("--proxy-port", options.proxyPort);
  }
  if (options.proxyUser) {
    args.push("--proxy-user", options.proxyUser);
  }
  if (options.proxyPass) {
    args.push("--proxy-pass", options.proxyPass);
  }

  await runAgentCommand(args, config);
}

export function resolveOutputPath(targetPath: string): string {
  return path.resolve(targetPath);
}

export function addUnlockerRequestOptions(command: Command): Command {
  return command
    .option("--retry <count>", "Retry attempts for timeout, 429, and 5xx responses")
    .option("--backoff-ms <ms>", "Base exponential backoff in milliseconds for retried requests")
    .option("--timeout-ms <ms>", "Per-request timeout in milliseconds");
}

export function normalizeUnlockerRequestOptions(options: {
  retry?: string;
  backoffMs?: string;
  timeoutMs?: string;
}): ScrapeRequestOptions {
  return {
    maxRetries: normalizeOptionalNonNegativeInt(options.retry),
    backoffMs: normalizeOptionalNonNegativeInt(options.backoffMs),
    timeoutMs: normalizeOptionalPositiveInt(options.timeoutMs),
  };
}

function normalizeOptionalNonNegativeInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Expected a non-negative integer, got: ${value}`);
  }

  return Math.floor(parsed);
}

function normalizeOptionalPositiveInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got: ${value}`);
  }

  return Math.floor(parsed);
}
