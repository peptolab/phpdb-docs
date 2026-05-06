/**
 * Curated list of php-db packages pulled into the docs site.
 *
 * Each entry:
 *   - name:    directory slug under src/content/docs/packages/<name>/
 *   - label:   sidebar group label
 *   - repo:    "<owner>/<name>" on GitHub
 *   - ref:     branch, tag, or commit to pull from
 *   - srcPath: directory inside the repo that holds markdown docs (default: "docs/book")
 *
 * The sync script (scripts/sync-docs.mjs) tries three strategies in order:
 *   1. mkdocs.yml at repo root  -> sidebar derived from its `nav:` tree
 *   2. flat list of *.md files inside srcPath
 *   3. README.md as a single page
 */
export default [
  {
    name: 'phpdb',
    label: 'phpdb (core)',
    repo: 'php-db/phpdb',
    ref: '0.6.x',
    srcPath: 'docs/book',
  },
  {
    name: 'phpdb-mysql',
    label: 'MySQL Adapter',
    repo: 'php-db/phpdb-mysql',
    ref: '0.4.x',
    srcPath: 'docs/book',
  },
  {
    name: 'phpdb-pgsql',
    label: 'PostgreSQL Adapter',
    repo: 'php-db/phpdb-pgsql',
    ref: '0.1.x',
    srcPath: 'docs/book',
  },
  {
    name: 'phpdb-sqlite',
    label: 'SQLite Adapter',
    repo: 'php-db/phpdb-sqlite',
    ref: '0.2.x',
    srcPath: 'docs/book',
  },
  {
    name: 'phpdb-paginator-adapter',
    label: 'Paginator Adapter',
    repo: 'php-db/phpdb-paginator-adapter',
    ref: '0.0.x',
    srcPath: 'docs/book',
  },
];
