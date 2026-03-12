import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { createPatch } from "diff";

import { ResolvedConfig, ScrapeFormat } from "./types";

export interface TrackedSnapshot {
  key: string;
  url: string;
  format: ScrapeFormat;
  title?: string;
  content: string;
  hash: string;
  updatedAt: string;
}

export interface ChangeTrackingResult {
  key: string;
  url: string;
  format: ScrapeFormat;
  status: "new" | "same" | "changed";
  previousHash?: string;
  currentHash: string;
  updatedAt: string;
  diff?: string;
}

export function buildTrackingKey(url: string, explicitKey?: string): string {
  return (explicitKey ?? url)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export async function compareAndPersistSnapshot(
  config: ResolvedConfig,
  snapshot: Omit<TrackedSnapshot, "hash" | "updatedAt">
): Promise<ChangeTrackingResult> {
  await fs.mkdir(config.trackingDir, { recursive: true });
  const next: TrackedSnapshot = {
    ...snapshot,
    hash: sha256(snapshot.content),
    updatedAt: new Date().toISOString()
  };

  const previous = await readTrackedSnapshot(config, snapshot.key);
  await fs.writeFile(trackingPath(config, snapshot.key), `${JSON.stringify(next, null, 2)}\n`, "utf8");

  if (!previous) {
    return {
      key: next.key,
      url: next.url,
      format: next.format,
      status: "new",
      currentHash: next.hash,
      updatedAt: next.updatedAt
    };
  }

  if (previous.hash === next.hash) {
    return {
      key: next.key,
      url: next.url,
      format: next.format,
      status: "same",
      previousHash: previous.hash,
      currentHash: next.hash,
      updatedAt: next.updatedAt
    };
  }

  return {
    key: next.key,
    url: next.url,
    format: next.format,
    status: "changed",
    previousHash: previous.hash,
    currentHash: next.hash,
    updatedAt: next.updatedAt,
    diff: createPatch(next.key, previous.content, next.content, previous.updatedAt, next.updatedAt)
  };
}

function trackingPath(config: ResolvedConfig, key: string): string {
  return path.join(config.trackingDir, `${key}.json`);
}

async function readTrackedSnapshot(config: ResolvedConfig, key: string): Promise<TrackedSnapshot | undefined> {
  try {
    const raw = await fs.readFile(trackingPath(config, key), "utf8");
    return JSON.parse(raw) as TrackedSnapshot;
  } catch {
    return undefined;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
