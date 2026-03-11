import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildPressCommand(): Command {
  const command = new Command("press")
    .description("Press a keyboard key, optionally against a target ref.")
    .argument("<key>", "Keyboard key, for example Enter or ArrowDown")
    .argument("[target]", "Optional snapshot ref target")
    .action(async (key: string, target: string | undefined, options: { session?: string }) => {
      await runBrowserCommand(target ? ["press", key, target] : ["press", key], { session: options.session });
    });

  return addSessionOption(command);
}
