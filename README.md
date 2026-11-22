# TW Forge Documentation

Multi-language documentation for TW Forge using Antora and GitHub Pages.

## Languages

- **English** (default): `docs-en/` → `/en/`
- **German**: `docs-de/` → `/de/`

URLs are versionless for cleaner paths (e.g., `/en/index.html` instead of `/en/1.0/index.html`).

## Prerequisites

- Node.js 24 or higher (CI uses Node.js 26, the current LTS)
- npm 11.10 or higher: required for `min-release-age` in `.npmrc`. `devEngines` in `package.json` makes npm 10.9+ stop
  with `EBADDEVENGINES` if it is older; update with `npm install -g npm@11`.

## Local Development

### Install dependencies

```bash
npm install
```

`.npmrc` hardens all npm commands in this repo: dependency install scripts are not run (`ignore-scripts`), only
versions published at least 7 days ago are resolved (`min-release-age`, npm 11.10+), and git dependencies are refused
(`allow-git=none`). The `check-*-updates` scripts apply the same 7-day cooldown.

### Build the site

```bash
npm run build
```

The generated site will be in `build/site/`.

### Preview locally

Open `build/site/index.html` in your browser, or use a local server:

```bash
npx http-server build/site -p 8080
```

Then visit http://localhost:8080

## Project Structure

```
docs/
├── .github/workflows/              # CI: PR build, PR title, Pages deployment, API contract release
├── developer-api/                  # OpenAPI contract, version.txt, CHANGELOG.md (+ npm package template in npm/,
│                                   #   Swagger UI page in swagger-ui/)
├── release-please-config.json      # Release configuration (+ .release-please-manifest.json)
├── .oasdiff.yaml, oasdiff-levels.txt  # API compatibility policy
├── scripts/api-contract.mjs        # API contract packaging and compatibility checks
├── antora-playbook.yml             # Antora configuration
├── antora-ui/ui-bundle.zip         # Vendored Antora Default UI (pinned, see antora-ui/README.md)
├── docs-en/                        # English documentation
│   ├── antora.yml
│   └── modules/ROOT/
│       ├── nav.adoc
│       └── pages/
├── docs-de/                        # German documentation
│   ├── antora.yml
│   └── modules/ROOT/
│       ├── nav.adoc
│       └── pages/
├── supplemental-ui/                # Custom UI components
│   └── partials/
│       └── header-content.hbs      # Language switcher
└── package.json
```

## Adding Content

### Adding a new page

1. Create a new `.adoc` file in the appropriate `pages/` directory
2. Add the page to `nav.adoc` for navigation
3. Build and verify locally

### Adding a new language

1. Copy an existing language directory (e.g., `docs-en` → `docs-fr`)
2. Update `antora.yml` with the new component name (e.g., `fr`) and title
3. Add the new path to `antora-playbook.yml` under `content.sources.start_paths`
4. Update the language switcher in `supplemental-ui/partials/header-content.hbs`:
   - Add a new link in the dropdown
   - Update the regex in `switchLang()` to include the new language code

## Deployment

The documentation is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

### GitHub Pages Setup

1. Go to repository Settings > Pages
2. Under "Build and deployment", select "GitHub Actions"
3. Push changes to the `main` branch to trigger deployment

## Developer API Contract

`developer-api/openapi.yaml` is the service contract of the TW Forge Developer API. Besides being rendered on
GitHub Pages, it is released as the versioned npm package
[`@twforge/developer-api`](https://www.npmjs.com/package/@twforge/developer-api), which contains the bundled spec
(`openapi.yaml`, `openapi.json`) and generated TypeScript types. Consumers (e.g. userscripts) depend on it like on any
other npm package.

### Versioning

The contract is versioned with semver. Its major version always equals the API path version (`/api/v1` → `1.x.y`):
**breaking changes are never allowed within an API version**.

Versions are not edited by hand. [release-please](https://github.com/googleapis/release-please) derives them from the
commit messages of changes to `developer-api/`, which follow [Conventional Commits](https://www.conventionalcommits.org/).
PRs are squash-merged with the PR title as commit message, and the `PR Title` check enforces the format.

| Change | PR title | Bump |
|---|---|---|
| Backwards-compatible addition (new endpoint, new optional field, ...) | `feat: ...` | minor |
| Correction of the spec that keeps compatibility | `fix: ...` | patch |
| No change to the API's shape (descriptions, examples, metadata, typo fixes) | `docs: ...` | patch |
| Breaking or potentially breaking (removed endpoint/parameter/field, new required parameter, narrowed type, ...) | not allowed | needs a new API version (`/api/v2`) with its own spec file |

Other types (`chore:`, `ci:`, `build:`, ...) don't trigger a release. Never use `!` (`feat!:`) or a `BREAKING CHANGE`
footer: release-please would propose a new major version, and the release PR's checks would fail. If that happens,
merge a `chore:` PR that sets `"release-as": "X.Y.Z"` for `developer-api` in `release-please-config.json`;
release-please then updates the release PR to that version. Remove the setting again after the release.

The PR build checks the spec with [oasdiff](https://github.com/oasdiff/oasdiff) against the base branch (the
merge-base with `main`). As every change to `main` passes this check, `main` stays compatible with all earlier
releases. The build fails if

- the major version of `info.version` does not match the `/api/vN` path in `servers`, or differs from the base branch,
- `info.version` differs from `developer-api/version.txt` (both are only changed by release-please),
- the contract contains breaking (oasdiff ERR) or potentially breaking (oasdiff WARN) changes,
- the spec contains `x-sunset` (lint rule in `redocly.yaml`).

In the PR, each finding is shown as an annotation on the affected line of `openapi.yaml`.

Endpoints, parameters and fields can be marked `deprecated: true` to steer consumers away from them, but they stay
until the next API version. Removing them is a breaking change, even when deprecated (oasdiff would normally accept
such removals; `.oasdiff.yaml` and `oasdiff-levels.txt` turn them into errors). `x-sunset` is forbidden because oasdiff
silently accepts removals after a sunset date.

Corrections that change the documented shape to match how the API actually behaves are checked like any other change:
if oasdiff flags one as breaking, it needs a new API version, or an explicit entry in an `err-ignore`/`warn-ignore`
file (enabled in `.oasdiff.yaml`) stating why it is acceptable. The same applies to false positives.

### Building locally

```bash
npm run api:build          # lint + api:package (bundle, generate types -> build/developer-api-package/)
npm run api:check-compat   # api:package + checks; requires oasdiff on PATH; compares with origin/main
```

The PR build runs `api:ci`: `lint:api:ci` (same lint, reported as GitHub annotations) and `api:check-compat`. The
release build only builds and publishes the package. `info.version` is found by its `# x-release-please-version`
marker, which release-please also needs to update it; don't remove it.

The spec must stay a single file: `.oasdiff.yaml` refuses `$ref`s to other files, because the base spec is read from
git and external files would be resolved from the working tree instead.

### Releasing

Releases are made by the `Release API Contract` workflow with release-please:

1. After changes to `developer-api/` are merged, release-please opens (or updates) a release PR. It bumps
   `info.version` and `developer-api/version.txt` and adds the release notes to `developer-api/CHANGELOG.md`
   (generated, don't edit by hand). Changes to `developer-api/swagger-ui/` (the Swagger UI page on GitHub Pages, not
   part of the package) don't trigger a release.
2. Merging the release PR creates the tag `api-vX.Y.Z` and the GitHub release. The workflow then builds the package,
   attaches the package and spec to the release and stages the package on npm (`npm stage publish`, last, so a
   failure never leaves a staged version behind).
3. A maintainer approves the staged version with 2FA: on npmjs.com (package page → *Staged Packages*), or with
   `npm stage list @twforge/developer-api` and `npm stage approve <stage-id>`. Only then is it public. The workflow
   run's summary repeats these steps.

CI can never make a version public on its own: npm only lets it stage, and approving needs a maintainer's 2FA.

Nobody pushes `api-v*` tags by hand. If building or staging fails, use **Re-run failed jobs** (not "Re-run all
jobs", which would skip publishing because the release already exists). If a staged version is rejected
(`npm stage reject <stage-id>`), re-run the `publish` job of the release run to stage it again (within the 7-day
artifact retention). A published version is never changed or removed; mistakes are corrected with a new release.

### Repository setup

- **Merging:** allow only squash merges, with "Default to PR title for squash merge commits".
- **Branch protection for `main`:** require PRs and the `Build Documentation` and `PR Title` checks.
- **GitHub App for release-please:** create a GitHub App (no webhook) with the repository permissions *Contents*,
  *Pull requests* and *Issues* set to read and write, and install it on this repository. Store its client ID as the
  Actions variable `RELEASE_APP_CLIENT_ID` and a private key as the Actions secret `RELEASE_APP_PRIVATE_KEY`. With the
  default `GITHUB_TOKEN`, no checks would run on release PRs.
- **npm:** the workflow only stages versions (staged publishing, npm 11.15+); maintainers approve them with 2FA.
  - Configure trusted publishing for `@twforge/developer-api` on npmjs.com (package settings → *Trusted Publisher* →
    GitHub Actions): organization `twforge`, repository `docs`, workflow `release.yml`, no environment, allowed
    actions only `npm stage publish` (neither `npm publish` nor `npm dist-tag`). A new trusted publisher expires if
    it is not used within 2 days, so recreate it shortly before merging a release PR if it was never used.
  - *Publishing access*: "Require two-factor authentication and disallow tokens". No npm token is used anywhere.

## Resources

- [Antora Documentation](https://docs.antora.org/)
- [AsciiDoc Syntax](https://docs.asciidoctor.org/asciidoc/latest/syntax-quick-reference/)
- [Antora Default UI](https://gitlab.com/antora/antora-ui-default)
