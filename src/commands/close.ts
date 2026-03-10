import { Command } from "commander";
import { loadConfig } from "../config";
import { runAgentCommand } from "../lib/agentCli";

export function buildCloseCommand(): Command {
  return new Command("close")
    .description("Close the current browser session or a specific session.")
    .option("--session <id>", "Session ID. Defaults to the current session.")
    .action(async (options: { session?: string }) => {
      const config = await loadConfig();
      const args = ["close"];
      if (options.session) {
        args.push("--session", options.session);
      }
      await runAgentCommand(args, config);
    });
}
