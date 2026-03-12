#!/usr/bin/env node
import { Command } from "commander";
import { buildBackCommand } from "./commands/back";
import { buildBatchCommand } from "./commands/batch";
import { buildBatchScrapeCommand } from "./commands/batchScrape";
import { buildCheckCommand } from "./commands/check";
import { buildChangeTrackCommand } from "./commands/changeTrack";
import { buildCrawlCommand } from "./commands/crawl";
import { buildCrawlErrorsCommand } from "./commands/crawlErrors";
import { buildCrawlResultCommand } from "./commands/crawlResult";
import { buildCrawlStartCommand } from "./commands/crawlStart";
import { buildCrawlStatusCommand } from "./commands/crawlStatus";
import { buildClickCommand } from "./commands/click";
import { buildCloseCommand } from "./commands/close";
import { buildConfigInitCommand } from "./commands/configInit";
import { buildConfigShowCommand } from "./commands/configShow";
import { buildCookiesCommand } from "./commands/cookies";
import { buildCookiesClearCommand } from "./commands/cookiesClear";
import { buildCookiesImportCommand } from "./commands/cookiesImport";
import { buildCurrentCommand } from "./commands/current";
import { buildDoubleClickCommand } from "./commands/dblclick";
import { buildEvalCommand } from "./commands/eval";
import { buildExtractCommand } from "./commands/extract";
import { buildFillCommand } from "./commands/fill";
import { buildFindCommand } from "./commands/find";
import { buildFocusCommand } from "./commands/focus";
import { buildForwardCommand } from "./commands/forward";
import { buildGetCommand } from "./commands/get";
import { buildHoverCommand } from "./commands/hover";
import { buildJobCommand, buildJobsCommand } from "./commands/jobs";
import { buildMapCommand } from "./commands/map";
import { buildOpenCommand } from "./commands/open";
import { buildParseDocumentCommand } from "./commands/parseDocument";
import { buildPdfCommand } from "./commands/pdf";
import { buildPressCommand } from "./commands/press";
import { buildReloadCommand } from "./commands/reload";
import { buildRunCommand } from "./commands/run";
import { buildScrapeCommand } from "./commands/scrape";
import { buildScrapeJsonCommand } from "./commands/scrapeJson";
import { buildScrapeMarkdownCommand } from "./commands/scrapeMarkdown";
import { buildScrapeScreenshotCommand } from "./commands/scrapeScreenshot";
import { buildScrapeTextCommand } from "./commands/scrapeText";
import { buildScrollCommand } from "./commands/scroll";
import { buildScrollIntoViewCommand } from "./commands/scrollIntoView";
import { buildSearchBrowserCommand } from "./commands/searchBrowser";
import { buildSearchCommand } from "./commands/search";
import { buildSelectCommand } from "./commands/select";
import { buildScreenshotCommand } from "./commands/screenshot";
import { buildSessionsCommand } from "./commands/sessions";
import { buildSnapshotCommand } from "./commands/snapshot";
import { buildStorageClearCommand } from "./commands/storageClear";
import { buildStorageExportCommand } from "./commands/storageExport";
import { buildStorageImportCommand } from "./commands/storageImport";
import { buildTabCloseCommand } from "./commands/tabClose";
import { buildTabFocusCommand } from "./commands/tabFocus";
import { buildTabOpenCommand } from "./commands/tabOpen";
import { buildTabsCommand } from "./commands/tabs";
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
  program.addCommand(buildCrawlStartCommand());
  program.addCommand(buildCrawlStatusCommand());
  program.addCommand(buildCrawlResultCommand());
  program.addCommand(buildCrawlErrorsCommand());
  program.addCommand(buildExtractCommand());
  program.addCommand(buildChangeTrackCommand());
  program.addCommand(buildParseDocumentCommand());
  program.addCommand(buildRunCommand());
  program.addCommand(buildBatchCommand());
  program.addCommand(buildJobsCommand());
  program.addCommand(buildJobCommand());

  program.addCommand(buildOpenCommand());
  program.addCommand(buildSearchBrowserCommand());
  program.addCommand(buildScrapeScreenshotCommand());
  program.addCommand(buildTabsCommand());
  program.addCommand(buildTabOpenCommand());
  program.addCommand(buildTabFocusCommand());
  program.addCommand(buildTabCloseCommand());
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
  program.addCommand(buildBackCommand());
  program.addCommand(buildForwardCommand());
  program.addCommand(buildReloadCommand());
  program.addCommand(buildFindCommand());
  program.addCommand(buildCookiesCommand());
  program.addCommand(buildCookiesImportCommand());
  program.addCommand(buildCookiesClearCommand());
  program.addCommand(buildStorageExportCommand());
  program.addCommand(buildStorageImportCommand());
  program.addCommand(buildStorageClearCommand());
  program.addCommand(buildEvalCommand());
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
  Scraping: gologin-web-access scrape|scrape-markdown|scrape-text|scrape-json|batch-scrape|search|map|crawl|crawl-start|crawl-status|crawl-result|crawl-errors|extract|change-track|parse-document
  Browser:  gologin-web-access open|search-browser|scrape-screenshot|tabs|tabopen|tabfocus|tabclose|snapshot|click|dblclick|focus|type|fill|hover|select|check|uncheck|press|scroll|scrollintoview|wait|get|back|forward|reload|find|cookies|cookies-import|cookies-clear|storage-export|storage-import|storage-clear|eval|upload|pdf|screenshot|close|sessions|current
  Agent:    gologin-web-access run|batch|jobs|job

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
