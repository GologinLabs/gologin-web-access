import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

type SelfInvocation = {
  command: string;
  args: string[];
  cwd: string;
};

export function resolveProjectRoot(): string {
  return path.resolve(__dirname, "..", "..");
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveSelfCliInvocation(): Promise<SelfInvocation> {
  const projectRoot = resolveProjectRoot();
  const distCli = path.join(projectRoot, "dist", "cli.js");

  if (await exists(distCli)) {
    return {
      command: process.execPath,
      args: [distCli],
      cwd: projectRoot
    };
  }

  const tsxCli = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const srcCli = path.join(projectRoot, "src", "cli.ts");
  if ((await exists(tsxCli)) && (await exists(srcCli))) {
    return {
      command: process.execPath,
      args: [tsxCli, srcCli],
      cwd: projectRoot
    };
  }

  throw new Error(`Unable to resolve gologin-web-access CLI from ${projectRoot}`);
}

export async function runSelfCommandCapture(
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const invocation = await resolveSelfCliInvocation();

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, [...invocation.args, ...args], {
      cwd: options.cwd ?? invocation.cwd,
      env: {
        ...process.env,
        ...options.env
      },
      stdio: ["ignore", "pipe", "pipe"]
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
        reject(new Error(`gologin-web-access exited via signal ${signal}`));
        return;
      }

      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}

export async function spawnDetachedSelfCommand(
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {}
): Promise<void> {
  const invocation = await resolveSelfCliInvocation();

  const child = spawn(invocation.command, [...invocation.args, ...args], {
    cwd: options.cwd ?? invocation.cwd,
    env: {
      ...process.env,
      ...options.env
    },
    detached: true,
    stdio: "ignore"
  });

  child.unref();
}

export async function resolveNodeScriptInvocation(scriptBasename: string): Promise<SelfInvocation> {
  const projectRoot = resolveProjectRoot();
  const distScript = path.join(projectRoot, "dist", `${scriptBasename}.js`);
  if (await exists(distScript)) {
    return {
      command: process.execPath,
      args: [distScript],
      cwd: projectRoot
    };
  }

  const tsxCli = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const srcScript = path.join(projectRoot, "src", `${scriptBasename}.ts`);
  if ((await exists(tsxCli)) && (await exists(srcScript))) {
    return {
      command: process.execPath,
      args: [tsxCli, srcScript],
      cwd: projectRoot
    };
  }

  throw new Error(`Unable to resolve script ${scriptBasename} from ${projectRoot}`);
}

export async function spawnDetachedNodeInvocation(
  scriptBasename: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {}
): Promise<void> {
  const invocation = await resolveNodeScriptInvocation(scriptBasename);
  const child = spawn(invocation.command, [...invocation.args, ...args], {
    cwd: options.cwd ?? invocation.cwd,
    env: {
      ...process.env,
      ...options.env
    },
    detached: true,
    stdio: "ignore"
  });

  child.unref();
}
