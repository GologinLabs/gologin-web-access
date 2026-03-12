import path from "path";
import { randomUUID } from "crypto";
import { Command } from "commander";
import { loadConfig, requireCloudToken, resolveProfileId } from "../config";
import { runAgentCommandCapture } from "../lib/agentCli";

export function buildScrapeScreenshotCommand(): Command {
  return new Command("scrape-screenshot")
    .description("Capture a full-page screenshot of a URL through Gologin Cloud Browser in one command.")
    .argument("<url>", "URL to capture")
    .argument("[outputPath]", "Destination PNG path")
    .option("--profile <id>", "Gologin profile ID to use")
    .option("--annotate", "Annotate the screenshot with snapshot refs")
    .option("--press-escape", "Press Escape before capturing")
    .option("--keep-open", "Leave the browser session open instead of auto-closing it")
    .action(
      async (
        url: string,
        outputPath: string | undefined,
        options: {
          profile?: string;
          annotate?: boolean;
          pressEscape?: boolean;
          keepOpen?: boolean;
        },
      ) => {
        const config = await loadConfig();
        requireCloudToken(config);

        const sessionId = `shot-${randomUUID().slice(0, 8)}`;
        const resolvedProfile = resolveProfileId(config, options.profile);
        const resolvedOutputPath = path.resolve(outputPath ?? defaultScreenshotPath(url));
        const openArgs = ["open", url, "--session", sessionId];
        if (resolvedProfile) {
          openArgs.push("--profile", resolvedProfile);
        }

        const screenshotArgs = ["screenshot", resolvedOutputPath, "--session", sessionId];
        if (options.annotate) {
          screenshotArgs.push("--annotate");
        }
        if (options.pressEscape) {
          screenshotArgs.push("--press-escape");
        }

        const openResult = await runAgentCommandCapture(openArgs, config);
        if (openResult.exitCode !== 0) {
          throw new Error(openResult.stderr || openResult.stdout || "Failed to open Cloud Browser session");
        }

        try {
          const shotResult = await runAgentCommandCapture(screenshotArgs, config);
          if (shotResult.exitCode !== 0) {
            throw new Error(shotResult.stderr || shotResult.stdout || "Failed to capture screenshot");
          }
          process.stdout.write(`${resolvedOutputPath}\n`);
        } finally {
          if (!options.keepOpen) {
            await runAgentCommandCapture(["close", "--session", sessionId], config).catch(() => undefined);
          }
        }
      },
    );
}

function defaultScreenshotPath(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/[^a-z0-9.-]+/gi, "-");
    return `${hostname || "page"}.png`;
  } catch {
    return "page.png";
  }
}
