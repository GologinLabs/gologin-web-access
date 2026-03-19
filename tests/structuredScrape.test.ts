import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStructuredFallbackAdvisory,
  detectStructuredBlockReason,
  shouldUseBrowserFallback,
} from "../src/lib/structuredScrape";
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

test("shouldUseBrowserFallback flags structured outputs without h1", () => {
  assert.equal(shouldUseBrowserFallback(makeData()), true);
});

test("buildStructuredFallbackAdvisory recommends browser for incomplete structured output", () => {
  const advisory = buildStructuredFallbackAdvisory(makeData());
  assert.equal(advisory.browserRecommended, true);
  assert.match(advisory.warning ?? "", /client-rendered|fallback browser|rendered DOM/i);
});

test("buildStructuredFallbackAdvisory stays quiet for healthy structured output", () => {
  const advisory = buildStructuredFallbackAdvisory(
    makeData({
      headings: ["Working title"],
      headingsByLevel: {
        h1: ["Working title"],
        h2: ["Section"],
        h3: [],
        h4: [],
        h5: [],
        h6: [],
      },
    })
  );
  assert.equal(advisory.browserRecommended, false);
  assert.equal(advisory.warning, undefined);
});

test("detectStructuredBlockReason flags challenge pages", () => {
  const reason = detectStructuredBlockReason(
    makeData({
      title: "Just a moment...",
      headings: ["Verify you are human"],
      headingsByLevel: {
        h1: ["Verify you are human"],
        h2: [],
        h3: [],
        h4: [],
        h5: [],
        h6: [],
      },
    }),
  );

  assert.match(reason ?? "", /challenge|blocked/i);
});

test("buildStructuredFallbackAdvisory explains blocked structured output", () => {
  const advisory = buildStructuredFallbackAdvisory(
    makeData({
      title: "Access denied",
      headings: ["Access denied"],
      headingsByLevel: {
        h1: ["Access denied"],
        h2: [],
        h3: [],
        h4: [],
        h5: [],
        h6: [],
      },
    }),
  );

  assert.equal(advisory.browserRecommended, true);
  assert.match(advisory.warning ?? "", /blocked|challenge/i);
});
