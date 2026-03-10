import { Command } from "commander";
import { loadConfig } from "../config";
import { runAgentCommand } from "../lib/agentCli";

export function buildSnapshotCommand(): Command {
  return new Command("snapshot")
    .description("Capture the current page state and assign clickable refs.")
    .option("--session <id>", "Session ID. Defaults to the current session.")
    .action(async (options: { session?: string }) => {
      const config = await loadConfig();
      const args = ["snapshot"];
      if (options.session) {
        args.push("--session", options.session);
      }
      await runAgentCommand(args, config);
    });
}
