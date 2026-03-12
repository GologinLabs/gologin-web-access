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
  source: "installed-package" | "sibling-project" | "path-command";
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
  const projectRoot = resolveSiblingProject("gologin-agent");
  const distCli = path.join(projectRoot, "dist", "cli.js");

  if (await exists(distCli)) {
    return {
      command: process.execPath,
      args: [distCli],
      cwd: projectRoot,
      source: "sibling-project",
      version: await readPackageVersion(projectRoot),
    };
  }

  const installedPackageRoot = resolveInstalledAgentPackageRoot();
  if (installedPackageRoot) {
    const installedDistCli = path.join(installedPackageRoot, "dist", "cli.js");
    if (await exists(installedDistCli)) {
      return {
        command: process.execPath,
        args: [installedDistCli],
        cwd: installedPackageRoot,
        source: "installed-package",
        version: await readPackageVersion(installedPackageRoot),
      };
    }
  }

  const tsxCli = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const srcCli = path.join(projectRoot, "src", "cli.ts");

  if ((await exists(tsxCli)) && (await exists(srcCli))) {
    return {
      command: process.execPath,
      args: [tsxCli, srcCli],
      cwd: projectRoot,
      source: "sibling-project",
      version: await readPackageVersion(projectRoot),
    };
  }

  const pathCommand = await resolvePathCommand("gologin-agent-browser");
  if (pathCommand) {
    return {
      command: pathCommand,
      args: [],
      cwd: process.cwd(),
      source: "path-command",
    };
  }

  throw new CliError(
    "Gologin Agent CLI is not available.",
    1,
    `Install \`gologin-agent-browser-cli\`, install \`github:GologinLabs/agent-browser\`, or provide sibling project at ${projectRoot}.`,
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

async function resolvePathCommand(commandName: string): Promise<string | undefined> {
  const rawPath = process.env.PATH;
  if (!rawPath) {
    return undefined;
  }

  const pathEntries = rawPath.split(path.delimiter).filter(Boolean);
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
          .split(";")
          .filter(Boolean)
      : [""];

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(entry, `${commandName}${extension}`);
      if (await exists(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}
