import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildGetCommand(): Command {
  const command = new Command("get")
    .description("Get text, value, html, title, or url from the current page or a target.")
    .argument("<kind>", "text, value, html, title, or url")
    .argument("[target]", "Optional snapshot ref target")
    .action(async (kind: string, target: string | undefined, options: { session?: string }) => {
      await runBrowserCommand(target ? ["get", kind, target] : ["get", kind], { session: options.session });
    });

  return addSessionOption(command);
}
