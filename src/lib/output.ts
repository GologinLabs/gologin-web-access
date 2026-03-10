import { CliError } from "./errors";
import { BrowserSnapshot, BrowserSessionSummary, DoctorCheck, SnapshotElement } from "./types";

function write(stream: NodeJS.WriteStream, value: string): void {
  stream.write(value.endsWith("\n") ? value : `${value}\n`);
}

export function printText(value: string): void {
  write(process.stdout, value);
}

export function printJson(value: unknown): void {
  printText(JSON.stringify(value, null, 2));
}

export function printError(error: CliError): void {
  if (error.message) {
    write(process.stderr, error.message);
  }
  if (error.hint) {
    write(process.stderr, error.hint);
  }
}

export function maskSecret(value?: string): string {
  if (!value) {
    return "missing";
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}...`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function printKeyValueRows(rows: Array<{ label: string; value: string }>): void {
  const width = rows.reduce((max, row) => Math.max(max, row.label.length), 0);
  const lines = rows.map((row) => `${row.label.padEnd(width)}: ${row.value}`);
  printText(lines.join("\n"));
}

export function formatDoctorChecks(checks: DoctorCheck[]): string {
  return checks
    .map((check) => `${check.name}: ${statusLabel(check.status)}${check.detail ? ` - ${check.detail}` : ""}`)
    .join("\n");
}

export function formatSessionSummary(session: BrowserSessionSummary): string {
  return [
    `Session: ${session.id}`,
    `URL: ${session.url}`,
    `Title: ${session.title || "(untitled)"}`,
    `Profile: ${session.profileId ?? "ephemeral"}`,
    `Created: ${session.createdAt}`,
    `Updated: ${session.updatedAt}`,
    `Current: ${session.current ? "yes" : "no"}`,
  ].join("\n");
}

export function formatSessions(sessions: BrowserSessionSummary[]): string {
  if (sessions.length === 0) {
    return "No active sessions.";
  }

  return sessions
    .map((session) => {
      const current = session.current ? "*" : " ";
      return `${current} ${session.id}  ${session.title || "(untitled)"}  ${session.url}`;
    })
    .join("\n");
}

export function formatSnapshot(snapshot: BrowserSnapshot): string {
  const lines = [
    `Session: ${snapshot.sessionId}`,
    `URL: ${snapshot.url}`,
    `Title: ${snapshot.title || "(untitled)"}`,
    `Captured: ${snapshot.capturedAt}`,
    "",
    "Elements:",
  ];

  if (snapshot.elements.length === 0) {
    lines.push("(none)");
    return lines.join("\n");
  }

  lines.push(...snapshot.elements.map(formatSnapshotElement));
  return lines.join("\n");
}

function formatSnapshotElement(element: SnapshotElement): string {
  const parts = [`[${element.ref}]`, element.tag];

  if (element.role) {
    parts.push(`role=${element.role}`);
  }

  if (element.type) {
    parts.push(`type=${element.type}`);
  }

  const label = element.label || element.text || element.placeholder;
  if (label) {
    parts.push(`"${truncate(label, 80)}"`);
  }

  if (element.href) {
    parts.push(`-> ${element.href}`);
  }

  return parts.join(" ");
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function statusLabel(status: DoctorCheck["status"]): string {
  switch (status) {
    case "ok":
      return "OK";
    case "warn":
      return "WARN";
    case "error":
      return "ERROR";
    case "info":
      return "INFO";
    default:
      return status;
  }
}
