import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildHoverCommand(): Command {
  const command = new Command("hover")
    .description("Hover an element by snapshot ref.")
    .argument("<ref>", "Snapshot ref, for example e2")
    .action(async (ref: string, options: { session?: string }) => {
      await runBrowserCommand(["hover", ref], { session: options.session });
    });

  return addSessionOption(command);
}
