import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildSnapshotCommand(): Command {
  const command = new Command("snapshot")
    .description("Capture the current page state and assign clickable refs.")
    .option("-i, --interactive", "Use the agent interactive snapshot format")
    .action(async (options: { session?: string; interactive?: boolean }) => {
      const args = ["snapshot"];
      if (options.interactive) {
        args.push("--interactive");
      }
      await runBrowserCommand(args, { session: options.session });
    });

  return addSessionOption(command);
}
