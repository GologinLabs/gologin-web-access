import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildCookiesCommand(): Command {
  const command = new Command("cookies")
    .description("Export cookies from the active Cloud Browser session.")
    .option("--output <path>", "Write cookies JSON to a file")
    .option("--json", "Print cookies as JSON")
    .action(async (options: { session?: string; output?: string; json?: boolean }) => {
      const args = ["cookies"];
      if (options.output) {
        args.push("--output", options.output);
      }
      if (options.json) {
        args.push("--json");
      }
      await runBrowserCommand(args, { session: options.session });
    });

  return addSessionOption(command);
}
