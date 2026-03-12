import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildStorageExportCommand(): Command {
  const command = new Command("storage-export")
    .description("Export localStorage/sessionStorage from the active Cloud Browser tab.")
    .argument("[outputPath]", "Optional path for the exported storage JSON")
    .option("--scope <scope>", "Storage scope: local, session, or both")
    .option("--json", "Print storage state as JSON")
    .action(async (outputPath: string | undefined, options: { session?: string; scope?: string; json?: boolean }) => {
      const args = ["storage-export"];
      if (outputPath) {
        args.push(outputPath);
      }
      if (options.scope) {
        args.push("--scope", options.scope);
      }
      if (options.json) {
        args.push("--json");
      }
      await runBrowserCommand(args, { session: options.session });
    });

  return addSessionOption(command);
}
