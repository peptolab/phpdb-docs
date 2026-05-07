# phpdb-docs

Unified documentation site for the [php-db](https://github.com/php-db) packages, built with [Astro Starlight](https://starlight.astro.build/) and deployed to GitHub Pages.

The site stitches together docs from five upstream package repos at build time. Manual top-level pages live in this repo; per-package content is fetched fresh on every build and is **not committed**.

## How it works

- `packages.config.mjs` — curated list of packages, branches, and source paths.
- `scripts/sync-docs.mjs` — fetches each package as a tarball, extracts its docs, and emits a Starlight sidebar fragment.
- `astro.config.mjs` — merges manual pages with the generated package sidebar.
- `.github/workflows/deploy.yml` — runs sync + build + deploys to GitHub Pages.

The sync script tries three strategies per package (in order):

1. `mkdocs.yml` at repo root → sidebar mirrors its `nav:` tree.
2. Flat list of `*.md` files inside `docs/book/`.
3. `README.md` rendered as a single page.

## Local development

```bash
npm install
npm run dev      # runs sync first via predev hook, then starts Astro dev server
```

Visit http://localhost:4321/phpdb-docs/.

To rebuild docs after upstream changes:

```bash
npm run sync
```

To produce a production build:

```bash
npm run build
npm run preview  # serves dist/
```

## One-time GitHub Pages setup

After pushing this repo to `github.com/peptolab/phpdb-docs` (or wherever it ends up):

1. Repo **Settings → Pages → Source** → **GitHub Actions**.
2. Push to `main` (or trigger the workflow manually from the Actions tab).
3. The site appears at `https://peptolab.github.io/phpdb-docs/`.

## Adding or removing a package

Edit `packages.config.mjs`:

```js
{
  name: 'phpdb-newthing',
  label: 'New Thing',
  repo: 'php-db/phpdb-newthing',
  ref: '1.0.x',
  srcPath: 'docs/book',
}
```

Push to `main` — the workflow handles the rest.

## Moving to the `php-db` org later

Two changes:

1. Push the repo to `github.com/php-db/phpdb-docs`.
2. Update `SITE_URL` and `SITE_BASE` in `.github/workflows/deploy.yml` (e.g. `SITE_URL=https://php-db.github.io`, `SITE_BASE=/phpdb-docs/`).

For a custom domain, set `SITE_URL` to the domain, set `SITE_BASE` to `/`, and add a `CNAME` file in `public/`.

## ⚠️  Font licence (POC only)

`src/styles/fonts/` contains **trial-licensed** Saans / SaansMono `.woff2` files from Displaay foundry. These are **not licensed for production deployment**. Before a public release, either:

- Purchase a licence from Displaay and replace the `-TRIAL-` files with the production weights (and update the `@font-face src:` URLs in `src/styles/theme.css`), or
- Swap to a freely-licensed alternative (e.g. Inter / JetBrains Mono) — same file pattern, just a different `font-family` in `theme.css`.

## Deferred (not yet wired up)

- `repository_dispatch` from each `php-db/*` repo on release/push, so this site rebuilds automatically when an upstream package changes.
- Nightly cron as a fallback rebuild trigger.
