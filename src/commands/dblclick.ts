import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildDoubleClickCommand(): Command {
  const command = new Command("dblclick")
    .description("Double-click an element by snapshot ref.")
    .argument("<ref>", "Snapshot ref, for example e3")
    .action(async (ref: string, options: { session?: string }) => {
      await runBrowserCommand(["dblclick", ref], { session: options.session });
    });

  return addSessionOption(command);
}
