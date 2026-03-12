import test from "node:test";
import assert from "node:assert/strict";

import { resolveTraversalStatus } from "../src/lib/crawl";

test("resolveTraversalStatus distinguishes ok partial and failed", () => {
  assert.equal(resolveTraversalStatus(3, 0), "ok");
  assert.equal(resolveTraversalStatus(3, 1), "partial");
  assert.equal(resolveTraversalStatus(3, 3), "failed");
  assert.equal(resolveTraversalStatus(0, 0), "failed");
});
