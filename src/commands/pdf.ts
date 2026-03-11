import { Command } from "commander";
import { addSessionOption, resolveOutputPath, runBrowserCommand } from "./shared";

export function buildPdfCommand(): Command {
  const command = new Command("pdf")
    .description("Save the current page as a PDF.")
    .argument("<targetPath>", "Where to write the PDF file")
    .action(async (targetPath: string, options: { session?: string }) => {
      await runBrowserCommand(["pdf", resolveOutputPath(targetPath)], { session: options.session });
    });

  return addSessionOption(command);
}
