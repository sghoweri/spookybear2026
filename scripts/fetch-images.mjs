#!/usr/bin/env node
/**
 * Downloads each event's `imageSource` into src/content/events/images/<slug>.jpg,
 * resizes it to a sane web size, and sets `image: ./images/<slug>.jpg` in the
 * frontmatter so Astro can optimise it at build time.
 *
 *   node scripts/fetch-images.mjs            # only events with imageSource and no image
 *   node scripts/fetch-images.mjs --force    # re-download everything with an imageSource
 *   node scripts/fetch-images.mjs some-slug  # just one event
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import sharp from 'sharp';

const EVENTS_DIR = 'src/content/events';
const IMG_DIR = path.join(EVENTS_DIR, 'images');
const MAX_WIDTH = 1200;
const force = process.argv.includes('--force');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));

await mkdir(IMG_DIR, { recursive: true });
const files = (await readdir(EVENTS_DIR)).filter((f) => f.endsWith('.md'));
let ok = 0;
for (const f of files) {
  const slug = f.replace(/\.md$/, '');
  if (only.length && !only.includes(slug)) continue;
  const p = path.join(EVENTS_DIR, f);
  const doc = matter(await readFile(p, 'utf8'));
  const { imageSource, image } = doc.data;
  if (!imageSource || (image && !force)) continue;
  try {
    const res = await fetch(imageSource, {
      headers: { 'user-agent': 'Mozilla/5.0 (spookybear2026.com schedule bot; contact via GitHub issues)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    if (!meta.width || meta.width < 200) throw new Error(`too small (${meta.width}px)`);
    const out = path.join(IMG_DIR, `${slug}.jpg`);
    await sharp(buf)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .flatten({ background: '#1f0f2e' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(out);
    doc.data.image = `./images/${slug}.jpg`;
    await writeFile(p, matter.stringify(`\n${doc.content.trim()}\n`, doc.data));
    ok++;
    console.log(`✓ ${slug} (${meta.width}x${meta.height} ${meta.format})`);
  } catch (err) {
    console.warn(`✗ ${slug}: ${err.message} — ${imageSource}`);
  }
}
console.log(`${ok} image(s) saved`);
