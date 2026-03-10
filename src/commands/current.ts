import { Command } from "commander";
import { loadConfig } from "../config";
import { runAgentCommand } from "../lib/agentCli";

export function buildCurrentCommand(): Command {
  return new Command("current")
    .description("Show the current daemon-backed browser session.")
    .action(async () => {
      const config = await loadConfig();
      await runAgentCommand(["current"], config);
    });
}
