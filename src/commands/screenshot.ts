import path from "path";
import { Command } from "commander";
import { loadConfig } from "../config";
import { runAgentCommand } from "../lib/agentCli";

export function buildScreenshotCommand(): Command {
  return new Command("screenshot")
    .description("Save a full-page screenshot for the current session.")
    .argument("<targetPath>", "Where to write the screenshot file")
    .option("--session <id>", "Session ID. Defaults to the current session.")
    .action(async (targetPath: string, options: { session?: string }) => {
      const config = await loadConfig();
      const args = ["screenshot", path.resolve(targetPath)];
      if (options.session) {
        args.push("--session", options.session);
      }
      await runAgentCommand(args, config);
    });
}
