import assert from "node:assert/strict";
import test from "node:test";

import { gologinApiRequest } from "../src/lib/cloudApi";
import { HttpError } from "../src/lib/errors";

test("gologinApiRequest sends bearer token, query, and JSON body", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  try {
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const payload = await gologinApiRequest<{ ok: boolean }>("token-123", "POST", "/browser/test", {
      query: { workspaceId: "w1", days: 7, empty: undefined },
      body: { hello: "world" },
    });

    assert.deepEqual(payload, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.gologin.com/browser/test?workspaceId=w1&days=7");
    assert.equal(calls[0].init?.method, "POST");
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer token-123");
    assert.equal((calls[0].init?.headers as Record<string, string>)["Content-Type"], "application/json");
    assert.equal(calls[0].init?.body, "{\"hello\":\"world\"}");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("gologinApiRequest surfaces GoLogin API errors", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "profile is already running" }), { status: 409 })) as typeof fetch;

    await assert.rejects(
      () => gologinApiRequest("token-123", "DELETE", "/browser/p1/web"),
      (error) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.status, 409);
        assert.match(error.message, /GoLogin API DELETE/);
        assert.match(error.hint ?? "", /profile is already running/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
