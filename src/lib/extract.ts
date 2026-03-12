import { load } from "cheerio";

export type ExtractPrimitiveMode = "text" | "html" | "attr" | "exists";

export type ExtractFieldSchema =
  | string
  | {
      selector: string;
      type?: ExtractPrimitiveMode;
      attribute?: string;
      all?: boolean;
      trim?: boolean;
      fields?: Record<string, ExtractFieldSchema>;
    };

export type ExtractSchema = Record<string, ExtractFieldSchema>;

export function extractWithSchema(html: string, schema: ExtractSchema): Record<string, unknown> {
  const root = load(html);
  return extractRecord(root.root(), root, schema);
}

function extractRecord(
  scope: ReturnType<ReturnType<typeof load>["root"]> | ReturnType<ReturnType<typeof load>>,
  $: ReturnType<typeof load>,
  schema: ExtractSchema
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(schema).map(([key, field]) => [key, extractField(scope, $, field)])
  );
}

function normalizeFieldSchema(field: ExtractFieldSchema): Exclude<ExtractFieldSchema, string> {
  if (typeof field === "string") {
    return {
      selector: field,
      type: "text",
      trim: true
    };
  }

  return {
    type: "text",
    trim: true,
    ...field
  };
}

function extractField(
  scope: ReturnType<ReturnType<typeof load>["root"]> | ReturnType<ReturnType<typeof load>>,
  $: ReturnType<typeof load>,
  field: ExtractFieldSchema
): unknown {
  const normalized = normalizeFieldSchema(field);
  const matches = scope.find(normalized.selector);

  if (normalized.all) {
    return matches
      .toArray()
      .map((element) => extractElement($(element), $, normalized))
      .filter((value) => value !== undefined);
  }

  const element = matches.first();
  if (element.length === 0) {
    return undefined;
  }

  return extractElement(element, $, normalized);
}

function extractElement(
  element: ReturnType<ReturnType<typeof load>["root"]> | ReturnType<ReturnType<typeof load>>,
  $: ReturnType<typeof load>,
  field: Exclude<ExtractFieldSchema, string>
): unknown {
  if (field.fields) {
    return extractRecord(element, $, field.fields);
  }

  switch (field.type) {
    case "html":
      return normalizeOutput(element.html(), field.trim);
    case "attr":
      if (!field.attribute) {
        return undefined;
      }
      return normalizeOutput(element.attr(field.attribute), field.trim);
    case "exists":
      return element.length > 0;
    case "text":
    default:
      return normalizeOutput(element.text(), field.trim);
  }
}

function normalizeOutput(value: string | undefined | null, trim = true): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return trim ? value.trim() : value;
}
