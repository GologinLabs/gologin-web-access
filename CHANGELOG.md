# Changelog

## Unreleased

- doctor now reports which Agent Browser CLI backend will be used, including source and version when available
- package dependency now targets `gologin-agent-browser-cli@^0.1.4`

## 0.1.0 - 2026-03-10

Initial public release of Gologin Web Access.

Highlights:

- Unified CLI entry point for Gologin Web Unlocker and Gologin Cloud Browser workflows
- Scraping commands: `scrape`, `scrape-markdown`, `scrape-text`, `scrape-json`, `batch-scrape`
- Browser commands: `open`, `snapshot`, `click`, `type`, `screenshot`, `close`, `sessions`, `current`
- Clear two-key configuration model with `GOLOGIN_WEB_UNLOCKER_API_KEY` and `GOLOGIN_CLOUD_TOKEN`
- `doctor`, `config show`, and `config init` to reduce setup friction
- Compatibility support for legacy env names used by existing Gologin tools
