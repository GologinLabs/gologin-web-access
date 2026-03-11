import path from "path";
import { Command } from "commander";
import { loadConfig, requireCloudToken, resolveProfileId } from "../config";
import { runAgentCommand } from "../lib/agentCli";

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
