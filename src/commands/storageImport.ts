import { Command } from "commander";
import { addSessionOption, runBrowserCommand } from "./shared";

export function buildStorageImportCommand(): Command {
  const command = new Command("storage-import")
    .description("Import localStorage/sessionStorage into the active Cloud Browser tab.")
    .argument("<storagePath>", "Path to the storage JSON file")
    .option("--scope <scope>", "Storage scope: local, session, or both")
    .option("--clear", "Clear existing storage before importing")
    .action(
      async (storagePath: string, options: { session?: string; scope?: string; clear?: boolean }) => {
        const args = ["storage-import", storagePath];
        if (options.scope) {
          args.push("--scope", options.scope);
        }
        if (options.clear) {
          args.push("--clear");
        }
        await runBrowserCommand(args, { session: options.session });
      },
    );

  return addSessionOption(command);
}
