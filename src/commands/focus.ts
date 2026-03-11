import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildFocusCommand(): Command {
  const command = new Command("focus")
    .description("Focus an element by snapshot ref.")
    .argument("<ref>", "Snapshot ref, for example e2")
    .action(async (ref: string, options: { session?: string }) => {
      await runBrowserCommand(["focus", ref], { session: options.session });
    });

  return addSessionOption(command);
}
