import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildCookiesImportCommand(): Command {
  const command = new Command("cookies-import")
    .description("Import cookies into the active Cloud Browser session.")
    .argument("<cookiesPath>", "Path to a cookies JSON file")
    .action(async (cookiesPath: string, options: { session?: string }) => {
      await runBrowserCommand(["cookies-import", cookiesPath], { session: options.session });
    });

  return addSessionOption(command);
}
