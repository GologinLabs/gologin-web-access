import assert from "node:assert/strict";
import test from "node:test";

import { daemonMatchesExpected, isLikelyManagedDaemon } from "../src/internal-agent/lib/daemon";
import type { HealthResponse } from "../src/internal-agent/lib/types";

test("daemonMatchesExpected accepts matching daemon metadata", () => {
  const health: HealthResponse = {
    ok: true,
    pid: 123,
    transports: ["socket", "http"],
    projectRoot: "/repo/current",
    version: "0.3.0",
    startedAt: "2026-03-12T17:00:00.000Z"
  };

  assert.equal(daemonMatchesExpected(health, "/repo/current", "0.3.0"), true);
});

test("daemonMatchesExpected rejects mismatched project roots", () => {
  const health: HealthResponse = {
    ok: true,
    pid: 123,
    transports: ["socket", "http"],
    projectRoot: "/private/tmp/gologin-web-access",
    version: "0.3.0",
    startedAt: "2026-03-12T17:00:00.000Z"
  };

  assert.equal(daemonMatchesExpected(health, "/repo/current", "0.3.0"), false);
});

test("daemonMatchesExpected falls back to process command for legacy daemons", () => {
  const health: HealthResponse = {
    ok: true,
    pid: 123,
    transports: ["socket", "http"]
  };

  assert.equal(
    daemonMatchesExpected(
      health,
      "/repo/current",
      "0.3.0",
      "node /repo/current/dist/internal-agent/daemon/server.js"
    ),
    true
  );
  assert.equal(
    daemonMatchesExpected(
      health,
      "/repo/current",
      "0.3.0",
      "node /private/tmp/gologin-web-access/dist/internal-agent/daemon/server.js"
    ),
    false
  );
});

test("isLikelyManagedDaemon detects gologin-web-access daemon commands", () => {
  assert.equal(
    isLikelyManagedDaemon("node /repo/current/dist/internal-agent/daemon/server.js --name gologin-web-access"),
    true
  );
  assert.equal(isLikelyManagedDaemon("node /repo/other/server.js"), false);
});
