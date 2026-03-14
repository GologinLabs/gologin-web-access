import { Command } from "commander";
import { DEFAULT_DAEMON_PORT, ENV_NAMES, initConfigFile } from "../config";
import { validateCloudToken } from "../lib/cloudApi";
import { printKeyValueRows, printText } from "../lib/output";
import { validateWebUnlockerKey } from "../lib/unlocker";

export function buildConfigInitCommand(): Command {
  return new Command("init")
    .description("Write ~/.gologin-web-access/config.json with current values or placeholders. Recommended: persist both the Web Unlocker key and the GoLogin token.")
    .option("--web-unlocker-api-key <key>", "Persist a Web Unlocker API key")
    .option("--web-unlocker-key <key>", "Alias for --web-unlocker-api-key")
    .option("--token <token>", "Persist a GoLogin token")
    .option("--cloud-token <token>", "Backward-compatible alias for --token")
    .option("--default-profile-id <id>", "Persist a default Gologin profile ID")
    .option("--daemon-port <port>", "Persist a daemon port", String(DEFAULT_DAEMON_PORT))
    .option("--no-validate", "Skip live key validation after writing config")
    .option("--force", "Overwrite an existing config file")
    .action(
      async (options: {
        webUnlockerApiKey?: string;
        webUnlockerKey?: string;
        token?: string;
        cloudToken?: string;
        defaultProfileId?: string;
        daemonPort?: string;
        validate?: boolean;
        force?: boolean;
      }) => {
        const webUnlockerApiKey = options.webUnlockerApiKey ?? options.webUnlockerKey ?? process.env[ENV_NAMES.webUnlockerApiKey];
        const result = await initConfigFile(
          {
            webUnlockerApiKey,
            cloudToken:
              options.token ??
              options.cloudToken ??
              process.env[ENV_NAMES.cloudToken] ??
              process.env.GOLOGIN_CLOUD_TOKEN,
            defaultProfileId: options.defaultProfileId ?? process.env[ENV_NAMES.defaultProfileId],
            daemonPort: Number(options.daemonPort ?? process.env[ENV_NAMES.daemonPort] ?? DEFAULT_DAEMON_PORT),
          },
          {
            force: options.force,
          },
        );

        if (!result.created) {
          printText(`Config already exists at ${result.path}. Use --force to overwrite it.`);
          return;
        }

        printKeyValueRows([
          { label: "Config file", value: result.path },
          {
            label: "Web Unlocker key",
            value: result.config.webUnlockerApiKey ? "written" : "left empty",
          },
          {
            label: "GoLogin token",
            value: result.config.cloudToken ? "written" : "left empty",
          },
          {
            label: "Default profile",
            value: result.config.defaultProfileId ?? "not set",
          },
          {
            label: "Daemon port",
            value: String(result.config.daemonPort ?? DEFAULT_DAEMON_PORT),
          },
        ]);

        if (!result.config.webUnlockerApiKey || !result.config.cloudToken) {
          printText(
            "Recommended next step: configure both GOLOGIN_WEB_UNLOCKER_API_KEY and GOLOGIN_TOKEN so agents can use scraping and browser flows without asking again.",
          );
        }

        if (options.validate === false) {
          return;
        }

        const validationRows: Array<{ label: string; value: string }> = [];
        if (result.config.webUnlockerApiKey) {
          const validation = await validateWebUnlockerKey(result.config.webUnlockerApiKey);
          validationRows.push({
            label: "Web Unlocker validation",
            value: validation.ok ? "ok" : `failed${validation.status ? ` (${validation.status})` : ""}: ${validation.detail}`,
          });
        }

        if (result.config.cloudToken) {
          const validation = await validateCloudToken(result.config.cloudToken);
          validationRows.push({
            label: "GoLogin token validation",
            value: validation.ok ? "ok" : `failed${validation.status ? ` (${validation.status})` : ""}: ${validation.detail}`,
          });
        }

        if (validationRows.length > 0) {
          printKeyValueRows(validationRows);
        }
      },
    );
}
