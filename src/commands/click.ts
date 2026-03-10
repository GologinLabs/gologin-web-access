import { Command } from "commander";
import { loadConfig } from "../config";
import { runAgentCommand } from "../lib/agentCli";

export function buildClickCommand(): Command {
  return new Command("click")
    .description("Click an element by snapshot ref.")
    .argument("<ref>", "Snapshot ref, for example e3")
    .option("--session <id>", "Session ID. Defaults to the current session.")
    .action(async (ref: string, options: { session?: string }) => {
      const config = await loadConfig();
      const args = ["click", ref];
      if (options.session) {
        args.push("--session", options.session);
      }
      await runAgentCommand(args, config);
    });
}
