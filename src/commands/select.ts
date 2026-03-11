import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildSelectCommand(): Command {
  const command = new Command("select")
    .description("Select a value in an element by snapshot ref.")
    .argument("<ref>", "Snapshot ref, for example e2")
    .argument("<value>", "Value to select")
    .action(async (ref: string, value: string, options: { session?: string }) => {
      await runBrowserCommand(["select", ref, value], { session: options.session });
    });

  return addSessionOption(command);
}
