import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildScrollCommand(): Command {
  const command = new Command("scroll")
    .description("Scroll the page or a target element.")
    .argument("<direction>", "up, down, left, or right")
    .argument("[pixels]", "Optional number of pixels")
    .option("--target <ref>", "Optional snapshot ref target")
    .action(
      async (
        direction: string,
        pixels: string | undefined,
        options: {
          target?: string;
          session?: string;
        },
      ) => {
        const args = ["scroll", direction];
        if (pixels) {
          args.push(pixels);
        }
        if (options.target) {
          args.push("--target", options.target);
        }
        await runBrowserCommand(args, { session: options.session });
      },
    );

  return addSessionOption(command);
}
