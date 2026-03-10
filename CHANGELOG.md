# Changelog

## 0.1.0 - 2026-03-10

Initial public release of GoLogin Web Access.

Highlights:

- Unified CLI entry point for GoLogin Web Unlocker and GoLogin Cloud Browser workflows
- Scraping commands: `scrape`, `scrape-markdown`, `scrape-text`, `scrape-json`, `batch-scrape`
- Browser commands: `open`, `snapshot`, `click`, `type`, `screenshot`, `close`, `sessions`, `current`
- Clear two-key configuration model with `GOLOGIN_WEB_UNLOCKER_API_KEY` and `GOLOGIN_CLOUD_TOKEN`
- `doctor`, `config show`, and `config init` to reduce setup friction
- Compatibility support for legacy env names used by existing GoLogin tools
