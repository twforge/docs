# TW Forge Documentation

Multi-language documentation for TW Forge using Antora and GitHub Pages.

## Languages

- **English** (default): `docs-en/` → `/en/`
- **German**: `docs-de/` → `/de/`

URLs are versionless for cleaner paths (e.g., `/en/index.html` instead of `/en/1.0/index.html`).

## Prerequisites

- Node.js 18 or higher
- npm

## Local Development

### Install dependencies

```bash
npm install
```

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
├── .github/workflows/publish.yml   # GitHub Actions deployment
├── antora-playbook.yml             # Antora configuration
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

## Resources

- [Antora Documentation](https://docs.antora.org/)
- [AsciiDoc Syntax](https://docs.asciidoctor.org/asciidoc/latest/syntax-quick-reference/)
- [Antora Default UI](https://gitlab.com/antora/antora-ui-default)
