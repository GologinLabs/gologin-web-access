import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildReloadCommand(): Command {
  const command = new Command("reload")
    .description("Reload the active Cloud Browser tab.")
    .action(async (options: { session?: string }) => {
      await runBrowserCommand(["reload"], { session: options.session });
    });

  return addSessionOption(command);
}
