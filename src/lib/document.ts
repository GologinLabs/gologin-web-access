import { promises as fs } from "fs";
import path from "path";

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

import { htmlToText } from "./unlocker";

export interface ParsedDocument {
  source: string;
  kind: string;
  text: string;
  metadata: Record<string, unknown>;
}

export async function parseDocumentSource(source: string): Promise<ParsedDocument> {
  const loaded = await loadSource(source);
  const kind = detectDocumentKind(source, loaded.contentType);

  switch (kind) {
    case "pdf": {
      const parser = new PDFParse({ data: loaded.buffer });
      try {
        const parsed = await parser.getText();
        const info = await parser.getInfo().catch(() => undefined);
        return {
          source,
          kind,
          text: parsed.text.trim(),
          metadata: {
            pages: parsed.total,
            info: info?.info ?? {}
          }
        };
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    }
    case "docx": {
      const parsed = await mammoth.extractRawText({ buffer: loaded.buffer });
      return {
        source,
        kind,
        text: parsed.value.trim(),
        metadata: {
          messages: parsed.messages
        }
      };
    }
    case "xlsx": {
      const workbook = XLSX.read(loaded.buffer, { type: "buffer" });
      const parts = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(sheet, {
          header: 1,
          raw: false
        });
        const body = rows.map((row) => row.map((cell) => (cell ?? "").toString()).join("\t")).join("\n").trim();
        return `# ${sheetName}\n${body}`.trim();
      }).filter(Boolean);

      return {
        source,
        kind,
        text: parts.join("\n\n").trim(),
        metadata: {
          sheets: workbook.SheetNames
        }
      };
    }
    case "html": {
      const raw = loaded.buffer.toString("utf8");
      return {
        source,
        kind,
        text: htmlToText(raw),
        metadata: {}
      };
    }
    default: {
      return {
        source,
        kind,
        text: loaded.buffer.toString("utf8").trim(),
        metadata: {}
      };
    }
  }
}

async function loadSource(source: string): Promise<{ buffer: Buffer; contentType?: string | null }> {
  if (looksLikeUrl(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${source}: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      buffer,
      contentType: response.headers.get("content-type")
    };
  }

  return {
    buffer: await fs.readFile(path.resolve(source))
  };
}

function looksLikeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function detectDocumentKind(source: string, contentType?: string | null): string {
  const lowerContentType = contentType?.toLowerCase() ?? "";
  const lowerSource = source.toLowerCase();

  if (lowerContentType.includes("pdf") || lowerSource.endsWith(".pdf")) {
    return "pdf";
  }
  if (
    lowerContentType.includes("wordprocessingml.document") ||
    lowerContentType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document") ||
    lowerSource.endsWith(".docx")
  ) {
    return "docx";
  }
  if (
    lowerContentType.includes("spreadsheetml.sheet") ||
    lowerContentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ||
    lowerSource.endsWith(".xlsx")
  ) {
    return "xlsx";
  }
  if (lowerContentType.includes("html") || lowerSource.endsWith(".html") || lowerSource.endsWith(".htm")) {
    return "html";
  }
  if (lowerSource.endsWith(".md")) {
    return "markdown";
  }
  if (lowerSource.endsWith(".json")) {
    return "json";
  }
  return "text";
}
