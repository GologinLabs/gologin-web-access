import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildCookiesClearCommand(): Command {
  const command = new Command("cookies-clear")
    .description("Clear cookies from the active Cloud Browser session.")
    .action(async (options: { session?: string }) => {
      await runBrowserCommand(["cookies-clear"], { session: options.session });
    });

  return addSessionOption(command);
}
