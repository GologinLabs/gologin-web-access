import test from "node:test";
import assert from "node:assert/strict";
import os from "os";
import path from "path";
import { promises as fs } from "fs";

import { compareAndPersistSnapshot } from "../src/lib/changeTracking";
import type { ResolvedConfig } from "../src/lib/types";

function makeConfig(): ResolvedConfig {
  const stateDir = path.join(os.tmpdir(), `gwa-track-${Date.now()}-${Math.random().toString(16).slice(2)}`);
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

test("compareAndPersistSnapshot returns new, same, then changed states", async () => {
  const config = makeConfig();
  await fs.mkdir(config.stateDir, { recursive: true });

  const first = await compareAndPersistSnapshot(config, {
    key: "example",
    url: "https://example.com",
    format: "markdown",
    content: "hello"
  });
  const second = await compareAndPersistSnapshot(config, {
    key: "example",
    url: "https://example.com",
    format: "markdown",
    content: "hello"
  });
  const third = await compareAndPersistSnapshot(config, {
    key: "example",
    url: "https://example.com",
    format: "markdown",
    content: "hello world"
  });

  assert.equal(first.status, "new");
  assert.equal(second.status, "same");
  assert.equal(third.status, "changed");
  assert.match(third.diff ?? "", /hello world/);
});
