import type { ResolvedConfig } from "./types";
import type { ExtractSchema } from "./extract";
import { extractWithSchema } from "./extract";
import { normalizeReadSourceMode, readRenderedHtmlContent, type ReadSourceMode } from "./readSource";
import type { ScrapeRequestOptions } from "./unlocker";

export interface ExtractUrlResult {
  url: string;
  renderSource: "unlocker" | "browser";
  fallbackAttempted: boolean;
  fallbackUsed: boolean;
  fallbackReason?: string;
  request?: unknown;
  extracted: Record<string, unknown>;
}

export async function extractUrlWithSchema(
  url: string,
  config: ResolvedConfig,
  apiKey: string,
  schema: ExtractSchema,
  options: {
    source?: ReadSourceMode;
    request?: ScrapeRequestOptions;
    profile?: string;
  } = {},
): Promise<ExtractUrlResult> {
  const source = normalizeReadSourceMode(options.source, "auto");
  const rendered = await readRenderedHtmlContent(url, config, apiKey, {
    source,
    request: options.request,
    profile: options.profile,
  });

  return {
    url,
    renderSource: rendered.renderSource,
    fallbackAttempted: rendered.fallbackAttempted,
    fallbackUsed: rendered.fallbackUsed,
    fallbackReason: rendered.fallbackReason,
    request: rendered.request,
    extracted: extractWithSchema(rendered.html, schema),
  };
}
