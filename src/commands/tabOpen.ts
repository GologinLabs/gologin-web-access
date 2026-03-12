import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildTabOpenCommand(): Command {
  const command = new Command("tabopen")
    .alias("tabnew")
    .description("Open a new tab in the active Cloud Browser session.")
    .argument("[url]", "Optional URL to open in the new tab")
    .action(async (url: string | undefined, options: { session?: string }) => {
      const args = ["tabopen"];
      if (url) {
        args.push(url);
      }
      await runBrowserCommand(args, { session: options.session });
    });

  return addSessionOption(command);
}
