import { spawn } from "child_process";
import { promises as fs } from "fs";
import { createRequire } from "module";
import path from "path";
import { CliError, SilentExitError } from "./errors";
import { ResolvedConfig } from "./types";

type AgentCliInvocation = {
  command: string;
  args: string[];
  cwd: string;
};

export async function runAgentCommand(args: string[], config: ResolvedConfig): Promise<void> {
  const invocation = await resolveAgentCliInvocation();
  const exitCode = await spawnAndWait(invocation, args, config);

  if (exitCode !== 0) {
    throw new SilentExitError(exitCode);
  }
}

export async function isDaemonReachable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function agentCliAvailable(): Promise<boolean> {
  try {
    await resolveAgentCliInvocation();
    return true;
  } catch {
    return false;
  }
}

async function resolveAgentCliInvocation(): Promise<AgentCliInvocation> {
  const installedPackageRoot = resolveInstalledAgentPackageRoot();
  if (installedPackageRoot) {
    const distCli = path.join(installedPackageRoot, "dist", "cli.js");
    if (await exists(distCli)) {
      return {
        command: process.execPath,
        args: [distCli],
        cwd: installedPackageRoot,
      };
    }
  }

  const projectRoot = resolveSiblingProject("gologin-agent");
  const distCli = path.join(projectRoot, "dist", "cli.js");

  if (await exists(distCli)) {
    return {
      command: process.execPath,
      args: [distCli],
      cwd: projectRoot,
    };
  }

  const tsxCli = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const srcCli = path.join(projectRoot, "src", "cli.ts");

  if ((await exists(tsxCli)) && (await exists(srcCli))) {
    return {
      command: process.execPath,
      args: [tsxCli, srcCli],
      cwd: projectRoot,
    };
  }

  throw new CliError(
    "GoLogin Agent CLI is not available.",
    1,
    `Install dependency \`gologin-agent-browser-cli\` or provide sibling project at ${projectRoot}.`,
  );
}

function resolveSiblingProject(name: string): string {
  return path.resolve(__dirname, "..", "..", "..", name);
}

function resolveInstalledAgentPackageRoot(): string | undefined {
  try {
    const requireFromHere = createRequire(__filename);
    const packageJsonPath = requireFromHere.resolve("gologin-agent-browser-cli/package.json");
    return path.dirname(packageJsonPath);
  } catch {
    return undefined;
  }
}

function spawnAndWait(
  invocation: AgentCliInvocation,
  args: string[],
  config: ResolvedConfig,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, [...invocation.args, ...args], {
      cwd: invocation.cwd,
      env: buildAgentEnv(config),
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new CliError(`GoLogin Agent CLI terminated by signal ${signal}.`));
        return;
      }

      resolve(code ?? 1);
    });
  });
}

function buildAgentEnv(config: ResolvedConfig): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GOLOGIN_DAEMON_PORT: String(config.daemonPort),
  };

  if (config.cloudToken) {
    env.GOLOGIN_TOKEN = config.cloudToken;
  }

  if (config.defaultProfileId) {
    env.GOLOGIN_PROFILE_ID = config.defaultProfileId;
  }

  return env;
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
