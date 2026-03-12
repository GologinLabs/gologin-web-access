import test from "node:test";
import assert from "node:assert/strict";
import os from "os";
import path from "path";
import { promises as fs } from "fs";

import { createJob, finalizeJob, getJob, listJobs, markJobRunning, readJobResult } from "../src/lib/jobRegistry";
import type { ResolvedConfig } from "../src/lib/types";

function makeConfig(): ResolvedConfig {
  const stateDir = path.join(os.tmpdir(), `gwa-jobs-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return {
    configPath: path.join(stateDir, "config.json"),
    stateDir,
    jobsDir: path.join(stateDir, "jobs"),
    trackingDir: path.join(stateDir, "tracking"),
    artifactsDir: path.join(stateDir, "artifacts"),
    webUnlockerApiKey: undefined,
    cloudToken: undefined,
    defaultProfileId: undefined,
    daemonPort: 4590,
    sources: {
      webUnlockerApiKey: "unset",
      cloudToken: "unset",
      defaultProfileId: "unset",
      daemonPort: "default"
    }
  };
}

test("jobRegistry stores and retrieves job lifecycle state", async () => {
  const config = makeConfig();
  await fs.mkdir(config.stateDir, { recursive: true });

  const job = await createJob(config, {
    kind: "crawl",
    name: "crawl example",
    cwd: process.cwd(),
    args: ["crawl", "https://example.com"]
  });

  await markJobRunning(config, job.jobId);
  await finalizeJob(config, job.jobId, {
    status: "ok",
    output: "done",
    result: { ok: true }
  });

  const stored = await getJob(config, job.jobId);
  const jobs = await listJobs(config);
  const result = stored ? await readJobResult(config, stored) : undefined;

  assert.equal(stored?.status, "ok");
  assert.equal(jobs.length, 1);
  assert.deepEqual(result, { ok: true });
});
