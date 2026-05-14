import { promises as fs } from "fs";
import path from "path";
import { Command } from "commander";
import { loadConfig, requireCloudToken } from "../config";
import { asObjectPayload, gologinApiRequest } from "../lib/cloudApi";
import { CliError } from "../lib/errors";
import { printJson, printText } from "../lib/output";

type JsonOptions = {
  json?: boolean;
};

type ProfileCookie = Record<string, unknown>;

async function getCloudToken(): Promise<string> {
  const config = await loadConfig();
  return requireCloudToken(config);
}

function parseDays(value: string | undefined): number {
  const days = value ? Number(value) : 7;
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    throw new CliError("--days must be an integer from 1 to 30.");
  }
  return days;
}

function parsePage(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const page = Number(value);
  if (!Number.isInteger(page) || page < 1) {
    throw new CliError("--page must be a positive integer.");
  }
  return page;
}

function normalizeCountryCode(value: string): string {
  const countryCode = value.toLowerCase();
  if (!/^[a-z]{2}$/.test(countryCode)) {
    throw new CliError("--country must be a 2-letter country code, for example us.");
  }
  return countryCode;
}

function normalizeProxyType(value: string | undefined): { isMobile?: boolean; isDC?: boolean; label: string } {
  const type = value ?? "residential";
  if (type === "mobile") {
    return { isMobile: true, label: "mobile" };
  }
  if (type === "dc" || type === "datacenter") {
    return { isDC: true, label: "datacenter" };
  }
  if (type === "residential") {
    return { label: "residential" };
  }
  throw new CliError("--type must be one of residential, mobile, or dc.");
}

function detectHostOs(): string {
  if (process.platform === "darwin") {
    return "mac";
  }
  if (process.platform === "win32") {
    return "win";
  }
  return "lin";
}

function normalizeOs(value: string | undefined): string {
  const os = value ?? detectHostOs();
  if (!["lin", "mac", "win", "android", "android-cloud"].includes(os)) {
    throw new CliError("--os must be one of lin, mac, win, android, or android-cloud.");
  }
  return os;
}

async function readJsonFile<T>(targetPath: string): Promise<T> {
  const absolutePath = path.resolve(targetPath);
  try {
    return JSON.parse(await fs.readFile(absolutePath, "utf8")) as T;
  } catch (error) {
    throw new CliError(`Failed to read JSON file ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function writeJsonFile(targetPath: string, payload: unknown): Promise<string> {
  const absolutePath = path.resolve(targetPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return absolutePath;
}

export function buildCloudUsageCommand(): Command {
  return new Command("cloud-usage")
    .description("Read GoLogin Cloud Browser usage statistics.")
    .option("--profile <profileId>", "Profile ID to inspect")
    .option("--workspace <workspaceId>", "Workspace ID to inspect")
    .option("--days <days>", "Workspace stats range from 1 to 30 days", "7")
    .option("--json", "Print JSON output")
    .action(async (options: { profile?: string; workspace?: string; days?: string; json?: boolean }) => {
      if (options.profile && options.workspace) {
        throw new CliError("Use either --profile or --workspace, not both.");
      }

      const token = await getCloudToken();
      if (options.profile) {
        const payload = await gologinApiRequest<unknown>(token, "GET", `/cloud-usage/profile/${options.profile}/stats`);
        if (options.json) {
          printJson(payload);
          return;
        }
        printText(`profile=${options.profile} usage=${JSON.stringify(payload)}`);
        return;
      }

      if (!options.workspace) {
        throw new CliError("Usage: gologin-web-access cloud-usage --profile <profileId> | --workspace <workspaceId> [--days <1-30>] [--json]");
      }

      const days = parseDays(options.days);
      const payload = await gologinApiRequest<unknown>(token, "GET", "/cloud-usage/stats", {
        query: { workspaceId: options.workspace, days },
      });
      if (options.json) {
        printJson(payload);
        return;
      }
      printText(`workspace=${options.workspace} days=${days} usage=${JSON.stringify(payload)}`);
    });
}

export function buildProfileCloudCommand(): Command {
  const command = new Command("profile-cloud").description("Start or stop a GoLogin profile in Cloud Browser.");

  command
    .command("start")
    .argument("<profileId>", "Profile ID")
    .option("--json", "Print JSON output")
    .action(async (profileId: string, options: JsonOptions) => {
      const token = await getCloudToken();
      const payload = await gologinApiRequest<unknown>(token, "POST", `/browser/${profileId}/web`, { body: {} });
      if (options.json) {
        printJson(payload ?? { profileId, started: true });
        return;
      }
      const value = asObjectPayload(payload);
      const remoteUrl = typeof value.remoteOrbitaUrl === "string" ? ` remote=${value.remoteOrbitaUrl}` : "";
      printText(`profile=${profileId} cloud=started${remoteUrl}`);
    });

  command
    .command("stop")
    .argument("<profileId>", "Profile ID")
    .option("--json", "Print JSON output")
    .action(async (profileId: string, options: JsonOptions) => {
      const token = await getCloudToken();
      await gologinApiRequest<unknown>(token, "DELETE", `/browser/${profileId}/web`);
      if (options.json) {
        printJson({ profileId, stopped: true });
        return;
      }
      printText(`profile=${profileId} cloud=stopped`);
    });

  return command;
}

export function buildProfileCookiesCommand(): Command {
  const command = new Command("profile-cookies").description("Export or import cookies from the GoLogin profile database.");

  command
    .command("export")
    .argument("<profileId>", "Profile ID")
    .option("--output <path>", "Write cookies JSON to a file")
    .option("--json", "Print JSON output with profile metadata")
    .action(async (profileId: string, options: { output?: string; json?: boolean }) => {
      const token = await getCloudToken();
      const cookies = await gologinApiRequest<ProfileCookie[]>(token, "GET", `/browser/${profileId}/cookies`);
      if (options.output) {
        printText(await writeJsonFile(options.output, cookies));
        return;
      }
      printJson(options.json ? { profileId, cookies } : cookies);
    });

  command
    .command("import")
    .argument("<profileId>", "Profile ID")
    .argument("<cookiesJson>", "Cookie JSON file")
    .option("--clean", "Clear existing cookies before importing")
    .option("--json", "Print JSON output")
    .action(async (profileId: string, cookiesJson: string, options: { clean?: boolean; json?: boolean }) => {
      const cookies = await readJsonFile<ProfileCookie[]>(cookiesJson);
      if (!Array.isArray(cookies)) {
        throw new CliError("Cookie import file must contain a JSON array.");
      }

      const token = await getCloudToken();
      await gologinApiRequest<unknown>(token, "POST", `/browser/${profileId}/cookies`, {
        query: { fromUser: true, cleanCookies: options.clean || undefined },
        body: cookies,
      });
      if (options.json) {
        printJson({ profileId, imported: cookies.length, cleanCookies: options.clean === true });
        return;
      }
      printText(`profile=${profileId} importedCookies=${cookies.length}${options.clean ? " clean=true" : ""}`);
    });

  return command;
}

export function buildProfileFingerprintCommand(): Command {
  const command = new Command("profile-fingerprint").description("Refresh fingerprints for one or more GoLogin profiles.");

  command
    .command("refresh")
    .argument("<profileIds...>", "Profile IDs")
    .option("--json", "Print JSON output")
    .action(async (profileIds: string[], options: JsonOptions) => {
      const token = await getCloudToken();
      const payload = await gologinApiRequest<unknown>(token, "PATCH", "/browser/fingerprints", {
        body: { browsersIds: profileIds },
      });
      if (options.json) {
        printJson(payload);
        return;
      }
      printText(`refreshedFingerprints=${profileIds.length} profiles=${profileIds.join(",")}`);
    });

  return command;
}

export function buildProfileProxyCommand(): Command {
  const command = new Command("profile-proxy").description("Manage GoLogin proxies through the REST API.");

  command
    .command("list")
    .option("--page <page>", "Page number", "1")
    .option("--json", "Print JSON output")
    .action(async (options: { page?: string; json?: boolean }) => {
      const token = await getCloudToken();
      const payload = await gologinApiRequest<unknown>(token, "GET", "/proxy/v2", {
        query: { page: parsePage(options.page) },
      });
      if (options.json) {
        printJson(payload);
        return;
      }
      const value = asObjectPayload(payload);
      const proxies = Array.isArray(value.proxies) ? value.proxies : [];
      printText(`proxies=${proxies.length} hasMore=${value.hasMore === true}`);
    });

  command
    .command("traffic")
    .description("Read GoLogin managed proxy traffic balance/usage.")
    .action(async () => {
      const token = await getCloudToken();
      printJson(await gologinApiRequest<unknown>(token, "GET", "/users-proxies/geolocation/traffic"));
    });

  command
    .command("add-gologin")
    .argument("<profileId>", "Profile ID to link the managed proxy to")
    .requiredOption("--country <cc>", "2-letter country code, for example us")
    .option("--city <city>", "Optional city name")
    .option("--type <type>", "residential, mobile, or dc", "residential")
    .option("--name <name>", "Custom proxy name")
    .option("--json", "Print JSON output")
    .action(async (profileId: string, options: { country: string; city?: string; type?: string; name?: string; json?: boolean }) => {
      const token = await getCloudToken();
      const countryCode = normalizeCountryCode(options.country);
      const proxyType = normalizeProxyType(options.type);
      const body: Record<string, unknown> = {
        countryCode,
        profileIdToLink: profileId,
        customName: options.name ?? `gologin-${countryCode}-${profileId.slice(0, 6)}`,
      };
      if (options.city) {
        body.city = options.city;
      }
      if (proxyType.isMobile !== undefined) {
        body.isMobile = proxyType.isMobile;
      }
      if (proxyType.isDC !== undefined) {
        body.isDC = proxyType.isDC;
      }

      const payload = await gologinApiRequest<unknown>(token, "POST", "/users-proxies/mobile-proxy", { body });
      if (options.json) {
        printJson(payload ?? { profileId, countryCode, type: proxyType.label });
        return;
      }
      printText(`profile=${profileId} proxy=gologin:${countryCode} type=${proxyType.label}`);
    });

  return command;
}

export function buildProfileUaCommand(): Command {
  const command = new Command("profile-ua").description("Read latest GoLogin user agent or update profile UA.");

  command
    .command("latest")
    .option("--os <os>", "lin, mac, win, android, or android-cloud")
    .option("--json", "Print JSON output")
    .action(async (options: { os?: string; json?: boolean }) => {
      const os = normalizeOs(options.os);
      const token = await getCloudToken();
      const payload = await gologinApiRequest<unknown>(token, "GET", "/browser/latest-useragent", {
        query: { os },
      });
      if (options.json) {
        printJson(payload);
        return;
      }
      printText(`os=${os} latestUserAgent=${typeof payload === "string" ? payload : JSON.stringify(payload)}`);
    });

  command
    .command("update")
    .argument("[profileIds...]", "Profile IDs")
    .option("--all-profiles", "Update all profiles in the current workspace")
    .option("--workspace <id>", "Current workspace ID")
    .option("--json", "Print JSON output")
    .action(async (profileIds: string[], options: { allProfiles?: boolean; workspace?: string; json?: boolean }) => {
      if (profileIds.length === 0 && !options.allProfiles) {
        throw new CliError("Usage: gologin-web-access profile-ua update <profileId...> [--all-profiles] [--workspace <id>] [--json]");
      }

      const token = await getCloudToken();
      const payload = await gologinApiRequest<unknown>(token, "PATCH", "/browser/update_ua_to_new_browser_v", {
        query: { currentWorkspace: options.workspace },
        body: {
          browserIds: profileIds,
          updateUaToNewBrowserV: true,
          updateAllProfiles: options.allProfiles === true,
        },
      });
      if (options.json) {
        printJson(payload ?? { updated: true, profileIds, allProfiles: options.allProfiles === true });
        return;
      }
      printText(
        options.allProfiles
          ? "updatedUserAgent=allProfiles"
          : `updatedUserAgentProfiles=${profileIds.length} profiles=${profileIds.join(",")}`,
      );
    });

  return command;
}
