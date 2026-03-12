import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { ResolvedConfig, WebAccessJobKind, WebAccessJobRecord, WebAccessJobStatus } from "./types";

type JobStartInput = {
  kind: WebAccessJobKind;
  name: string;
  cwd: string;
  args: string[];
  metadata?: Record<string, unknown>;
};

type JobCompletionInput = {
  status: Exclude<WebAccessJobStatus, "queued" | "running">;
  output?: string;
  errorOutput?: string;
  result?: unknown;
  error?: string;
};

function jobPath(config: ResolvedConfig, jobId: string): string {
  return path.join(config.jobsDir, `${jobId}.json`);
}

function outputPath(config: ResolvedConfig, jobId: string): string {
  return path.join(config.jobsDir, `${jobId}.out.log`);
}

function errorPath(config: ResolvedConfig, jobId: string): string {
  return path.join(config.jobsDir, `${jobId}.err.log`);
}

function resultPath(config: ResolvedConfig, jobId: string): string {
  return path.join(config.jobsDir, `${jobId}.result.json`);
}

async function ensureJobsDir(config: ResolvedConfig): Promise<void> {
  await fs.mkdir(config.jobsDir, { recursive: true });
}

async function writeRecord(config: ResolvedConfig, record: WebAccessJobRecord): Promise<void> {
  await ensureJobsDir(config);
  await fs.writeFile(jobPath(config, record.jobId), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

export async function createJob(config: ResolvedConfig, input: JobStartInput): Promise<WebAccessJobRecord> {
  const now = new Date().toISOString();
  const jobId = `job-${now.replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const record: WebAccessJobRecord = {
    jobId,
    kind: input.kind,
    name: input.name,
    status: "queued",
    cwd: input.cwd,
    args: [...input.args],
    createdAt: now,
    updatedAt: now,
    outputPath: outputPath(config, jobId),
    errorPath: errorPath(config, jobId),
    resultPath: resultPath(config, jobId),
    metadata: input.metadata
  };

  await writeRecord(config, record);
  return record;
}

export async function markJobRunning(config: ResolvedConfig, jobId: string): Promise<WebAccessJobRecord | undefined> {
  const current = await getJob(config, jobId);
  if (!current) {
    return undefined;
  }

  const next: WebAccessJobRecord = {
    ...current,
    status: "running",
    updatedAt: new Date().toISOString(),
    startedAt: current.startedAt ?? new Date().toISOString()
  };
  await writeRecord(config, next);
  return next;
}

export async function finalizeJob(
  config: ResolvedConfig,
  jobId: string,
  input: JobCompletionInput
): Promise<WebAccessJobRecord | undefined> {
  const current = await getJob(config, jobId);
  if (!current) {
    return undefined;
  }

  await ensureJobsDir(config);

  if (input.output !== undefined && current.outputPath) {
    await fs.writeFile(current.outputPath, input.output, "utf8");
  }
  if (input.errorOutput !== undefined && current.errorPath) {
    await fs.writeFile(current.errorPath, input.errorOutput, "utf8");
  }
  if (input.result !== undefined && current.resultPath) {
    await fs.writeFile(current.resultPath, `${JSON.stringify(input.result, null, 2)}\n`, "utf8");
  }

  const finishedAt = new Date().toISOString();
  const durationMs = current.startedAt
    ? Math.max(0, new Date(finishedAt).getTime() - new Date(current.startedAt).getTime())
    : undefined;

  const next: WebAccessJobRecord = {
    ...current,
    status: input.status,
    updatedAt: finishedAt,
    finishedAt,
    durationMs,
    error: input.error ?? current.error
  };
  await writeRecord(config, next);
  return next;
}

export async function getJob(config: ResolvedConfig, jobId: string): Promise<WebAccessJobRecord | undefined> {
  try {
    const raw = await fs.readFile(jobPath(config, jobId), "utf8");
    return JSON.parse(raw) as WebAccessJobRecord;
  } catch {
    return undefined;
  }
}

export async function listJobs(config: ResolvedConfig): Promise<WebAccessJobRecord[]> {
  try {
    const entries = await fs.readdir(config.jobsDir);
    const jobs = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json") && !entry.endsWith(".result.json"))
        .map(async (entry) => {
          try {
            const raw = await fs.readFile(path.join(config.jobsDir, entry), "utf8");
            return JSON.parse(raw) as WebAccessJobRecord;
          } catch {
            return undefined;
          }
        })
    );

    return jobs
      .filter((job): job is WebAccessJobRecord => Boolean(job))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch {
    return [];
  }
}

export async function readJobResult(config: ResolvedConfig, job: WebAccessJobRecord): Promise<unknown | undefined> {
  if (!job.resultPath) {
    return undefined;
  }

  try {
    const raw = await fs.readFile(job.resultPath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export async function readJobOutput(job: WebAccessJobRecord): Promise<string> {
  if (!job.outputPath) {
    return "";
  }

  try {
    return await fs.readFile(job.outputPath, "utf8");
  } catch {
    return "";
  }
}

export async function readJobErrors(job: WebAccessJobRecord): Promise<string> {
  if (!job.errorPath) {
    return "";
  }

  try {
    return await fs.readFile(job.errorPath, "utf8");
  } catch {
    return "";
  }
}
