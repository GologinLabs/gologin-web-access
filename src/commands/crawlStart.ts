import { Command } from "commander";
import { loadConfig, requireWebUnlockerKey } from "../config";
import { createJob } from "../lib/jobRegistry";
import { spawnDetachedNodeInvocation } from "../lib/selfCli";

export function buildCrawlStartCommand(): Command {
  return new Command("crawl-start")
    .description("Start a detached crawl job and return a local job id.")
    .argument("<url>", "Root website URL to crawl")
    .option("--format <format>", "html, markdown, text, or json", "markdown")
    .option("--limit <count>", "Maximum number of pages to visit", "25")
    .option("--max-depth <depth>", "Maximum link depth from the root URL", "2")
    .option("--concurrency <count>", "Number of concurrent requests", "4")
    .option("--include-subdomains", "Include subdomains inside the crawl scope")
    .option("--include <patterns>", "Comma-separated URL patterns to include")
    .option("--exclude <patterns>", "Comma-separated URL patterns to exclude")
    .option("--ignore-query", "Normalize URLs without query parameters")
    .option("--sitemap <mode>", "include, only, or skip", "include")
    .action(
      async (
        url: string,
        options: {
          format: string;
          limit: string;
          maxDepth: string;
          concurrency: string;
          includeSubdomains?: boolean;
          include?: string;
          exclude?: string;
          ignoreQuery?: boolean;
          sitemap: string;
        },
      ) => {
        const config = await loadConfig();
        requireWebUnlockerKey(config);

        const args = buildCrawlArgs(url, options);
        const job = await createJob(config, {
          kind: "crawl",
          name: url,
          cwd: process.cwd(),
          args
        });

        await spawnDetachedNodeInvocation("jobRunner", [job.jobId, ...args], {
          cwd: process.cwd()
        });

        process.stdout.write(`${job.jobId}\n`);
      },
    );
}

function buildCrawlArgs(
  url: string,
  options: {
    format: string;
    limit: string;
    maxDepth: string;
    concurrency: string;
    includeSubdomains?: boolean;
    include?: string;
    exclude?: string;
    ignoreQuery?: boolean;
    sitemap: string;
  },
): string[] {
  const args = ["crawl", url, "--format", options.format, "--limit", options.limit, "--max-depth", options.maxDepth, "--concurrency", options.concurrency, "--sitemap", options.sitemap];
  if (options.includeSubdomains) {
    args.push("--include-subdomains");
  }
  if (options.include) {
    args.push("--include", options.include);
  }
  if (options.exclude) {
    args.push("--exclude", options.exclude);
  }
  if (options.ignoreQuery) {
    args.push("--ignore-query");
  }

  return args;
}
