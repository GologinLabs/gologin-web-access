import { Command } from "commander";
import { DEFAULT_DAEMON_PORT, ENV_NAMES, initConfigFile } from "../config";
import { printKeyValueRows, printText } from "../lib/output";

export function buildConfigInitCommand(): Command {
  return new Command("init")
    .description("Write ~/.gologin-web-access/config.json with current values or placeholders.")
    .option("--web-unlocker-api-key <key>", "Persist a Web Unlocker API key")
    .option("--cloud-token <token>", "Persist a Cloud Browser token")
    .option("--default-profile-id <id>", "Persist a default GoLogin profile ID")
    .option("--daemon-port <port>", "Persist a daemon port", String(DEFAULT_DAEMON_PORT))
    .option("--force", "Overwrite an existing config file")
    .action(
      async (options: {
        webUnlockerApiKey?: string;
        cloudToken?: string;
        defaultProfileId?: string;
        daemonPort?: string;
        force?: boolean;
      }) => {
        const result = await initConfigFile(
          {
            webUnlockerApiKey: options.webUnlockerApiKey ?? process.env[ENV_NAMES.webUnlockerApiKey],
            cloudToken: options.cloudToken ?? process.env[ENV_NAMES.cloudToken],
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
            label: "Cloud token",
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
      },
    );
}
