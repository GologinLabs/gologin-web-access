import { Command } from "commander";
import { addSessionOption, resolveOutputPath, runBrowserCommand } from "./shared";

export function buildScreenshotCommand(): Command {
  const command = new Command("screenshot")
    .description("Save a full-page screenshot for the current session.")
    .argument("<targetPath>", "Where to write the screenshot file")
    .option("--annotate", "Annotate the screenshot with refs")
    .option("--press-escape", "Press escape before taking the screenshot")
    .action(async (targetPath: string, options: { session?: string; annotate?: boolean; pressEscape?: boolean }) => {
      const args = ["screenshot", resolveOutputPath(targetPath)];
      if (options.annotate) {
        args.push("--annotate");
      }
      if (options.pressEscape) {
        args.push("--press-escape");
      }
      await runBrowserCommand(args, { session: options.session });
    });

  return addSessionOption(command);
}
