// Builds the full favicon / touch icon / manifest set from scripts/assets/icon-1024.png
// (which scripts/og.mjs renders from the paw SVG). Run: yarn favicons
import { favicons } from 'favicons';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const source = 'scripts/assets/icon-1024.png';
const out = 'public';
const res = await favicons(source, {
  path: '/',
  appName: 'Spooky Bear 2026',
  appShortName: 'Spooky Bear',
  appDescription: 'Unofficial schedule for Spooky Bear weekend in Provincetown.',
  lang: 'en-US',
  background: '#15081f',
  theme_color: '#15081f',
  display: 'standalone',
  start_url: '/',
  icons: {
    android: ['android-chrome-192x192.png', 'android-chrome-512x512.png'],
    appleIcon: ['apple-touch-icon.png'],
    appleStartup: false,
    favicons: ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png'],
    windows: false,
    yandex: false,
  },
});
await mkdir(out, { recursive: true });
for (const f of [...res.images, ...res.files]) await writeFile(path.join(out, f.name), f.contents);
console.log(`${res.images.length} icons, ${res.files.length} files written to ${out}/`);
console.log(res.html.join('\n'));
