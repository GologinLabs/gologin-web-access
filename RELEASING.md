# Releasing Gologin Web Access

## Before first public publish

1. Make sure the npm package name is still available:
   `npm view gologin-web-access version`
2. Make sure you are logged in to npm:
   `npm whoami`
3. If this project gets a public repository, add `repository` and `bugs` fields to `package.json`.
4. If publishing from GitHub Actions, add an `NPM_TOKEN` secret to the repository.
5. Publish `gologin-agent-browser-cli` and `gologin-web-access` as separate packages. `gologin-web-access` shells out to `gologin-agent-browser` from `PATH`.

## Local release checklist

1. Update `package.json` version.
2. Add the release entry to `CHANGELOG.md`.
3. Run:
   `npm install`
4. Run:
   `npm run release:check`
5. Smoke-check help output:
   `node dist/cli.js --help`
6. Smoke-check diagnostics:
   `node dist/cli.js doctor`
7. Publish:
   `npm publish --access public`

## Automated publish

The repository includes GitHub Actions workflows:

- `.github/workflows/ci.yml`
- `.github/workflows/publish.yml`

Suggested flow:

1. Push to the default branch and let CI pass.
2. Publish `gologin-agent-browser-cli` from the `agent-browser` repo.
3. Create a version tag such as `v0.1.0`.
4. Push the tag.
5. GitHub Actions publishes to npm using `NPM_TOKEN`.
6. Repeat for `gologin-web-access`.

## Notes

- The published npm package name is `gologin-web-access`.
- The installed command is `gologin-web-access`.
- Browser automation requires the `gologin-agent-browser` command to be installed on `PATH`.
- Recommended install is `npm install -g gologin-agent-browser-cli gologin-web-access`.
- GitHub installs work with `npm install -g github:GologinLabs/agent-browser github:GologinLabs/gologin-web-access`.
- Web Unlocker support is embedded in this package and does not require a second npm package.
