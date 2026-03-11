import { Command } from "commander";
import { addSessionOption, resolveOutputPath, runBrowserCommand } from "./shared";

export function buildUploadCommand(): Command {
  const command = new Command("upload")
    .description("Upload one or more files to an element by snapshot ref.")
    .argument("<ref>", "Snapshot ref, for example e2")
    .argument("<files...>", "One or more files to upload")
    .action(async (ref: string, files: string[], options: { session?: string }) => {
      await runBrowserCommand(["upload", ref, ...files.map(resolveOutputPath)], { session: options.session });
    });

  return addSessionOption(command);
}
