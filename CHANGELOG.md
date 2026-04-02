# Changelog

## Unreleased

- browser automation is now embedded directly in `gologin-web-access`, so one repo and one install contains both Web Unlocker and Cloud Browser flows
- doctor now reports the embedded browser runtime source and version

## 0.3.2 - 2026-04-03

- added unified page outcome classification across `read`, `scrape-json`, and `batch-scrape`
- structured and readable paths now distinguish `ok`, `empty`, `incomplete`, `authwall`, `challenge`, `blocked`, and `cookie_wall`
- batch and extract-oriented flows now propagate next-step hints and fallback metadata more consistently for agents

## 0.1.0 - 2026-03-10

Initial public release of Gologin Web Access.

Highlights:

- Unified CLI entry point for Gologin Web Unlocker and Gologin Cloud Browser workflows
- Scraping commands: `scrape`, `scrape-markdown`, `scrape-text`, `scrape-json`, `batch-scrape`
- Browser commands: `open`, `snapshot`, `click`, `type`, `screenshot`, `close`, `sessions`, `current`
- Clear two-key configuration model with `GOLOGIN_WEB_UNLOCKER_API_KEY` and `GOLOGIN_TOKEN`
- `doctor`, `config show`, and `config init` to reduce setup friction
- Compatibility support for legacy env names used by existing Gologin tools
