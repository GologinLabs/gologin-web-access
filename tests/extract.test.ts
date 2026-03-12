import test from "node:test";
import assert from "node:assert/strict";

import { extractWithSchema } from "../src/lib/extract";

test("extractWithSchema supports text, attr, arrays, and nested fields", () => {
  const html = `
    <article class="card">
      <h1>Example title</h1>
      <a class="primary" href="/docs">Docs</a>
      <ul>
        <li data-id="a">Alpha</li>
        <li data-id="b">Beta</li>
      </ul>
      <section class="author">
        <span class="name">Eugene</span>
      </section>
    </article>
  `;

  const extracted = extractWithSchema(html, {
    title: "h1",
    link: {
      selector: "a.primary",
      type: "attr",
      attribute: "href"
    },
    items: {
      selector: "li",
      all: true
    },
    author: {
      selector: ".author",
      fields: {
        name: ".name"
      }
    }
  });

  assert.deepEqual(extracted, {
    title: "Example title",
    link: "/docs",
    items: ["Alpha", "Beta"],
    author: {
      name: "Eugene"
    }
  });
});
