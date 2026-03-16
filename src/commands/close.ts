import { Command } from "commander";
import { loadConfig } from "../config";
import { runAgentCommand } from "../lib/agentCli";

export function buildCloseCommand(): Command {
  return new Command("close")
    .description("Close the current browser session or a specific session.")
    .option("--session <id>", "Session ID. Defaults to the current session.")
    .option("--all", "Close every tracked browser session in the current daemon.")
    .action(async (options: { session?: string; all?: boolean }) => {
      const config = await loadConfig();
      const args = ["close"];
      if (options.all) {
        args.push("--all");
      }
      if (options.session) {
        args.push("--session", options.session);
      }
      await runAgentCommand(args, config);
    });
}
