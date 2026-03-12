import { readFileSync } from "fs";
import path from "path";

import { runSelfCommandCapture } from "./selfCli";

export type RunbookPrimitive = string | number | boolean;
export type RunbookVariables = Record<string, RunbookPrimitive>;

export interface RunbookStepDefinition {
  command: string;
  args?: RunbookPrimitive[];
  flags?: Record<string, RunbookPrimitive>;
  label?: string;
  continueOnError?: boolean;
}

export interface RunbookDefinition {
  description?: string;
  variables?: RunbookVariables;
  continueOnError?: boolean;
  steps: RunbookStepDefinition[];
}

export interface BatchTargetDefinition {
  name?: string;
  sessionId?: string;
  profileId?: string;
  variables?: RunbookVariables;
  continueOnError?: boolean;
}

export interface BatchDefinition {
  concurrency?: number;
  variables?: RunbookVariables;
  targets: BatchTargetDefinition[];
}

export interface RunbookStepResult {
  command: string;
  label?: string;
  status: "ok" | "failed";
  durationMs: number;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface RunbookExecutionResult {
  steps: RunbookStepResult[];
}

export interface BatchTargetResult {
  name: string;
  status: "ok" | "failed";
  durationMs: number;
  sessionId?: string;
  profileId?: string;
  steps: RunbookStepResult[];
}

const SESSION_SCOPED_COMMANDS = new Set([
  "open",
  "search-browser",
  "tabs",
  "tabopen",
  "tabfocus",
  "tabclose",
  "snapshot",
  "click",
  "dblclick",
  "focus",
  "type",
  "fill",
  "hover",
  "select",
  "check",
  "uncheck",
  "press",
  "scroll",
  "scrollintoview",
  "wait",
  "get",
  "back",
  "forward",
  "reload",
  "find",
  "cookies",
  "cookies-import",
  "cookies-clear",
  "storage-export",
  "storage-import",
  "storage-clear",
  "eval",
  "upload",
  "pdf",
  "screenshot",
  "close"
]);

const PROFILE_SCOPED_COMMANDS = new Set(["open", "search-browser", "scrape-screenshot"]);
const DISALLOWED_COMMANDS = new Set(["run", "batch", "__job-runner"]);

export function loadRunbookDefinition(baseDir: string, filePath: string): RunbookDefinition {
  const absolutePath = ensureAbsolutePath(baseDir, filePath);
  return JSON.parse(readFileSync(absolutePath, "utf8")) as RunbookDefinition;
}

export function loadBatchDefinition(baseDir: string, filePath: string): BatchDefinition {
  const absolutePath = ensureAbsolutePath(baseDir, filePath);
  const parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as BatchDefinition | BatchTargetDefinition[];
  if (Array.isArray(parsed)) {
    return { targets: parsed };
  }
  return parsed;
}

export function loadVariablesFile(baseDir: string, filePath: string): RunbookVariables {
  const absolutePath = ensureAbsolutePath(baseDir, filePath);
  return JSON.parse(readFileSync(absolutePath, "utf8")) as RunbookVariables;
}

export async function executeRunbook(
  runbook: RunbookDefinition,
  options: {
    cwd: string;
    sessionId?: string;
    profileId?: string;
    variables?: RunbookVariables;
    continueOnError?: boolean;
  }
): Promise<RunbookExecutionResult> {
  const mergedVariables = {
    ...(runbook.variables ?? {}),
    ...(options.variables ?? {})
  };
  const continueOnError = options.continueOnError === true || runbook.continueOnError === true;
  const results: RunbookStepResult[] = [];

  for (const step of runbook.steps) {
    if (DISALLOWED_COMMANDS.has(step.command)) {
      throw new Error(`Runbook command ${step.command} is not allowed`);
    }

    const invocation = buildStepInvocation(step, mergedVariables, {
      sessionId: options.sessionId,
      profileId: options.profileId
    });
    const startedAt = Date.now();
    const result = await runSelfCommandCapture(invocation, { cwd: options.cwd });
    const durationMs = Date.now() - startedAt;
    const stepResult: RunbookStepResult = {
      command: step.command,
      label: step.label,
      status: result.exitCode === 0 ? "ok" : "failed",
      durationMs,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.exitCode === 0 ? undefined : result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`
    };
    results.push(stepResult);

    if (stepResult.status === "failed" && !(continueOnError || step.continueOnError)) {
      throw Object.assign(new Error(stepResult.error ?? `Runbook step failed: ${step.command}`), { steps: results });
    }
  }

  return { steps: results };
}

export async function executeBatch(
  runbook: RunbookDefinition,
  batch: BatchDefinition,
  options: {
    cwd: string;
    concurrency?: number;
    variables?: RunbookVariables;
    continueOnError?: boolean;
  }
): Promise<BatchTargetResult[]> {
  const concurrency = Math.max(1, options.concurrency ?? batch.concurrency ?? 2);
  const sharedVariables = {
    ...(batch.variables ?? {}),
    ...(options.variables ?? {})
  };
  const queue = [...batch.targets];
  const results: BatchTargetResult[] = [];

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const target = queue.shift();
        if (!target) {
          return;
        }

        const name = target.name ?? target.sessionId ?? target.profileId ?? `target-${results.length + 1}`;
        const startedAt = Date.now();

        try {
          const execution = await executeRunbook(runbook, {
            cwd: options.cwd,
            sessionId: target.sessionId,
            profileId: target.profileId,
            variables: {
              ...sharedVariables,
              ...(target.variables ?? {})
            },
            continueOnError: options.continueOnError === true || target.continueOnError === true
          });
          results.push({
            name,
            status: execution.steps.some((step) => step.status === "failed") ? "failed" : "ok",
            durationMs: Date.now() - startedAt,
            sessionId: target.sessionId,
            profileId: target.profileId,
            steps: execution.steps
          });
        } catch (error) {
          const steps =
            error && typeof error === "object" && "steps" in error && Array.isArray((error as { steps?: unknown }).steps)
              ? ((error as { steps: RunbookStepResult[] }).steps ?? [])
              : [];

          results.push({
            name,
            status: "failed",
            durationMs: Date.now() - startedAt,
            sessionId: target.sessionId,
            profileId: target.profileId,
            steps
          });
        }
      }
    })
  );

  return results.sort((left, right) => left.name.localeCompare(right.name));
}

function buildStepInvocation(
  step: RunbookStepDefinition,
  variables: RunbookVariables,
  options: {
    sessionId?: string;
    profileId?: string;
  }
): string[] {
  const args = [resolveTemplate(step.command, variables)];
  const positionals = (step.args ?? []).map((value) => String(resolvePrimitive(value, variables)));
  const flags = Object.entries(step.flags ?? {}).flatMap(([name, value]) => {
    const resolved = resolvePrimitive(value, variables);
    if (typeof resolved === "boolean") {
      return resolved ? [`--${name}`] : [];
    }
    return [`--${name}`, String(resolved)];
  });

  args.push(...positionals, ...flags);

  if (options.sessionId && SESSION_SCOPED_COMMANDS.has(step.command) && !flagPresent(args, "session")) {
    args.push("--session", options.sessionId);
  }

  if (options.profileId && PROFILE_SCOPED_COMMANDS.has(step.command) && !flagPresent(args, "profile")) {
    args.push("--profile", options.profileId);
  }

  return args;
}

function resolvePrimitive(value: RunbookPrimitive, variables: RunbookVariables): RunbookPrimitive {
  return typeof value === "string" ? resolveTemplate(value, variables) : value;
}

function resolveTemplate(value: string, variables: RunbookVariables): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    if (!(key in variables)) {
      throw new Error(`Missing runbook variable: ${key}`);
    }
    return String(variables[key]);
  });
}

function flagPresent(argv: string[], flagName: string): boolean {
  return argv.includes(`--${flagName}`);
}

function ensureAbsolutePath(baseDir: string, targetPath: string): string {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(baseDir, targetPath);
}
