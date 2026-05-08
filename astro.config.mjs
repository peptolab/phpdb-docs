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
        src: './src/assets/phpdb-logo-horizontal.svg',
        replacesTitle: true,
      },
      customCss: ['./src/styles/theme.scss'],
      components: {
        MarkdownContent: './src/components/MarkdownContent.astro',
        Footer: './src/components/Footer.astro',
        Sidebar: './src/components/Sidebar.astro',
        SiteTitle: './src/components/SiteTitle.astro',
        PageTitle: './src/components/PageTitle.astro',
        Pagination: './src/components/Pagination.astro',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/php-db' },
      ],
      sidebar: [
        { label: 'Features', slug: 'features' },
        { label: 'Examples', slug: 'examples' },
        { label: 'Benchmarks', slug: 'benchmarks' },
        {
          label: 'About',
          items: [
            { label: 'Overview', slug: 'about' },
            { label: 'Getting Started', slug: 'getting-started' },
          ],
        },
        { label: 'Packages', items: generatedSidebar },
      ],
    }),
  ],
});
