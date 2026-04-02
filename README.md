# Gologin Web Access

Gologin Web Access lets developers and AI agents read and interact with the web using Gologin Web Unlocker and Gologin Cloud Browser.

This is a unified web access layer, not just a scraping tool and not just a browser automation tool.

- Read the web through stateless extraction APIs
- Interact with the web through stateful cloud browser sessions
- Carry Gologin’s browser-side strengths into those workflows: profiles, identity-aware browser sessions, cloud browser infrastructure, and Gologin’s profile/proxy stack when you run against a configured profile

Package name and binary are the same:

- npm package: `gologin-web-access`
- command: `gologin-web-access`

## What It Unifies

Gologin Web Access combines two existing product surfaces behind one CLI:

- Web Unlocker
  Stateless read and extraction. Best when you want page content quickly without maintaining a browser session.
- Cloud Browser
  Stateful interaction. Best when you need navigation, clicks, typing, screenshots, or multi-step flows that persist across commands.

The point of the unified CLI is that both modes live in one product with one command surface and one config model, while still being honest about which credential powers which workflow. Recommended setup is still to configure both credentials up front so agents do not stop to ask for missing keys mid-task.

## Command Groups

### Quick Picks

- `read` for "read this docs page/article" or "tell me what is on this page"
- `scrape-text` for plain text from one known page when you do not need headings/links metadata
- `scrape-json` for structured title, description, headings, and links from one known page
- `batch-scrape` for many known URLs at once; add `--output <path>` when the JSON may be large and add `--strict` only if partial success should fail the command

### Scraping / Read

These commands use Gologin Web Unlocker:

- `gologin-web-access scrape <url>`
- `gologin-web-access read <url> [--format text|markdown|html] [--source auto|unlocker|browser]`
- `gologin-web-access scrape-markdown <url> [--source auto|unlocker|browser]`
- `gologin-web-access scrape-text <url> [--source auto|unlocker|browser]`
- `gologin-web-access scrape-json <url> [--fallback none|browser]`
- `gologin-web-access batch-scrape <url...> [--format html|markdown|text|json] [--fallback none|browser] [--source auto|unlocker|browser] [--only-main-content] [--retry <n>] [--backoff-ms <ms>] [--summary] [--output <path>] [--strict]`
- `gologin-web-access batch-extract <url...> --schema <schema.json> [--source auto|unlocker|browser] [--retry <n>] [--backoff-ms <ms>] [--summary] [--output <path>]`
- `gologin-web-access search <query> [--limit <n>] [--country <cc>] [--language <lang>] [--source auto|unlocker|browser]`
- `gologin-web-access map <url> [--limit <n>] [--max-depth <n>] [--concurrency <n>] [--strict]`
- `gologin-web-access crawl <url> [--format html|markdown|text|json] [--limit <n>] [--max-depth <n>] [--only-main-content] [--strict]`
- `gologin-web-access crawl-start <url> ...`
- `gologin-web-access crawl-status <jobId>`
- `gologin-web-access crawl-result <jobId>`
- `gologin-web-access crawl-errors <jobId>`
- `gologin-web-access extract <url> --schema <schema.json> [--source auto|unlocker|browser]`
- `gologin-web-access change-track <url> [--format html|markdown|text|json]`
- `gologin-web-access batch-change-track <url...> [--format html|markdown|text|json] [--retry <n>] [--backoff-ms <ms>] [--summary] [--output <path>]`
- `gologin-web-access parse-document <url-or-path>`
- `gologin-web-access run <runbook.json>`
- `gologin-web-access batch <runbook.json> --targets <targets.json>`
- `gologin-web-access jobs`
- `gologin-web-access job <jobId>`

Use these when you want stateless page retrieval or extracted content.

### Browser / Interact

These commands use Gologin Cloud Browser through the local daemon-backed agent layer:

- `gologin-web-access open <url> [--profile <id>]`
- `gologin-web-access search-browser <query> [--profile <id>]`
- `gologin-web-access scrape-screenshot <url> [path] [--profile <id>]`
- `gologin-web-access tabs`
- `gologin-web-access tabopen [url]`
- `gologin-web-access tabfocus <index>`
- `gologin-web-access tabclose [index]`
- `gologin-web-access snapshot`
- `gologin-web-access click <ref>`
- `gologin-web-access dblclick <ref>`
- `gologin-web-access focus <ref>`
- `gologin-web-access type <ref> <text>`
- `gologin-web-access fill <ref> <text>`
- `gologin-web-access hover <ref>`
- `gologin-web-access select <ref> <value>`
- `gologin-web-access check <ref>`
- `gologin-web-access uncheck <ref>`
- `gologin-web-access press <key> [target]`
- `gologin-web-access scroll <direction> [pixels]`
- `gologin-web-access scrollintoview <ref>`
- `gologin-web-access wait <target|ms>`
- `gologin-web-access get <kind> [target]`
- `gologin-web-access back`
- `gologin-web-access forward`
- `gologin-web-access reload`
- `gologin-web-access find ...`
- `gologin-web-access cookies [--output <path>] [--json]`
- `gologin-web-access cookies-import <cookies.json>`
- `gologin-web-access cookies-clear`
- `gologin-web-access storage-export [path] [--scope <local|session|both>]`
- `gologin-web-access storage-import <storage.json> [--scope <local|session|both>] [--clear]`
- `gologin-web-access storage-clear [--scope <local|session|both>]`
- `gologin-web-access eval <expression>`
- `gologin-web-access upload <ref> <file...>`
- `gologin-web-access pdf <path>`
- `gologin-web-access screenshot <path>`
- `gologin-web-access close`
- `gologin-web-access sessions`
- `gologin-web-access current`

Use these when you need state, interaction, or multi-step browser flows.

## When To Use `scrape` vs `browser`

- Use `scrape` commands when you need page content, extracted text, markdown, or simple structured output.
- Use `read` as the default for docs and article reading when you want one high-level main-content command rather than choosing HTML/text/markdown yourself.
- Use `scrape-text` when you already know you want plain text.
- Use `scrape-json` when you want structured metadata and headings instead of full prose.
- Use `search` when you need web discovery or SERP results before deciding what to scrape. It now tries multiple search paths automatically, validates that the response is a real SERP, and reuses a short local cache for repeated queries.
- Use `map` when you need internal link discovery or a site inventory.
- Use `crawl` when you need multi-page read-only extraction across a site.
- Use `crawl-start` plus `crawl-status` and `crawl-result` when the crawl should run detached.
- Use `extract` when you want deterministic structured output from CSS selectors rather than generic page summaries.
- Use `batch-extract` when the same selector schema should run across many known URLs.
- Use `change-track` when you want local change detection against the last stored snapshot of a page.
- Use `batch-change-track` when you want to monitor a watchlist of pages in one pass.
- Use `parse-document` when the source is a PDF, DOCX, XLSX, HTML, or local document path instead of a normal HTML page.
- Use browser commands when you need clicks, forms, navigation, screenshots, sessions, or logged-in/profile-backed flows.
- Use browser commands when you need ref-based interaction, uploads, PDFs, semantic find flows, keyboard control, or a browser-visible search journey.
- Use `run` and `batch` when you want reusable workflows or multi-target execution on top of the CLI surface.
- Use `scrape` when stateless speed matters more than interaction.
- Use browser commands when the site requires state, continuity, or real browser behavior.

## Why This Is Not Just A Read-Only Crawler

The read layer matters, but this product is broader than a Firecrawl-like “read the page” use case.

What makes Gologin Web Access different is the ability to move from stateless extraction into stateful browser interaction without leaving the CLI:

- Browser sessions can run through Gologin Cloud Browser instead of a local one-off browser process.
- Browser workflows can use a Gologin profile via `--profile` or `GOLOGIN_DEFAULT_PROFILE_ID`.
- That gives the CLI access to Gologin’s identity/profile model and session layer, instead of stopping at raw fetches.
- When a configured profile carries proxy settings, those browser-side capabilities come from the Gologin browser stack rather than from a separate scraping-only pipeline.

This README only documents what the current CLI actually implements. It does not claim extra browser capabilities beyond the commands listed above.

## Command Structure Choice

The current CLI keeps commands flat:

- `gologin-web-access scrape ...`
- `gologin-web-access scrape-markdown ...`
- `gologin-web-access open ...`
- `gologin-web-access snapshot`

This is clearer right now than introducing a `browser` namespace such as `gologin-web-access browser open`.

Why:

- The command surface is still compact.
- Flat commands are shorter for both humans and AI agents.
- The read vs interact split is already explicit through the command names and documentation.

If the browser surface grows substantially later, a nested namespace may become worth adding. For the current product, flat commands are simpler.

## Credentials And Config

This CLI uses two different GoLogin credentials on purpose, because the underlying products are different.

- `GOLOGIN_WEB_UNLOCKER_API_KEY`
  Required for Scraping / Read commands.
- `GOLOGIN_TOKEN`
  Required for `gologin-web-access open` and for profile validation in `gologin-web-access doctor`.
- `GOLOGIN_DEFAULT_PROFILE_ID`
  Optional default profile for browser flows.
- `GOLOGIN_DAEMON_PORT`
  Optional local daemon port for browser workflows.

Recommended full setup for agents is to configure both `GOLOGIN_WEB_UNLOCKER_API_KEY` and `GOLOGIN_TOKEN` before starting work, even if the current task looks read-only or browser-only.

Missing-key errors are command-group specific. Example:

`Missing GOLOGIN_WEB_UNLOCKER_API_KEY. This is required for scraping commands like \`gologin-web-access scrape\`.`

Environment variables are the primary configuration mechanism:

```bash
export GOLOGIN_WEB_UNLOCKER_API_KEY="wu_..."
export GOLOGIN_TOKEN="gl_..."
export GOLOGIN_DEFAULT_PROFILE_ID="profile_123"
export GOLOGIN_DAEMON_PORT="4590"
```

If you do not want to `source ~/.zprofile` in every shell, run:

```bash
gologin-web-access config init
```

Useful variants:

```bash
gologin-web-access config init --web-unlocker-api-key wu_... --token gl_...
gologin-web-access config init --web-unlocker-key wu_... --token gl_...
```

That writes `~/.gologin-web-access/config.json` once and the CLI will keep reading it on later runs.
By default `config init` also validates both keys immediately so you find bad credentials during setup instead of on the first real request. Use `--no-validate` only when you intentionally want an offline write.

You can also write a minimal config file at `~/.gologin-web-access/config.json`:

```json
{
  "webUnlockerApiKey": "wu_...",
  "cloudToken": "gl_...",
  "defaultProfileId": "profile_123",
  "daemonPort": 4590
}
```

Gologin Web Access will also read the older path `~/.gologin-web/config.json` if it already exists, but new config writes go to `~/.gologin-web-access/config.json`.

Backward-compatible aliases are also accepted for existing setups:

- `GOLOGIN_WEBUNLOCKER_API_KEY`
- `GOLOGIN_CLOUD_TOKEN`
- `GOLOGIN_PROFILE_ID`

Useful config commands:

```bash
gologin-web-access version
gologin-web-access config init
gologin-web-access config show
gologin-web-access doctor
```

`doctor` reports the embedded Cloud Browser runtime bundled inside this package, whether the local daemon is reachable, and whether the recommended two-key setup is complete.

## Install

```bash
npm install -g gologin-web-access
```

## Quickstart

### Read A Page

```bash
export GOLOGIN_WEB_UNLOCKER_API_KEY="wu_..."

gologin-web-access scrape https://example.com
gologin-web-access read https://docs.browserbase.com/features/stealth-mode
gologin-web-access scrape-markdown https://example.com/docs
gologin-web-access scrape-text https://docs.browserbase.com/features/stealth-mode
gologin-web-access scrape-json https://example.com --fallback browser
gologin-web-access batch-scrape https://docs.browserbase.com/features/contexts https://docs.browserbase.com/features/proxies --format text --only-main-content --summary
gologin-web-access batch-extract https://example.com https://www.iana.org/help/example-domains --schema ./schema.json --summary --output ./artifacts/extract.json
gologin-web-access search "gologin antidetect browser" --limit 5
gologin-web-access search "gologin antidetect browser" --limit 5 --source auto
gologin-web-access map https://example.com --limit 50 --max-depth 2
gologin-web-access crawl https://docs.browserbase.com --format text --limit 20 --max-depth 2 --only-main-content
gologin-web-access crawl-start https://example.com --limit 20 --max-depth 2
gologin-web-access extract https://example.com --schema ./schema.json
gologin-web-access change-track https://example.com --format markdown
gologin-web-access batch-change-track https://example.com https://example.org --format text --summary --output ./artifacts/watchlist.json
gologin-web-access parse-document ./example.pdf
```

### Interact With A Site

```bash
export GOLOGIN_TOKEN="gl_..."
export GOLOGIN_DEFAULT_PROFILE_ID="profile_123"

gologin-web-access open https://example.com
gologin-web-access tabs
gologin-web-access snapshot
gologin-web-access click e3
gologin-web-access type e5 "search terms"
gologin-web-access wait 1500
gologin-web-access get title
gologin-web-access eval "document.title"
gologin-web-access cookies --output ./cookies.json
gologin-web-access storage-export ./storage.json
gologin-web-access screenshot ./page.png
gologin-web-access current
gologin-web-access close
```

### Search In A Real Browser

```bash
export GOLOGIN_TOKEN="gl_..."

gologin-web-access search-browser "gologin antidetect browser"
gologin-web-access snapshot -i
```

## Structured Output And Retry Controls

- `scrape-markdown` and `scrape-text` now default to `--source auto`: they start with Unlocker, isolate the most readable content block, and can auto-retry with Cloud Browser when the output still looks like JS-rendered docs chrome.
- `read` is the shortest path for "look at this docs page" work: it targets the most readable content block and defaults to `--format text --source auto`.
- `scrape-markdown` and `scrape-text` also accept `--source unlocker` and `--source browser` when you want to force one path.
- `extract` now accepts `--source auto|unlocker|browser` and returns `renderSource`, fallback flags, and request metadata with the extracted JSON.
- `batch-extract` reuses the same extraction path across many URLs and returns one structured result per URL, including request and fallback metadata. Add `--output <path>` to save the full array directly.
- `scrape-json` now returns both a flat `headings` array and `headingsByLevel` buckets for `h1` through `h6`.
- `scrape-json --fallback browser` is available for JS-heavy pages where stateless extraction returns weak heading data.
- `scrape-json` now also classifies the page outcome as `ok`, `empty`, `incomplete`, `authwall`, `challenge`, `blocked`, or `cookie_wall`, and includes `nextActionHint` when the result is weak or gated.
- `scrape`, `scrape-markdown`, `scrape-text`, `scrape-json`, and `batch-scrape` accept `--retry`, `--backoff-ms`, and `--timeout-ms`.
- `batch-scrape --only-main-content` lets markdown, text, and html batch runs use the same readable-content isolation path as `read`.
- `crawl --only-main-content` uses the same readable-fragment extraction strategy for html, markdown, and text crawl output, but stays on the stateless unlocker path.
- `batch-scrape --summary` prints a one-line success/failure summary to `stderr` after the JSON payload.
- `batch-scrape` now returns exit code `0` on partial success by default and only fails the command when every URL failed. Add `--strict` if any single failed URL should make the whole batch exit non-zero.
- `batch-scrape --output <path>` writes the full JSON to disk so shells and agent consoles cannot truncate a large payload silently.
- `batch-scrape --format json` now returns the same structured scrape envelope as `scrape-json`, including `renderSource`, `fallbackAttempted`, `fallbackUsed`, and `request.attemptCount/retryCount/attempts`.
- `batch-scrape --only-main-content` now propagates `outcome`, `outcomeReason`, `nextActionHint`, and fallback metadata per URL so agents can tell "weak page" from "gated page" without scraping log text.
- `scrape-json` now surfaces explicit `BLOCKED_PAGE` failures when structured output clearly matches a challenge or block page, instead of silently looking like a valid empty result.
- `search` now returns `requestedLimit`, `returnedCount`, `warnings`, `cacheTtlMs`, and per-result `position`.
- `search` may return fewer results than the requested `--limit` when the upstream SERP contains fewer valid results; inspect `returnedCount`, `warnings`, and `attempts`.
- `change-track` now accepts `--retry`, `--backoff-ms`, and `--timeout-ms`, and JSON output includes request metadata.
- `batch-change-track` tracks many pages in one pass and reports per-URL `new|same|changed` status plus a summary line when `--summary` is used. Add `--output <path>` to save the full watchlist result directly.

### Reusable Workflows

```bash
gologin-web-access run ./examples/runbook.json --session s1
gologin-web-access batch ./examples/runbook.json --targets ./examples/targets.json --concurrency 2
gologin-web-access jobs
```

`snapshot` prints refs such as `e1`, `e2`, `e3`. Those refs stay valid until the page changes or you take a new snapshot.

`map` and `crawl` now return `status: ok|partial|failed`. By default, partial results stay usable and do not exit non-zero. Add `--strict` when any failed page should fail the command.

## Product Boundaries

Gologin Web Access still has two runtime layers:

- Web Unlocker for stateless read and extraction
- Cloud Browser for stateful interaction

But both are now shipped inside the same package and the same repository. One install gives you the full read layer and the full browser/session layer.

## Development

```bash
npm install
npm run build
npm run typecheck
npm test
```

## Publish

```bash
npm publish --access public
```

Prepublish checks run automatically through `prepublishOnly`.
