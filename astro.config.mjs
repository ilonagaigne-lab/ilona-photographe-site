import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://ilonagaigne.com',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'always' },
  image: { layout: 'constrained' },
});
