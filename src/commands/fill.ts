import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildFillCommand(): Command {
  const command = new Command("fill")
    .description("Fill text into an element by snapshot ref.")
    .argument("<ref>", "Snapshot ref, for example e2")
    .argument("<text>", "Text to fill")
    .action(async (ref: string, text: string, options: { session?: string }) => {
      await runBrowserCommand(["fill", ref, text], { session: options.session });
    });

  return addSessionOption(command);
}
