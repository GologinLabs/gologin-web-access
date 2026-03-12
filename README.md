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

The point of the unified CLI is that both modes live in one product with one command surface and one config model, while still being honest about which credential powers which workflow.

## Command Groups

### Scraping / Read

These commands use Gologin Web Unlocker:

- `gologin-web-access scrape <url>`
- `gologin-web-access scrape-markdown <url>`
- `gologin-web-access scrape-text <url>`
- `gologin-web-access scrape-json <url>`
- `gologin-web-access batch-scrape <url...> [--format html|markdown|text|json]`
- `gologin-web-access search <query> [--limit <n>] [--country <cc>] [--language <lang>] [--source auto|unlocker|browser]`
- `gologin-web-access map <url> [--limit <n>] [--max-depth <n>] [--concurrency <n>] [--strict]`
- `gologin-web-access crawl <url> [--format html|markdown|text|json] [--limit <n>] [--max-depth <n>] [--strict]`
- `gologin-web-access crawl-start <url> ...`
- `gologin-web-access crawl-status <jobId>`
- `gologin-web-access crawl-result <jobId>`
- `gologin-web-access crawl-errors <jobId>`
- `gologin-web-access extract <url> --schema <schema.json>`
- `gologin-web-access change-track <url> [--format html|markdown|text|json]`
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
- Use `search` when you need web discovery or SERP results before deciding what to scrape. It now tries multiple search paths automatically, validates that the response is a real SERP, and reuses a short local cache for repeated queries.
- Use `map` when you need internal link discovery or a site inventory.
- Use `crawl` when you need multi-page read-only extraction across a site.
- Use `crawl-start` plus `crawl-status` and `crawl-result` when the crawl should run detached.
- Use `extract` when you want deterministic structured output from CSS selectors rather than generic page summaries.
- Use `change-track` when you want local change detection against the last stored snapshot of a page.
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

This CLI uses two different Gologin credentials on purpose, because the underlying products are different.

- `GOLOGIN_WEB_UNLOCKER_API_KEY`
  Required for Scraping / Read commands.
- `GOLOGIN_CLOUD_TOKEN`
  Required for `gologin-web-access open` and for profile validation in `gologin-web-access doctor`.
- `GOLOGIN_DEFAULT_PROFILE_ID`
  Optional default profile for browser flows.
- `GOLOGIN_DAEMON_PORT`
  Optional local daemon port for browser workflows.

Missing-key errors are command-group specific. Example:

`Missing GOLOGIN_WEB_UNLOCKER_API_KEY. This is required for scraping commands like \`gologin-web-access scrape\`.`

Environment variables are the primary configuration mechanism:

```bash
export GOLOGIN_WEB_UNLOCKER_API_KEY="wu_..."
export GOLOGIN_CLOUD_TOKEN="gl_..."
export GOLOGIN_DEFAULT_PROFILE_ID="profile_123"
export GOLOGIN_DAEMON_PORT="4590"
```

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
- `GOLOGIN_TOKEN`
- `GOLOGIN_PROFILE_ID`

Useful config commands:

```bash
gologin-web-access config init
gologin-web-access config show
gologin-web-access doctor
```

`doctor` reports the embedded Cloud Browser runtime bundled inside this package and whether the local daemon is reachable.

## Install

```bash
npm install -g gologin-web-access
```

## Quickstart

### Read A Page

```bash
export GOLOGIN_WEB_UNLOCKER_API_KEY="wu_..."

gologin-web-access scrape https://example.com
gologin-web-access scrape-markdown https://example.com/docs
gologin-web-access batch-scrape https://example.com https://example.org --format json
gologin-web-access search "gologin antidetect browser" --limit 5
gologin-web-access search "gologin antidetect browser" --limit 5 --source auto
gologin-web-access map https://example.com --limit 50 --max-depth 2
gologin-web-access crawl https://example.com --format markdown --limit 20 --max-depth 2
gologin-web-access crawl-start https://example.com --limit 20 --max-depth 2
gologin-web-access extract https://example.com --schema ./schema.json
gologin-web-access change-track https://example.com --format markdown
gologin-web-access parse-document ./example.pdf
```

### Interact With A Site

```bash
export GOLOGIN_CLOUD_TOKEN="gl_..."
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
export GOLOGIN_CLOUD_TOKEN="gl_..."

gologin-web-access search-browser "gologin antidetect browser"
gologin-web-access snapshot -i
```

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
