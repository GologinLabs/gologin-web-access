import { Command } from "commander";
import { loadConfig, requireCloudToken, resolveProfileId } from "../config";
import { runAgentCommand } from "../lib/agentCli";

export function buildOpenCommand(): Command {
  return new Command("open")
    .description("Open a URL in GoLogin Cloud Browser and create a daemon-backed session.")
    .argument("<url>", "URL to open")
    .option("--profile <id>", "GoLogin profile ID to use")
    .action(async (url: string, options: { profile?: string }) => {
      const config = await loadConfig();
      requireCloudToken(config);
      const args = ["open", url];
      const profileId = resolveProfileId(config, options.profile);
      if (profileId && options.profile) {
        args.push("--profile", profileId);
      }
      await runAgentCommand(args, config);
    });
}
