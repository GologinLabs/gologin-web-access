import { Command } from "commander";
import { loadConfig } from "../config";
import { runAgentCommand } from "../lib/agentCli";

export function buildSessionsCommand(): Command {
  return new Command("sessions")
    .description("List active daemon-backed browser sessions.")
    .action(async () => {
      const config = await loadConfig();
      await runAgentCommand(["sessions"], config);
    });
}
