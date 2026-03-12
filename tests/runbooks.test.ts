import test from "node:test";
import assert from "node:assert/strict";

import { executeRunbook } from "../src/lib/runbooks";

test("executeRunbook can run a simple local command", async () => {
  const result = await executeRunbook(
    {
      steps: [
        {
          command: "config",
          args: ["show"]
        }
      ]
    },
    {
      cwd: process.cwd()
    }
  );

  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0]?.status, "ok");
  assert.match(result.steps[0]?.stdout ?? "", /GOLOGIN_WEB_UNLOCKER_API_KEY/);
});
