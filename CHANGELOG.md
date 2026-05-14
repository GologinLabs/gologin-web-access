# Changelog

## Unreleased

- browser automation is now embedded directly in `gologin-web-access`, so one repo and one install contains both Scraping API and Cloud Browser flows
- doctor now reports the embedded browser runtime source and version

## 0.3.5 - 2026-05-14

- renamed the internal stateless scraping layer from Web Unlocker to Scraping API
- config files now write `scrapingApiKey`, while legacy `webUnlockerApiKey` configs and old env aliases still load
- `renderSource` and search transport values now use `scraping`; `unlocker` remains accepted as a legacy `--source` alias

## 0.3.2 - 2026-04-03

- added unified page outcome classification across `read`, `scrape-json`, and `batch-scrape`
- structured and readable paths now distinguish `ok`, `empty`, `incomplete`, `authwall`, `challenge`, `blocked`, and `cookie_wall`
- batch and extract-oriented flows now propagate next-step hints and fallback metadata more consistently for agents

## 0.1.0 - 2026-03-10

Initial public release of Gologin Web Access.

Highlights:

- Unified CLI entry point for GoLogin Scraping API and Gologin Cloud Browser workflows
- Scraping commands: `scrape`, `scrape-markdown`, `scrape-text`, `scrape-json`, `batch-scrape`
- Browser commands: `open`, `snapshot`, `click`, `type`, `screenshot`, `close`, `sessions`, `current`
- Clear two-key configuration model with `GOLOGIN_SCRAPING_API_KEY` and `GOLOGIN_TOKEN`
- `doctor`, `config show`, and `config init` to reduce setup friction
- Compatibility support for legacy env names used by existing Gologin tools
