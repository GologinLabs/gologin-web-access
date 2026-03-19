export class CliError extends Error {
  public readonly exitCode: number;
  public readonly hint?: string;
  public readonly code?: string;

  public constructor(message: string, exitCode = 1, hint?: string, code?: string) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
    this.hint = hint;
    this.code = code;
  }
}

export class SilentExitError extends CliError {
  public constructor(exitCode = 1) {
    super("", exitCode);
  }
}

export class MissingCredentialError extends CliError {
  public constructor(envName: string, commandGroup: string) {
    super(
      `Missing ${envName}. This is required for ${commandGroup}.`,
      1,
      [
        "This CLI only reads credentials from environment variables or ~/.gologin-web-access/config.json.",
        "Recommended setup: configure both GOLOGIN_WEB_UNLOCKER_API_KEY and GOLOGIN_TOKEN up front so agents do not stop to ask again.",
        `Set ${envName} in your environment or add it to ~/.gologin-web-access/config.json.`,
        "Helpful commands: gologin-web-access config init, gologin-web-access config show, gologin-web-access doctor.",
      ].join("\n"),
    );
  }
}

export class HttpError extends CliError {
  public readonly status: number;

  public constructor(message: string, status: number, hint?: string) {
    super(message, 1, hint);
    this.status = status;
  }
}

export class DaemonError extends CliError {
  public constructor(message: string, hint?: string) {
    super(message, 1, hint);
  }
}

export function createBrowserCommandError(
  step: string,
  url: string,
  rawMessage: string,
): CliError {
  const normalized = rawMessage.trim() || `Browser command failed for ${url}`;

  if (/max parallel cloud launches limit/i.test(normalized)) {
    return new CliError(
      `Cloud Browser ${step} failed: max parallel cloud launches limit reached.`,
      1,
      [
        "Close stale cloud sessions, run sessions --prune, or switch to gologin-local-agent-browser if the task can run locally.",
        normalized,
      ].join("\n"),
      "CLOUD_SLOT_EXHAUSTED",
    );
  }

  if (/BROWSER_CONNECTION_FAILED|connect ECONNREFUSED|connection failed/i.test(normalized)) {
    return new CliError(
      `Cloud Browser ${step} failed: browser connection could not be established.`,
      1,
      normalized,
      "BROWSER_CONNECTION_FAILED",
    );
  }

  if (/(^|\D)403(\D|$)/.test(normalized)) {
    return new CliError(
      `Cloud Browser ${step} failed with 403.`,
      1,
      [
        "Cloud Browser rejected the session. This can mean missing access, plan restrictions, or stale backend state.",
        normalized,
      ].join("\n"),
      "CLOUD_BROWSER_403",
    );
  }

  if (/(^|\D)503(\D|$)/.test(normalized)) {
    return new CliError(
      `Cloud Browser ${step} failed with 503.`,
      1,
      [
        "Cloud Browser is temporarily unavailable or overloaded. Retry shortly or switch to a local GoLogin profile if the task can run locally.",
        normalized,
      ].join("\n"),
      "CLOUD_BROWSER_503",
    );
  }

  return new CliError(
    `Cloud Browser ${step} failed for ${url}.`,
    1,
    normalized,
    "CLOUD_BROWSER_FAILED",
  );
}

export function toCliError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof Error) {
    return new CliError(error.message);
  }

  return new CliError("Unknown error.");
}
