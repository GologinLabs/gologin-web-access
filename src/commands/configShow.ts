import { Command } from "commander";
import { getMaskedConfigRows, loadConfig } from "../config";
import { printJson, printKeyValueRows } from "../lib/output";

export function buildConfigShowCommand(): Command {
  return new Command("show")
    .description("Show merged GoLogin CLI configuration.")
    .option("--json", "Print JSON output")
    .action(async (options: { json?: boolean }) => {
      const config = await loadConfig();
      const rows = getMaskedConfigRows(config);

      if (options.json) {
        printJson({
          configPath: config.configPath,
          values: rows,
        });
        return;
      }

      printKeyValueRows(rows);
    });
}
