import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildTabsCommand(): Command {
  const command = new Command("tabs")
    .description("List open tabs in the current Gologin Cloud Browser session.")
    .action(async (options: { session?: string }) => {
      await runBrowserCommand(["tabs"], { session: options.session });
    });

  return addSessionOption(command);
}
