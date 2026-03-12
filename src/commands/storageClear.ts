import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildStorageClearCommand(): Command {
  const command = new Command("storage-clear")
    .description("Clear localStorage/sessionStorage in the active Cloud Browser tab.")
    .option("--scope <scope>", "Storage scope: local, session, or both")
    .action(async (options: { session?: string; scope?: string }) => {
      const args = ["storage-clear"];
      if (options.scope) {
        args.push("--scope", options.scope);
      }
      await runBrowserCommand(args, { session: options.session });
    });

  return addSessionOption(command);
}
