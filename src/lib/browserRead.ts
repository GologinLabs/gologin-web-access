import { randomUUID } from "crypto";
import { resolveProfileId } from "../config";
import { runAgentCommandCapture } from "./agentCli";
import { CliError } from "./errors";
import type { ResolvedConfig } from "./types";

export interface BrowserReadableContent {
  html: string;
  text: string;
  selector: string;
}

export async function scrapeReadableContentViaBrowser(
  url: string,
  config: ResolvedConfig,
  options: { profile?: string } = {},
): Promise<BrowserReadableContent> {
  return withBrowserSession(url, config, options, async (sessionId) => {
    const evaluated = await runAgentCommandCapture(
      ["eval", buildReadableExtractionExpression(), "--json", "--session", sessionId],
      config,
    );
    ensureBrowserCommandOk("eval", evaluated, url);
    return JSON.parse(evaluated.stdout.trim()) as BrowserReadableContent;
  });
}

export async function scrapeRenderedHtmlViaBrowser(
  url: string,
  config: ResolvedConfig,
  options: { profile?: string } = {},
): Promise<{ html: string }> {
  return withBrowserSession(url, config, options, async (sessionId) => {
    const evaluated = await runAgentCommandCapture(
      ["eval", "document.documentElement?.outerHTML || ''", "--json", "--session", sessionId],
      config,
    );
    ensureBrowserCommandOk("eval", evaluated, url);
    return {
      html: JSON.parse(evaluated.stdout.trim()) as string,
    };
  });
}

async function withBrowserSession<T>(
  url: string,
  config: ResolvedConfig,
  options: { profile?: string },
  handler: (sessionId: string) => Promise<T>,
): Promise<T> {
  const sessionId = `read-${randomUUID().slice(0, 8)}`;
  const openArgs = ["open", url, "--session", sessionId];
  const profileId = resolveProfileId(config, options.profile);

  if (profileId) {
    openArgs.push("--profile", profileId);
  }

  const open = await runAgentCommandCapture(openArgs, config);
  ensureBrowserCommandOk("open", open, url);

  try {
    return await handler(sessionId);
  } finally {
    await runAgentCommandCapture(["close", "--session", sessionId], config).catch(() => undefined);
  }
}

function ensureBrowserCommandOk(
  step: string,
  response: { exitCode: number; stdout: string; stderr: string },
  url: string,
): void {
  if (response.exitCode === 0) {
    return;
  }

  const message = response.stderr.trim() || response.stdout.trim() || `Browser command failed for ${url}`;
  throw new CliError(`Browser read ${step} failed.`, 1, message);
}

function buildReadableExtractionExpression(): string {
  return `(() => {
    const candidates = [
      ["#content-area", document.querySelector("#content-area")],
      ["main article", document.querySelector("main article")],
      ["article", document.querySelector("article")],
      ["main .prose", document.querySelector("main .prose")],
      ["main", document.querySelector("main")],
      ["[role='main']", document.querySelector("[role='main']")],
      [".mintlify-content", document.querySelector(".mintlify-content")],
      [".docs-content", document.querySelector(".docs-content")],
      [".content", document.querySelector(".content")],
      [".prose", document.querySelector(".prose")],
      ["body", document.body],
    ];

    function normalizeText(value) {
      return (value || "").replace(/\\s+/g, " ").trim();
    }

    function scoreNode(node, selector) {
      if (!node) return { score: -Infinity, text: "" };
      const text = normalizeText(node.innerText);
      if (!text) return { score: -Infinity, text: "" };
      const headings = node.querySelectorAll("h1, h2, h3").length;
      const paragraphs = node.querySelectorAll("p, li").length;
      const codeBlocks = node.querySelectorAll("pre, code").length;
      const links = node.querySelectorAll("a[href]").length;
      let score = Math.min(text.length, 12000) + headings * 180 + paragraphs * 120 + codeBlocks * 80 - links * 8;
      if (/^(#content-area|article|main|\\[role='main'\\])/.test(selector)) {
        score += 400;
      }
      return { score, text };
    }

    for (const [selector, node] of candidates) {
      if (!node) continue;
      const scored = scoreNode(node, selector);
      const headings = node.querySelectorAll("h1, h2, h3").length;
      const paragraphs = node.querySelectorAll("p, li").length;
      if (selector !== "body" && scored.text.length >= 600 && (headings >= 1 || paragraphs >= 3)) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll("script, style, nav, aside, form, button, svg, dialog, [role='button'], [aria-label='More actions'], .sr-only").forEach((element) => element.remove());
        return {
          selector,
          html: clone.outerHTML || "",
          text: normalizeText(clone.innerText),
        };
      }
    }

    const seen = new Set();
    let best = { selector: "body", node: document.body, html: document.body?.outerHTML || "", text: normalizeText(document.body?.innerText), score: -Infinity };

    for (const [selector, node] of candidates) {
      if (!node || seen.has(node)) continue;
      seen.add(node);
      const scored = scoreNode(node, selector);
      if (scored.score > best.score) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll("script, style, nav, aside, form, button, svg, dialog, [role='button'], [aria-label='More actions'], .sr-only").forEach((element) => element.remove());
        best = {
          selector,
          node,
          html: clone.outerHTML || "",
          text: normalizeText(clone.innerText),
          score: scored.score,
        };
      }
    }

    return {
      selector: best.selector,
      html: best.html,
      text: best.text,
    };
  })()`;
}
