import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildUncheckCommand(): Command {
  const command = new Command("uncheck")
    .description("Uncheck an element by snapshot ref.")
    .argument("<ref>", "Snapshot ref, for example e2")
    .action(async (ref: string, options: { session?: string }) => {
      await runBrowserCommand(["uncheck", ref], { session: options.session });
    });

  return addSessionOption(command);
}
