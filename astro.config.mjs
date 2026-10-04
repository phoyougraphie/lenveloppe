import { defineConfig } from 'astro/config';

// BASE_PATH vaut '/lenveloppe' sur GitHub Pages (voir .github/workflows/deploy.yml), rien en local.
export default defineConfig({
  site: 'https://phoyougraphie.github.io',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
