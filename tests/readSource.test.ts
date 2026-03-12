import assert from "node:assert/strict";
import test from "node:test";

import { assessReadableContent, normalizeReadSourceMode } from "../src/lib/readSource";
import { htmlToText } from "../src/lib/unlocker";

test("normalizeReadSourceMode accepts auto unlocker and browser", () => {
  assert.equal(normalizeReadSourceMode(undefined, "auto"), "auto");
  assert.equal(normalizeReadSourceMode("unlocker", "auto"), "unlocker");
  assert.equal(normalizeReadSourceMode("browser", "auto"), "browser");
});

test("assessReadableContent accepts normal article pages", () => {
  const html = `
    <html>
      <body>
        <main>
          <article>
            <h1>Browserbase docs overview</h1>
            <p>Browserbase lets you run cloud browsers at scale.</p>
            <p>Use contexts, sessions, and proxies to keep flows isolated.</p>
            <p>Stagehand adds high-level browser automation primitives.</p>
          </article>
        </main>
      </body>
    </html>
  `;

  const assessment = assessReadableContent(html, htmlToText(html));
  assert.equal(assessment.shouldFallback, false);
});

test("assessReadableContent flags navigation-heavy JS docs shells", () => {
  const html = `
    <html>
      <head>
        <script>window.__NEXT_DATA__ = {};</script>
        <meta name="generator" content="mintlify" />
      </head>
      <body>
        <nav>
          ${Array.from({ length: 80 }, (_, index) => `<a href="/docs/${index}">Doc ${index}</a>`).join("")}
        </nav>
        <div id="__next"></div>
        <script>window.__NEXT_DATA__ = {"page":"/docs"};</script>
        <script>window.__NEXT_DATA__ = {"page":"/docs"};</script>
        <script>window.__NEXT_DATA__ = {"page":"/docs"};</script>
        <script>window.__NEXT_DATA__ = {"page":"/docs"};</script>
      </body>
    </html>
  `;

  const assessment = assessReadableContent(html, htmlToText(html));
  assert.equal(assessment.shouldFallback, true);
  assert.match(assessment.reason ?? "", /shell|navigation-heavy|JS-rendered/i);
});

test("assessReadableContent flags docs ui chrome markers", () => {
  const html = `
    <html>
      <body>
        <main>
          <article>
            <h1>Stealth Mode</h1>
            <p>OpenAI Open in ChatGPT</p>
            <p>Copy Ask AI</p>
            <p>Core documentation body text.</p>
          </article>
        </main>
      </body>
    </html>
  `;

  const assessment = assessReadableContent(html, htmlToText(html));
  assert.equal(assessment.shouldFallback, true);
  assert.match(assessment.reason ?? "", /docs ui chrome/i);
});
