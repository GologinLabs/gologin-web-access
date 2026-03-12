import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { CliError, SilentExitError } from "./errors";
import { ResolvedConfig } from "./types";

type AgentCliInvocation = {
  command: string;
  args: string[];
  cwd: string;
  source: "internal-bundled" | "internal-source";
  version?: string;
};

export async function runAgentCommand(args: string[], config: ResolvedConfig): Promise<void> {
  const invocation = await resolveAgentCliInvocation();
  const exitCode = await spawnAndWait(invocation, args, config);

  if (exitCode !== 0) {
    throw new SilentExitError(exitCode);
  }
}

export async function runAgentCommandCapture(
  args: string[],
  config: ResolvedConfig,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const invocation = await resolveAgentCliInvocation();
  return spawnAndCapture(invocation, args, config);
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

export async function inspectAgentCli(): Promise<AgentCliInvocation | undefined> {
  try {
    return await resolveAgentCliInvocation();
  } catch {
    return undefined;
  }
}

async function resolveAgentCliInvocation(): Promise<AgentCliInvocation> {
  const projectRoot = resolveProjectRoot();
  const distCli = path.join(projectRoot, "dist", "internal-agent", "cli.js");

  if (await exists(distCli)) {
    return {
      command: process.execPath,
      args: [distCli],
      cwd: projectRoot,
      source: "internal-bundled",
      version: await readPackageVersion(projectRoot),
    };
  }

  const tsxCli = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const srcCli = path.join(projectRoot, "src", "internal-agent", "cli.ts");

  if ((await exists(tsxCli)) && (await exists(srcCli))) {
    return {
      command: process.execPath,
      args: [tsxCli, srcCli],
      cwd: projectRoot,
      source: "internal-source",
      version: await readPackageVersion(projectRoot),
    };
  }

  throw new CliError(
    "Gologin Agent CLI is not available.",
    1,
    `Internal browser runtime is missing from this gologin-web-access install at ${projectRoot}. Reinstall the package and rebuild it.`,
  );
}

function resolveProjectRoot(): string {
  return path.resolve(__dirname, "..", "..");
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
        reject(new CliError(`Gologin Agent CLI terminated by signal ${signal}.`));
        return;
      }

      resolve(code ?? 1);
    });
  });
}

function spawnAndCapture(
  invocation: AgentCliInvocation,
  args: string[],
  config: ResolvedConfig,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, [...invocation.args, ...args], {
      cwd: invocation.cwd,
      env: buildAgentEnv(config),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new CliError(`Gologin Agent CLI terminated by signal ${signal}.`));
        return;
      }

      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
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

async function readPackageVersion(packageRoot: string): Promise<string | undefined> {
  const packageJsonPath = path.join(packageRoot, "package.json");

  try {
    const raw = await fs.readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : undefined;
  } catch {
    return undefined;
  }
}
