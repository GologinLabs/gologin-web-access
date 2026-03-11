import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildScrollIntoViewCommand(): Command {
  const command = new Command("scrollintoview")
    .description("Scroll a target element into view.")
    .argument("<ref>", "Snapshot ref, for example e2")
    .action(async (ref: string, options: { session?: string }) => {
      await runBrowserCommand(["scrollintoview", ref], { session: options.session });
    });

  return addSessionOption(command);
}
