import { Command } from "commander";
import { loadConfig } from "../config";
import { runAgentCommand } from "../lib/agentCli";

export function buildSessionsCommand(): Command {
  return new Command("sessions")
    .description("List active daemon-backed browser sessions.")
    .option("--prune", "Close tracked sessions idle for too long before listing.")
    .option("--older-than-ms <ms>", "Idle threshold used with --prune.")
    .action(async (options: { prune?: boolean; olderThanMs?: string }) => {
      const config = await loadConfig();
      const args = ["sessions"];
      if (options.prune) {
        args.push("--prune");
      }
      if (options.olderThanMs) {
        args.push("--older-than-ms", options.olderThanMs);
      }
      await runAgentCommand(args, config);
    });
}
