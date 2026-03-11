import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildWaitCommand(): Command {
  const command = new Command("wait")
    .description("Wait for a target, text, URL pattern, load state, or timeout.")
    .argument("<targetOrMs>", "Target ref or timeout in milliseconds")
    .option("--text <text>", "Wait for matching text")
    .option("--url <pattern>", "Wait for URL pattern")
    .option("--load <state>", "load, domcontentloaded, or networkidle")
    .action(
      async (
        targetOrMs: string,
        options: {
          text?: string;
          url?: string;
          load?: string;
          session?: string;
        },
      ) => {
        const args = ["wait", targetOrMs];
        if (options.text) {
          args.push("--text", options.text);
        }
        if (options.url) {
          args.push("--url", options.url);
        }
        if (options.load) {
          args.push("--load", options.load);
        }
        await runBrowserCommand(args, { session: options.session });
      },
    );

  return addSessionOption(command);
}
