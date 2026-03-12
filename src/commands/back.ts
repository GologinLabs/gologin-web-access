import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildBackCommand(): Command {
  const command = new Command("back")
    .description("Navigate back in the active Cloud Browser tab history.")
    .action(async (options: { session?: string }) => {
      await runBrowserCommand(["back"], { session: options.session });
    });

  return addSessionOption(command);
}
