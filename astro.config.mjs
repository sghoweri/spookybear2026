// @ts-check
import { defineConfig } from 'astro/config';
import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://spookybear2026.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'auto' },
  compressHTML: true,
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  integrations: [
    partytown({ config: { forward: ['dataLayer.push'] } }),
    sitemap({ filter: (page) => !page.includes('/fragments/') }),
  ],
  image: {
    // Remote promo images are downloaded by scripts/fetch-images.mjs into
    // src/content/events/images so the build never depends on third-party hosts.
    remotePatterns: [],
  },
});
