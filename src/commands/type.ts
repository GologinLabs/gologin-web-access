import { Command } from "commander";
import { loadConfig } from "../config";
import { runAgentCommand } from "../lib/agentCli";

export function buildTypeCommand(): Command {
  return new Command("type")
    .description("Type text into an element by snapshot ref.")
    .argument("<ref>", "Snapshot ref, for example e2")
    .argument("<text>", "Text to type")
    .option("--session <id>", "Session ID. Defaults to the current session.")
    .action(async (ref: string, text: string, options: { session?: string }) => {
      const config = await loadConfig();
      const args = ["type", ref, text];
      if (options.session) {
        args.push("--session", options.session);
      }
      await runAgentCommand(args, config);
    });
}
