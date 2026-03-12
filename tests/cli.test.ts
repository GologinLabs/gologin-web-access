import assert from "node:assert/strict";
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
