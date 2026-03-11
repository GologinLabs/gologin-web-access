import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildFindCommand(): Command {
  const command = new Command("find")
    .description("Find elements semantically and act on them through the browser session.")
    .allowUnknownOption(true)
    .argument("<args...>", "Arguments forwarded to gologin-agent-browser find")
    .action(async (args: string[], options: { session?: string }) => {
      const finalArgs = ["find", ...args];
      await runBrowserCommand(finalArgs, { session: options.session });
    });

  return addSessionOption(command);
}
