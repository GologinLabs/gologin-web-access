import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildEvalCommand(): Command {
  const command = new Command("eval")
    .alias("js")
    .description("Evaluate a JavaScript expression in the active Cloud Browser tab.")
    .argument("<expression...>", "JavaScript expression")
    .option("--json", "Print the evaluated value as JSON")
    .action(async (expression: string[], options: { session?: string; json?: boolean }) => {
      const args = ["eval", expression.join(" ")];
      if (options.json) {
        args.push("--json");
      }
      await runBrowserCommand(args, { session: options.session });
    });

  return addSessionOption(command);
}
