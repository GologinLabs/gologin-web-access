import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildTabCloseCommand(): Command {
  const command = new Command("tabclose")
    .description("Close the current tab or a specific tab in the active Cloud Browser session.")
    .argument("[index]", "Optional 1-based tab index")
    .action(async (index: string | undefined, options: { session?: string }) => {
      const args = ["tabclose"];
      if (index) {
        args.push(index);
      }
      await runBrowserCommand(args, { session: options.session });
    });

  return addSessionOption(command);
}
