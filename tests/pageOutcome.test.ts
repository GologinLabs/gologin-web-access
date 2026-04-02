import assert from "node:assert/strict";
import test from "node:test";

import { assessReadablePageOutcome, assessStructuredPageOutcome, describeNextActionHint } from "../src/lib/pageOutcome";
import type { ScrapeJsonData } from "../src/lib/unlocker";

function makeData(overrides: Partial<ScrapeJsonData> = {}): ScrapeJsonData {
  return {
    title: "Example",
    description: null,
    canonical: null,
    meta: {},
    headings: [],
    headingsByLevel: {
      h1: [],
      h2: [],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
    },
    links: [],
    ...overrides,
  };
}

test("assessStructuredPageOutcome classifies authwall-like structured pages", () => {
  const assessment = assessStructuredPageOutcome(
    makeData({
      title: "Sign Up | LinkedIn",
      canonical: "/authwall",
      headings: ["Join LinkedIn"],
      headingsByLevel: {
        h1: ["Join LinkedIn"],
        h2: [],
        h3: [],
        h4: [],
        h5: [],
        h6: [],
      },
    }),
  );

  assert.equal(assessment.outcome, "authwall");
  assert.equal(assessment.nextActionHint, "use_logged_in_session");
});

test("assessStructuredPageOutcome classifies empty structured payloads", () => {
  const assessment = assessStructuredPageOutcome(
    makeData({
      title: null,
      description: null,
      canonical: null,
    }),
  );

  assert.equal(assessment.outcome, "empty");
  assert.equal(assessment.nextActionHint, "retry_with_browser");
});

test("assessReadablePageOutcome classifies authwall pages", () => {
  const html = `
    <html>
      <head>
        <title>Sign Up | LinkedIn</title>
        <link rel="canonical" href="/authwall" />
      </head>
      <body>
        <main>
          <h1>Join LinkedIn</h1>
          <p>Sign in to view more profiles.</p>
          <form><input type="email" /></form>
        </main>
      </body>
    </html>
  `;

  const assessment = assessReadablePageOutcome(html, "Join LinkedIn Sign in to view more profiles.");
  assert.equal(assessment.outcome, "authwall");
  assert.equal(assessment.nextActionHint, "use_logged_in_session");
});

test("assessReadablePageOutcome classifies challenge pages", () => {
  const html = `
    <html>
      <head><title>Security verification</title></head>
      <body><main><h1>Verify you are human</h1></main></body>
    </html>
  `;

  const assessment = assessReadablePageOutcome(html, "Security verification Verify you are human");
  assert.equal(assessment.outcome, "challenge");
});

test("describeNextActionHint returns actionable text", () => {
  assert.match(describeNextActionHint("retry_with_browser") ?? "", /browser/i);
  assert.match(describeNextActionHint("use_logged_in_session") ?? "", /logged-in browser session/i);
});
