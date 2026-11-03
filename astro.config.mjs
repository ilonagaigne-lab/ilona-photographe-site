import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://ilona-photographe-site.vercel.app',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'always' },
  image: { layout: 'constrained' },
});
