#!/usr/bin/env node
import { Command } from "commander";
import { buildBatchScrapeCommand } from "./commands/batchScrape";
import { buildCheckCommand } from "./commands/check";
import { buildCrawlCommand } from "./commands/crawl";
import { buildClickCommand } from "./commands/click";
import { buildCloseCommand } from "./commands/close";
import { buildConfigInitCommand } from "./commands/configInit";
import { buildConfigShowCommand } from "./commands/configShow";
import { buildCurrentCommand } from "./commands/current";
import { buildDoubleClickCommand } from "./commands/dblclick";
import { buildFillCommand } from "./commands/fill";
import { buildFindCommand } from "./commands/find";
import { buildFocusCommand } from "./commands/focus";
import { buildGetCommand } from "./commands/get";
import { buildHoverCommand } from "./commands/hover";
import { buildMapCommand } from "./commands/map";
import { buildOpenCommand } from "./commands/open";
import { buildPdfCommand } from "./commands/pdf";
import { buildPressCommand } from "./commands/press";
import { buildScrapeCommand } from "./commands/scrape";
import { buildScrapeJsonCommand } from "./commands/scrapeJson";
import { buildScrapeMarkdownCommand } from "./commands/scrapeMarkdown";
import { buildScrapeTextCommand } from "./commands/scrapeText";
import { buildScrollCommand } from "./commands/scroll";
import { buildScrollIntoViewCommand } from "./commands/scrollIntoView";
import { buildSearchBrowserCommand } from "./commands/searchBrowser";
import { buildSearchCommand } from "./commands/search";
import { buildSelectCommand } from "./commands/select";
import { buildScreenshotCommand } from "./commands/screenshot";
import { buildSessionsCommand } from "./commands/sessions";
import { buildSnapshotCommand } from "./commands/snapshot";
import { buildUncheckCommand } from "./commands/uncheck";
import { buildTypeCommand } from "./commands/type";
import { buildUploadCommand } from "./commands/upload";
import { buildWaitCommand } from "./commands/wait";
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
  program.addCommand(buildSearchBrowserCommand());
  program.addCommand(buildSnapshotCommand());
  program.addCommand(buildClickCommand());
  program.addCommand(buildDoubleClickCommand());
  program.addCommand(buildFocusCommand());
  program.addCommand(buildTypeCommand());
  program.addCommand(buildFillCommand());
  program.addCommand(buildHoverCommand());
  program.addCommand(buildSelectCommand());
  program.addCommand(buildCheckCommand());
  program.addCommand(buildUncheckCommand());
  program.addCommand(buildPressCommand());
  program.addCommand(buildScrollCommand());
  program.addCommand(buildScrollIntoViewCommand());
  program.addCommand(buildWaitCommand());
  program.addCommand(buildGetCommand());
  program.addCommand(buildFindCommand());
  program.addCommand(buildUploadCommand());
  program.addCommand(buildPdfCommand());
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
  Browser:  gologin-web-access open|search-browser|snapshot|click|dblclick|focus|type|fill|hover|select|check|uncheck|press|scroll|scrollintoview|wait|get|find|upload|pdf|screenshot|close|sessions|current

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
