import { randomUUID } from "crypto";
import { resolveProfileId } from "../config";
import { runAgentCommandCapture } from "./agentCli";
import { createBrowserCommandError } from "./errors";
import type { ResolvedConfig } from "./types";
import type { ScrapeJsonData } from "./unlocker";

const MAX_HEADINGS = 50;
const MAX_LINKS = 100;

export async function scrapeJsonViaBrowser(
  url: string,
  config: ResolvedConfig,
  options: { profile?: string } = {},
): Promise<ScrapeJsonData> {
  const sessionId = `structured-${randomUUID().slice(0, 8)}`;
  const openArgs = ["open", url, "--session", sessionId];
  const profileId = resolveProfileId(config, options.profile);

  if (profileId) {
    openArgs.push("--profile", profileId);
  }

  const open = await runAgentCommandCapture(openArgs, config);
  ensureBrowserCommandOk("open", open, url);

  try {
    const evaluated = await runAgentCommandCapture(
      ["eval", buildStructuredExtractionExpression(), "--json", "--session", sessionId],
      config,
    );
    ensureBrowserCommandOk("eval", evaluated, url);
    return JSON.parse(evaluated.stdout.trim()) as ScrapeJsonData;
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
  throw createBrowserCommandError(step, url, message);
}

function buildStructuredExtractionExpression(): string {
  return `(() => {
    const meta = {};
    for (const node of Array.from(document.querySelectorAll("meta[name], meta[property]"))) {
      const name = node.getAttribute("name") || node.getAttribute("property");
      const content = node.getAttribute("content");
      if (!name || !content) continue;
      meta[name] = content.trim();
    }

    const headingsByLevel = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };
    const headings = [];
    for (const node of Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).slice(0, ${MAX_HEADINGS})) {
      const text = (node.textContent || "").replace(/\\s+/g, " ").trim();
      if (!text) continue;
      const level = node.tagName.toLowerCase();
      if (headingsByLevel[level]) {
        headingsByLevel[level].push(text);
      }
      headings.push(text);
    }

    const links = [];
    for (const node of Array.from(document.querySelectorAll("a[href]")).slice(0, ${MAX_LINKS})) {
      const href = (node.href || node.getAttribute("href") || "").trim();
      if (!href) continue;
      const text = (node.textContent || "").replace(/\\s+/g, " ").trim();
      links.push({ href, text });
    }

    const canonicalHref = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || null;

    return {
      title: document.title || null,
      description: meta.description || meta["og:description"] || null,
      canonical: canonicalHref,
      meta,
      headings,
      headingsByLevel,
      links
    };
  })()`;
}
