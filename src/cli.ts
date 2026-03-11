#!/usr/bin/env node
import { Command } from "commander";
import { buildBatchScrapeCommand } from "./commands/batchScrape";
import { buildCrawlCommand } from "./commands/crawl";
import { buildClickCommand } from "./commands/click";
import { buildCloseCommand } from "./commands/close";
import { buildConfigInitCommand } from "./commands/configInit";
import { buildConfigShowCommand } from "./commands/configShow";
import { buildCurrentCommand } from "./commands/current";
import { buildMapCommand } from "./commands/map";
import { buildOpenCommand } from "./commands/open";
import { buildScrapeCommand } from "./commands/scrape";
import { buildScrapeJsonCommand } from "./commands/scrapeJson";
import { buildScrapeMarkdownCommand } from "./commands/scrapeMarkdown";
import { buildScrapeTextCommand } from "./commands/scrapeText";
import { buildSearchCommand } from "./commands/search";
import { buildScreenshotCommand } from "./commands/screenshot";
import { buildSessionsCommand } from "./commands/sessions";
import { buildSnapshotCommand } from "./commands/snapshot";
import { buildTypeCommand } from "./commands/type";
import { runDoctor } from "./doctor";
import { toCliError } from "./lib/errors";
import { printError } from "./lib/output";

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("gologin-web-access")
    .description("Read and interact with the web using Gologin Web Unlocker and Cloud Browser.")
    .version("0.1.0")
    .showHelpAfterError()
    .showSuggestionAfterError();

  program.addCommand(buildScrapeCommand());
  program.addCommand(buildScrapeMarkdownCommand());
  program.addCommand(buildScrapeTextCommand());
  program.addCommand(buildScrapeJsonCommand());
  program.addCommand(buildBatchScrapeCommand());
  program.addCommand(buildSearchCommand());
  program.addCommand(buildMapCommand());
  program.addCommand(buildCrawlCommand());

  program.addCommand(buildOpenCommand());
  program.addCommand(buildSnapshotCommand());
  program.addCommand(buildClickCommand());
  program.addCommand(buildTypeCommand());
  program.addCommand(buildScreenshotCommand());
  program.addCommand(buildCloseCommand());
  program.addCommand(buildSessionsCommand());
  program.addCommand(buildCurrentCommand());

  program
    .command("doctor")
    .description("Inspect keys, profile configuration, and local daemon health.")
    .option("--json", "Print JSON output")
    .action(async (options: { json?: boolean }) => {
      await runDoctor(options);
    });

  const configGroup = program.command("config").description("Inspect or initialize CLI configuration.");
  configGroup.addCommand(buildConfigShowCommand());
  configGroup.addCommand(buildConfigInitCommand());

  program.addHelpText(
    "after",
    `
Command groups:
  Scraping: gologin-web-access scrape|scrape-markdown|scrape-text|scrape-json|batch-scrape|search|map|crawl
  Browser:  gologin-web-access open|snapshot|click|type|screenshot|close|sessions|current

Key model:
  ${"GOLOGIN_WEB_UNLOCKER_API_KEY"} powers scraping commands.
  ${"GOLOGIN_CLOUD_TOKEN"} powers browser commands.
`,
  );

  await program.parseAsync(process.argv);
}

void main().catch((error) => {
  const cliError = toCliError(error);
  printError(cliError);
  process.exit(cliError.exitCode);
});
