export class CliError extends Error {
  public readonly exitCode: number;
  public readonly hint?: string;

  public constructor(message: string, exitCode = 1, hint?: string) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
    this.hint = hint;
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

export function toCliError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof Error) {
    return new CliError(error.message);
  }

  return new CliError("Unknown error.");
}
