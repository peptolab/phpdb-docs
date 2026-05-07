#!/usr/bin/env node
/**
 * Sync curated php-db package docs into src/content/docs/packages/<name>/
 * and emit src/sidebar.generated.mjs for Starlight to consume.
 *
 * Strategy per package, in order:
 *   1. mkdocs.yml at repo root  -> sidebar derived from its `nav:` tree
 *   2. flat list of *.md files inside srcPath
 *   3. README.md as a single page
 *
 * Run via: npm run sync
 */
import { mkdir, readdir, readFile, rm, writeFile, stat, copyFile } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve, basename, extname } from 'node:path';
import { x as tarExtract } from 'tar';
import yaml from 'js-yaml';
import packages from '../packages.config.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, '.sync-cache');
const PACKAGES_OUT = join(ROOT, 'src/content/docs/packages');
const SIDEBAR_OUT = join(ROOT, 'src/sidebar.generated.mjs');

async function main() {
  await rm(PACKAGES_OUT, { recursive: true, force: true });
  await mkdir(PACKAGES_OUT, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });

  const sidebar = [];
  for (const pkg of packages) {
    console.log(`\n→ ${pkg.repo}@${pkg.ref}`);
    const extractedRoot = await fetchAndExtract(pkg);
    const result = await syncPackage(pkg, extractedRoot);
    await ensurePackageIndex(pkg, result.items);
    sidebar.push({ label: pkg.label, collapsed: true, items: result.items });
    console.log(`  ✓ ${result.strategy} (${result.fileCount} file${result.fileCount === 1 ? '' : 's'})`);
  }

  await writeSidebar(sidebar);
  console.log(`\n✓ Wrote ${relative(ROOT, SIDEBAR_OUT)}`);
}

async function fetchAndExtract(pkg) {
  const url = `https://codeload.github.com/${pkg.repo}/tar.gz/${pkg.ref}`;
  const tarballPath = join(CACHE_DIR, `${pkg.name}-${pkg.ref.replace(/[^\w.-]/g, '_')}.tar.gz`);
  const extractDir = join(CACHE_DIR, `${pkg.name}-${pkg.ref.replace(/[^\w.-]/g, '_')}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed for ${url}: ${res.status} ${res.statusText}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tarballPath));

  await rm(extractDir, { recursive: true, force: true });
  await mkdir(extractDir, { recursive: true });
  await tarExtract({ file: tarballPath, cwd: extractDir });

  const entries = await readdir(extractDir);
  if (entries.length !== 1) throw new Error(`Expected one top-level dir in tarball, got ${entries.length}`);
  return join(extractDir, entries[0]);
}

async function syncPackage(pkg, extractedRoot) {
  const mkdocsPath = join(extractedRoot, 'mkdocs.yml');
  const srcPath = join(extractedRoot, pkg.srcPath || 'docs/book');
  const outDir = join(PACKAGES_OUT, pkg.name);
  await mkdir(outDir, { recursive: true });

  if (await fileExists(mkdocsPath) && await dirExists(srcPath)) {
    return await strategyMkdocs(pkg, mkdocsPath, srcPath, outDir);
  }
  if (await dirExists(srcPath)) {
    return await strategyFlatDocs(pkg, srcPath, outDir);
  }
  return await strategyReadme(pkg, extractedRoot, outDir);
}

async function strategyMkdocs(pkg, mkdocsPath, srcPath, outDir) {
  const raw = await readFile(mkdocsPath, 'utf8');
  const mkdocs = yaml.load(raw, { schema: yaml.FAILSAFE_SCHEMA });
  const nav = (typeof mkdocs === 'object' && mkdocs && Array.isArray(mkdocs.nav)) ? mkdocs.nav : null;

  const fileCount = await copyMarkdownTree(srcPath, outDir, pkg.name);
  if (!nav) {
    return await strategyFlatDocs(pkg, srcPath, outDir, { alreadyCopied: true, fileCount });
  }

  const existingFiles = new Set(await listMarkdown(outDir));
  const items = nav.map((entry) => convertNavEntry(entry, pkg.name, existingFiles)).filter(Boolean);

  if (items.length === 0) {
    return await strategyFlatDocs(pkg, srcPath, outDir, { alreadyCopied: true, fileCount });
  }
  return { strategy: 'mkdocs.yml', items, fileCount };
}

function convertNavEntry(entry, pkgName, existingFiles) {
  if (typeof entry === 'string') {
    return mdToSidebarLeaf(entry, basename(entry, '.md'), pkgName, existingFiles);
  }
  if (entry && typeof entry === 'object') {
    const keys = Object.keys(entry);
    if (keys.length !== 1) return null;
    const label = keys[0];
    const value = entry[label];
    if (typeof value === 'string') {
      return mdToSidebarLeaf(value, label, pkgName, existingFiles);
    }
    if (Array.isArray(value)) {
      const children = value.map((c) => convertNavEntry(c, pkgName, existingFiles)).filter(Boolean);
      if (children.length === 0) return null;
      return { label, items: children };
    }
  }
  return null;
}

function mdToSidebarLeaf(mdPath, label, pkgName, existingFiles) {
  if (!mdPath.endsWith('.md')) return null;
  if (!existingFiles.has(mdPath)) return null;
  const slugTail = mdPath.replace(/\.md$/, '').replace(/\/index$/, '').replace(/^index$/, '');
  const slug = slugTail ? `packages/${pkgName}/${slugTail}` : `packages/${pkgName}`;
  return { label, slug };
}

async function strategyFlatDocs(pkg, srcPath, outDir, opts = {}) {
  const fileCount = opts.alreadyCopied ? opts.fileCount : await copyMarkdownTree(srcPath, outDir, pkg.name);
  const mdFiles = await listMarkdown(outDir);
  const items = mdFiles.map((relPath) => {
    const slugTail = relPath.replace(/\.md$/, '').replace(/\/index$/, '').replace(/^index$/, '');
    const slug = slugTail ? `packages/${pkg.name}/${slugTail}` : `packages/${pkg.name}`;
    const label = humanize(basename(relPath, '.md'));
    return { label, slug };
  });
  return { strategy: 'flat docs/book', items, fileCount };
}

async function strategyReadme(pkg, extractedRoot, outDir) {
  const candidates = ['README.md', 'readme.md', 'Readme.md'];
  let readmeSrc = null;
  for (const c of candidates) {
    const p = join(extractedRoot, c);
    if (await fileExists(p)) { readmeSrc = p; break; }
  }
  if (!readmeSrc) {
    const placeholder = `---\ntitle: ${pkg.label}\n---\n\n> No documentation found in repository.\n`;
    await writeFile(join(outDir, 'index.md'), placeholder, 'utf8');
    return { strategy: 'placeholder (no docs found)', items: [{ label: 'Overview', slug: `packages/${pkg.name}` }], fileCount: 1 };
  }
  const raw = await readFile(readmeSrc, 'utf8');
  const normalized = ensureFrontmatter(raw, pkg.label);
  await writeFile(join(outDir, 'index.md'), normalized, 'utf8');
  return { strategy: 'README fallback', items: [{ label: 'Overview', slug: `packages/${pkg.name}` }], fileCount: 1 };
}

async function copyMarkdownTree(srcDir, outDir, pkgName) {
  let count = 0;
  async function walk(rel) {
    const here = join(srcDir, rel);
    const entries = await readdir(here, { withFileTypes: true });
    for (const e of entries) {
      const childRel = rel ? join(rel, e.name) : e.name;
      const childAbs = join(here, e.name);
      if (e.isDirectory()) {
        await mkdir(join(outDir, childRel), { recursive: true });
        await walk(childRel);
      } else if (e.isFile() && extname(e.name).toLowerCase() === '.md') {
        const raw = await readFile(childAbs, 'utf8');
        const fallbackTitle = humanize(basename(e.name, '.md'));
        const normalized = ensureFrontmatter(raw, fallbackTitle);
        await mkdir(dirname(join(outDir, childRel)), { recursive: true });
        await writeFile(join(outDir, childRel), normalized, 'utf8');
        count++;
      }
    }
  }
  await walk('');
  return count;
}

async function listMarkdown(dir) {
  const out = [];
  async function walk(rel) {
    const here = join(dir, rel);
    const entries = await readdir(here, { withFileTypes: true });
    for (const e of entries) {
      const childRel = rel ? join(rel, e.name) : e.name;
      if (e.isDirectory()) await walk(childRel);
      else if (extname(e.name).toLowerCase() === '.md') out.push(childRel.split('\\').join('/'));
    }
  }
  await walk('');
  out.sort((a, b) => {
    if (a === 'index.md') return -1;
    if (b === 'index.md') return 1;
    return a.localeCompare(b);
  });
  return out;
}

async function ensurePackageIndex(pkg, sidebarItems) {
  const indexPath = join(PACKAGES_OUT, pkg.name, 'index.md');
  if (await fileExists(indexPath)) return;
  const prefix = `packages/${pkg.name}/`;
  const links = renderIndexLinks(sidebarItems, prefix);
  const body =
    `---\ntitle: "${pkg.label.replace(/"/g, '\\"')}"\n---\n\n` +
    `# ${pkg.label}\n\n` +
    (links ? `## Pages\n\n${links}\n` : `> No pages available.\n`);
  await writeFile(indexPath, body, 'utf8');
  sidebarItems.unshift({ label: 'Overview', slug: `packages/${pkg.name}` });
}

function renderIndexLinks(items, prefix, depth = 0) {
  if (!Array.isArray(items)) return '';
  return items.map((item) => {
    const indent = '  '.repeat(depth);
    if ('slug' in item) {
      const rel = item.slug.startsWith(prefix) ? item.slug.slice(prefix.length) : item.slug;
      return `${indent}- [${item.label}](${rel}/)`;
    }
    if ('items' in item) {
      const children = renderIndexLinks(item.items, prefix, depth + 1);
      return `${indent}- ${item.label}\n${children}`;
    }
    return '';
  }).filter(Boolean).join('\n');
}

function ensureFrontmatter(raw, fallbackTitle) {
  if (raw.startsWith('---')) return raw;
  const h1Match = raw.match(/^\s*#\s+(.+?)[ \t]*\n/);
  let title = fallbackTitle;
  let body = raw;
  if (h1Match) {
    title = h1Match[1];
    body = raw.slice(h1Match[0].length).replace(/^\s*\n+/, '');
  }
  const safeTitle = title.replace(/"/g, '\\"');
  return `---\ntitle: "${safeTitle}"\n---\n\n${body}`;
}

async function writeSidebar(sidebar) {
  const body =
    `// AUTO-GENERATED by scripts/sync-docs.mjs — do not edit by hand.\n` +
    `export default ${JSON.stringify(sidebar, null, 2)};\n`;
  await writeFile(SIDEBAR_OUT, body, 'utf8');
}

async function fileExists(p) { try { const s = await stat(p); return s.isFile(); } catch { return false; } }
async function dirExists(p)  { try { const s = await stat(p); return s.isDirectory(); } catch { return false; } }
function humanize(s) { return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

main().catch((e) => { console.error(e); process.exit(1); });
