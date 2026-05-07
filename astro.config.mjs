import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

let generatedSidebar = [];
try {
  const mod = await import('./src/sidebar.generated.mjs');
  generatedSidebar = mod.default;
} catch {
  console.warn('[phpdb-docs] No src/sidebar.generated.mjs found — run `npm run sync` first.');
}

const SITE = process.env.SITE_URL || 'https://peptolab.github.io';
const BASE = process.env.SITE_BASE || '/phpdb-docs/';

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'phpdb',
      description: 'Documentation for the phpdb family of database packages.',
      logo: {
        src: './src/assets/phpdb-logo.svg',
        replacesTitle: true,
      },
      customCss: ['./src/styles/theme.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/php-db' },
      ],
      sidebar: [
        { label: 'Getting Started', slug: 'getting-started' },
        { label: 'Features', slug: 'features' },
        { label: 'Examples', slug: 'examples' },
        { label: 'About', slug: 'about' },
        { label: 'Contributing', slug: 'contributing' },
        { label: 'Packages', items: generatedSidebar },
      ],
    }),
  ],
});
