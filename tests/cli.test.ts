import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import test from "node:test";

import { runSelfCommandCapture } from "../src/lib/selfCli";

test("version command prints the CLI version", async () => {
  const result = await runSelfCommandCapture(["version"], {
    env: {
      GOLOGIN_WEB_ACCESS_USE_SOURCE_CLI: "1",
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.trim(), "0.3.0");
});

test("read command explains the recommended two-key setup when Web Unlocker is missing", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "gologin-web-access-cli-"));
  const result = await runSelfCommandCapture(["read", "https://example.com"], {
    env: {
      GOLOGIN_WEB_ACCESS_USE_SOURCE_CLI: "1",
      GOLOGIN_WEB_UNLOCKER_API_KEY: "",
      GOLOGIN_WEBUNLOCKER_API_KEY: "",
      GOLOGIN_CLOUD_TOKEN: "",
      GOLOGIN_TOKEN: "",
      GOLOGIN_DEFAULT_PROFILE_ID: "",
      GOLOGIN_PROFILE_ID: "",
      HOME: home,
    },
  });

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /Missing GOLOGIN_WEB_UNLOCKER_API_KEY/);
  assert.match(result.stderr, /configure both GOLOGIN_WEB_UNLOCKER_API_KEY and GOLOGIN_CLOUD_TOKEN/i);
  assert.match(result.stderr, /config init/i);
  assert.match(result.stderr, /config show/i);
  assert.match(result.stderr, /doctor/i);
});

test("doctor reports whether the recommended two-key setup is complete", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "gologin-web-access-cli-"));
  const result = await runSelfCommandCapture(["doctor", "--json"], {
    env: {
      GOLOGIN_WEB_ACCESS_USE_SOURCE_CLI: "1",
      GOLOGIN_WEB_UNLOCKER_API_KEY: "",
      GOLOGIN_WEBUNLOCKER_API_KEY: "",
      GOLOGIN_CLOUD_TOKEN: "",
      GOLOGIN_TOKEN: "",
      GOLOGIN_DEFAULT_PROFILE_ID: "",
      GOLOGIN_PROFILE_ID: "",
      HOME: home,
    },
  });

  assert.equal(result.exitCode, 0);
  const payload = JSON.parse(result.stdout) as {
    checks: Array<{ name: string; status: string; detail: string }>;
  };
  const check = payload.checks.find((entry) => entry.name === "Recommended full setup");
  assert.ok(check);
  assert.equal(check.status, "warn");
  assert.match(check.detail, /GOLOGIN_WEB_UNLOCKER_API_KEY/);
  assert.match(check.detail, /GOLOGIN_CLOUD_TOKEN/);
});
