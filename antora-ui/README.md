# Antora UI bundle

`ui-bundle.zip` is the [Antora Default UI](https://gitlab.com/antora/antora-ui-default), vendored so the site build is
reproducible and does not download code at build time. Our customizations live in `../supplemental-ui/`.

| | |
|---|---|
| Source commit | [`0e38223`](https://gitlab.com/antora/antora-ui-default/-/commit/0e38223adfd81eb74d4b1779e158f8ad05ff8923) (2026-07-16) |
| SHA-256 | `e0ac81aad26961a9cd3cf9bce692a598eff4a1bd2822ce73c9cdc13a15a1e70d` |

## Updating

```bash
curl -fsSL -o antora-ui/ui-bundle.zip \
  'https://gitlab.com/antora/antora-ui-default/-/jobs/artifacts/HEAD/raw/build/ui-bundle.zip?job=bundle-stable'
sha256sum antora-ui/ui-bundle.zip
```

Then update the commit and checksum above, build the site (`npm run build`), check that the supplemental UI
(e.g. the language switcher) still works, and open a PR.
