import assert from "node:assert/strict";
import test from "node:test";

import { scrapeJson, scrapeText } from "../src/lib/unlocker";

test("scrapeJson groups headings by level and strips inline script content", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async () =>
      new Response(
        `
          <html>
            <head>
              <title>Example</title>
              <meta name="description" content="Structured page" />
            </head>
            <body>
              <h1>Hello <script>const noisy = true;</script>World</h1>
              <h2>Section title</h2>
              <a href="https://example.com/docs">Docs</a>
            </body>
          </html>
        `,
        {
          status: 200,
          headers: {
            "content-type": "text/html",
          },
        },
      )) as typeof fetch;

    const result = await scrapeJson("https://example.com", "test-key");

    assert.equal(result.data.title, "Example");
    assert.deepEqual(result.data.headingsByLevel.h1, ["Hello World"]);
    assert.deepEqual(result.data.headingsByLevel.h2, ["Section title"]);
    assert.deepEqual(result.data.headings.slice(0, 2), ["Hello World", "Section title"]);
    assert.equal(result.data.links[0]?.href, "https://example.com/docs");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("scrapeText retries on retriable status codes", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;

  try {
    globalThis.fetch = (async () => {
      attempts += 1;

      if (attempts === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: {
            "content-type": "text/plain",
          },
        });
      }

      return new Response("<html><body><h1>Recovered page</h1></body></html>", {
        status: 200,
        headers: {
          "content-type": "text/html",
        },
      });
    }) as typeof fetch;

    const result = await scrapeText("https://example.com/retry", "test-key", {
      maxRetries: 1,
      backoffMs: 0,
    });

    assert.equal(attempts, 2);
    assert.match(result.text, /Recovered page/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
