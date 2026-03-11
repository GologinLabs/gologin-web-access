import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildCheckCommand(): Command {
  const command = new Command("check")
    .description("Check an element by snapshot ref.")
    .argument("<ref>", "Snapshot ref, for example e2")
    .action(async (ref: string, options: { session?: string }) => {
      await runBrowserCommand(["check", ref], { session: options.session });
    });

  return addSessionOption(command);
}
