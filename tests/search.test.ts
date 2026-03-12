import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSearchAttemptPlan,
  buildSearchUrl,
  parseBingSearchResults,
  parseDuckDuckGoSearchResults,
  parseGoogleSearchResults,
} from "../src/lib/search";

test("buildSearchAttemptPlan prefers unlocker first and browser fallback last", () => {
  assert.deepEqual(buildSearchAttemptPlan("auto", true), [
    { engine: "google", source: "unlocker" },
    { engine: "duckduckgo", source: "unlocker" },
    { engine: "bing", source: "unlocker" },
    { engine: "bing", source: "browser" },
  ]);
  assert.deepEqual(buildSearchAttemptPlan("browser", false), []);
});

test("buildSearchUrl produces google and bing search urls", () => {
  const google = buildSearchUrl("google", "gologin antidetect", {
    limit: 5,
    country: "us",
    language: "en",
  });
  const bing = buildSearchUrl("bing", "gologin antidetect", {
    limit: 5,
    country: "us",
    language: "en",
  });
  const duckduckgo = buildSearchUrl("duckduckgo", "gologin antidetect", {
    limit: 5,
    country: "us",
    language: "en",
  });

  assert.match(google, /google\.com\/search/);
  assert.match(google, /q=gologin\+antidetect/);
  assert.match(bing, /bing\.com\/search/);
  assert.match(bing, /q=gologin\+antidetect/);
  assert.match(duckduckgo, /duckduckgo\.com\/html/);
});

test("parseGoogleSearchResults extracts result items from html", () => {
  const html = `
    <a href="/url?q=https%3A%2F%2Fgologin.com%2F&amp;sa=U&amp;ved=2ah">
      <h3>GoLogin official site</h3>
    </a>
    <div class="VwiC3b">Manage multiple accounts safely.</div>
  `;

  assert.deepEqual(parseGoogleSearchResults(html, 5), [
    {
      title: "GoLogin official site",
      url: "https://gologin.com/",
      snippet: "Manage multiple accounts safely.",
      host: "gologin.com",
    },
  ]);
});

test("parseBingSearchResults extracts result items from html", () => {
  const html = `
    <li class="b_algo">
      <h2><a href="https://www.bing.com/ck/a?!&&u=a1aHR0cHM6Ly9nb2xvZ2luLmNvbS8">GoLogin</a></h2>
      <div class="b_caption"><p>Manage multiple accounts safely.</p></div>
    </li>
  `;

  assert.deepEqual(parseBingSearchResults(html, 5), [
    {
      title: "GoLogin",
      url: "https://gologin.com/",
      snippet: "Manage multiple accounts safely.",
      host: "gologin.com",
    },
  ]);
});

test("parseDuckDuckGoSearchResults extracts result items from html", () => {
  const html = `
    <div class="result">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgologin.com%2F">GoLogin</a>
      <a class="result__snippet">Manage multiple accounts safely.</a>
    </div>
  `;

  assert.deepEqual(parseDuckDuckGoSearchResults(html, 5), [
    {
      title: "GoLogin",
      url: "https://gologin.com/",
      snippet: "Manage multiple accounts safely.",
      host: "gologin.com",
    },
  ]);
});
