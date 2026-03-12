import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildTabFocusCommand(): Command {
  const command = new Command("tabfocus")
    .alias("tabswitch")
    .description("Focus a specific tab in the active Cloud Browser session.")
    .argument("<index>", "1-based tab index")
    .action(async (index: string, options: { session?: string }) => {
      await runBrowserCommand(["tabfocus", index], { session: options.session });
    });

  return addSessionOption(command);
}
