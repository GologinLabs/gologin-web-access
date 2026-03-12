import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildForwardCommand(): Command {
  const command = new Command("forward")
    .description("Navigate forward in the active Cloud Browser tab history.")
    .action(async (options: { session?: string }) => {
      await runBrowserCommand(["forward"], { session: options.session });
    });

  return addSessionOption(command);
}
