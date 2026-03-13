import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { MissingCredentialError } from "./lib/errors";
import { maskSecret } from "./lib/output";
import { ConfigSource, ResolvedConfig, StoredConfig } from "./lib/types";

const CONFIG_DIR = ".gologin-web-access";
const LEGACY_CONFIG_DIR = ".gologin-web";
const CONFIG_FILENAME = "config.json";

export const DEFAULT_DAEMON_PORT = 4590;
export const ENV_NAMES = {
  webUnlockerApiKey: "GOLOGIN_WEB_UNLOCKER_API_KEY",
  cloudToken: "GOLOGIN_CLOUD_TOKEN",
  defaultProfileId: "GOLOGIN_DEFAULT_PROFILE_ID",
  daemonPort: "GOLOGIN_DAEMON_PORT",
} as const;

const LEGACY_ENV_NAMES = {
  webUnlockerApiKey: ["GOLOGIN_WEBUNLOCKER_API_KEY"],
  cloudToken: ["GOLOGIN_TOKEN"],
  defaultProfileId: ["GOLOGIN_PROFILE_ID"],
  daemonPort: [],
} as const;

export function getDefaultConfigPath(): string {
  return path.join(os.homedir(), CONFIG_DIR, CONFIG_FILENAME);
}

export async function loadConfig(): Promise<ResolvedConfig> {
  const configPath = await resolveConfigPath();
  const stateDir = path.dirname(configPath);
  const fileConfig = await readConfigFile(configPath);
  const webUnlockerEnv = firstEnvValue(ENV_NAMES.webUnlockerApiKey, LEGACY_ENV_NAMES.webUnlockerApiKey);
  const cloudTokenEnv = firstEnvValue(ENV_NAMES.cloudToken, LEGACY_ENV_NAMES.cloudToken);
  const profileEnv = firstEnvValue(ENV_NAMES.defaultProfileId, LEGACY_ENV_NAMES.defaultProfileId);
  const daemonPortEnv = firstEnvValue(ENV_NAMES.daemonPort, LEGACY_ENV_NAMES.daemonPort);

  const webUnlockerApiKey = pickString(webUnlockerEnv, fileConfig.webUnlockerApiKey);
  const cloudToken = pickString(cloudTokenEnv, fileConfig.cloudToken);
  const defaultProfileId = pickString(profileEnv, fileConfig.defaultProfileId);
  const daemonPort = pickNumber(daemonPortEnv, fileConfig.daemonPort, DEFAULT_DAEMON_PORT);

  return {
    configPath,
    stateDir,
    jobsDir: path.join(stateDir, "jobs"),
    trackingDir: path.join(stateDir, "tracking"),
    artifactsDir: path.join(stateDir, "artifacts"),
    webUnlockerApiKey,
    cloudToken,
    defaultProfileId,
    daemonPort,
    sources: {
      webUnlockerApiKey: resolveSource(webUnlockerEnv, fileConfig.webUnlockerApiKey),
      cloudToken: resolveSource(cloudTokenEnv, fileConfig.cloudToken),
      defaultProfileId: resolveSource(profileEnv, fileConfig.defaultProfileId),
      daemonPort: resolveNumberSource(daemonPortEnv, fileConfig.daemonPort),
    },
  };
}

export async function initConfigFile(
  overrides: Partial<StoredConfig>,
  options: { force?: boolean } = {},
): Promise<{ path: string; config: StoredConfig; created: boolean }> {
  const configPath = getDefaultConfigPath();
  const directory = path.dirname(configPath);

  await fs.mkdir(directory, { recursive: true });

  const fileExists = await exists(configPath);
  if (fileExists && !options.force) {
    const existing = await readConfigFile(configPath);
    return {
      path: configPath,
      config: existing,
      created: false,
    };
  }

  const nextConfig: StoredConfig = {
    webUnlockerApiKey: overrides.webUnlockerApiKey,
    cloudToken: overrides.cloudToken,
    defaultProfileId: overrides.defaultProfileId,
    daemonPort: overrides.daemonPort ?? DEFAULT_DAEMON_PORT,
  };

  await fs.writeFile(configPath, JSON.stringify(nextConfig, null, 2) + "\n", "utf8");

  return {
    path: configPath,
    config: nextConfig,
    created: true,
  };
}

export function requireWebUnlockerKey(config: ResolvedConfig): string {
  if (!config.webUnlockerApiKey) {
    throw new MissingCredentialError(
      ENV_NAMES.webUnlockerApiKey,
      "scraping commands like `gologin-web-access scrape`",
    );
  }

  return config.webUnlockerApiKey;
}

export function requireCloudToken(config: ResolvedConfig): string {
  if (!config.cloudToken) {
    throw new MissingCredentialError(
      ENV_NAMES.cloudToken,
      "browser commands like `gologin-web-access open`",
    );
  }

  return config.cloudToken;
}

export function resolveProfileId(config: ResolvedConfig, explicitProfileId?: string): string | undefined {
  return explicitProfileId || config.defaultProfileId;
}

export function getRecommendedCredentialStatus(config: ResolvedConfig): {
  ready: boolean;
  missing: string[];
  detail: string;
} {
  const missing: string[] = [];

  if (!config.webUnlockerApiKey) {
    missing.push(ENV_NAMES.webUnlockerApiKey);
  }

  if (!config.cloudToken) {
    missing.push(ENV_NAMES.cloudToken);
  }

  if (missing.length === 0) {
    return {
      ready: true,
      missing,
      detail: "complete (Web Unlocker + Cloud Browser configured)",
    };
  }

  return {
    ready: false,
    missing,
    detail: `incomplete - missing ${missing.join(" and ")}`,
  };
}

export function getMaskedConfigRows(config: ResolvedConfig): Array<{ label: string; value: string }> {
  const recommended = getRecommendedCredentialStatus(config);
  return [
    {
      label: "Config file",
      value: config.configPath,
    },
    {
      label: ENV_NAMES.webUnlockerApiKey,
      value: describeValue(config.webUnlockerApiKey, config.sources.webUnlockerApiKey),
    },
    {
      label: ENV_NAMES.cloudToken,
      value: describeValue(config.cloudToken, config.sources.cloudToken),
    },
    {
      label: "Recommended setup",
      value: recommended.detail,
    },
    {
      label: ENV_NAMES.defaultProfileId,
      value: describePlainValue(config.defaultProfileId, config.sources.defaultProfileId),
    },
    {
      label: ENV_NAMES.daemonPort,
      value: `${config.daemonPort} (${config.sources.daemonPort})`,
    },
  ];
}

async function readConfigFile(configPath: string): Promise<StoredConfig> {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as StoredConfig;

    return {
      webUnlockerApiKey: normalizeString(parsed.webUnlockerApiKey),
      cloudToken: normalizeString(parsed.cloudToken),
      defaultProfileId: normalizeString(parsed.defaultProfileId),
      daemonPort: parsed.daemonPort,
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function resolveConfigPath(): Promise<string> {
  const currentPath = getDefaultConfigPath();
  if (await exists(currentPath)) {
    return currentPath;
  }

  const legacyPath = path.join(os.homedir(), LEGACY_CONFIG_DIR, CONFIG_FILENAME);
  if (await exists(legacyPath)) {
    return legacyPath;
  }

  return currentPath;
}

function pickString(envValue: string | undefined, fileValue?: string): string | undefined {
  return normalizeString(envValue) ?? normalizeString(fileValue);
}

function pickNumber(envValue: string | undefined, fileValue: number | undefined, fallback: number): number {
  if (normalizeString(envValue)) {
    const parsed = Number(envValue);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (typeof fileValue === "number" && fileValue > 0) {
    return fileValue;
  }

  return fallback;
}

function normalizeString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function firstEnvValue(primary: string, legacyNames: readonly string[]): string | undefined {
  const candidates = [primary, ...legacyNames];

  for (const name of candidates) {
    const value = normalizeString(process.env[name]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function resolveSource(envValue: string | undefined, fileValue?: string): ConfigSource {
  if (normalizeString(envValue)) {
    return "env";
  }

  if (normalizeString(fileValue)) {
    return "file";
  }

  return "unset";
}

function resolveNumberSource(envValue: string | undefined, fileValue?: number): ConfigSource {
  if (normalizeString(envValue)) {
    return "env";
  }

  if (typeof fileValue === "number") {
    return "file";
  }

  return "default";
}

function describeValue(value: string | undefined, source: ConfigSource): string {
  if (!value) {
    return "missing";
  }

  return `${maskSecret(value)} (${source})`;
}

function describePlainValue(value: string | undefined, source: ConfigSource): string {
  if (!value) {
    return "missing";
  }

  return `${value} (${source})`;
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
