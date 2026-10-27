// Generates the social preview image and PNG icons. Runs before build.
// Headline text is converted to vector paths with opentype.js so the slab
// typeface renders without depending on system fonts.
import sharp from 'sharp';
import opentype from 'opentype.js';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ttf = await readFile(path.join(here, 'assets/AlfaSlabOne-Regular.ttf'));
const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));

// Per-glyph paths: the font's GPOS kerning table trips opentype.js up on digits (NaN coordinates).
const text = (str, x, y, size, fill) => {
  let d = '';
  font.forEachGlyph(str, x, y, size, { kerning: false }, (glyph, gx, gy) => {
    d += glyph.getPath(gx, gy, size).toPathData(2);
  });
  return `<path d="${d}" fill="${fill}"/>`;
};
const paw = (x, y, s, rot, fill) =>
  `<g fill="${fill}" transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><ellipse cy="8" rx="13" ry="11"/><circle cx="-16" cy="-7" r="5.5"/><circle cx="-7" cy="-17" r="5.8"/><circle cx="7" cy="-17" r="5.8"/><circle cx="16" cy="-7" r="5.5"/></g>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g1" cx="1" cy="0" r="0.9"><stop offset="0" stop-color="#ff5c9a" stop-opacity="0.35"/><stop offset="1" stop-color="#15081f" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="0" cy="1" r="0.8"><stop offset="0" stop-color="#ff7a1a" stop-opacity="0.3"/><stop offset="1" stop-color="#15081f" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#15081f"/>
  <rect width="1200" height="630" fill="url(#g1)"/>
  <rect width="1200" height="630" fill="url(#g2)"/>
  <circle cx="1030" cy="140" r="100" fill="#ffd166"/>
  <circle cx="998" cy="118" r="88" fill="#15081f" opacity="0.93"/>
  ${paw(900, 520, 2.1, -25, '#ff7a1a')}
  ${paw(1010, 430, 2.1, -8, '#ff7a1a')}
  ${paw(1110, 530, 2.1, 10, '#ff7a1a')}
  <!-- Glyphs are generated at 120px and scaled: librsvg mis-parses this face's digit outlines at some sizes. -->
  <g transform="translate(80 215) scale(1.1) translate(-80 -215)">
    ${text('Spooky Bear', 80, 215, 120, '#fff1dc')}
    ${text('2026', 80, 338, 120, '#ff5c9a')}
  </g>
  <text x="84" y="430" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="38" font-weight="600" fill="#d9c4cf">Provincetown, Oct 29 to Nov 1</text>
  <text x="84" y="485" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="30" fill="#a98fb0">The unofficial all-in-one schedule</text>
  <text x="84" y="560" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="30" font-weight="600" fill="#ff7a1a">spookybear2026.com</text>
</svg>`;

const icon = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><rect width="64" height="64" fill="#15081f"/>${paw(32, 34, 1, -15, '#ff7a1a')}</svg>`;

await mkdir('public', { recursive: true });
await sharp(Buffer.from(og), { density: 72 }).png({ compressionLevel: 9, palette: true }).toFile('public/og.png');
await sharp(Buffer.from(icon(1024))).png().toFile('scripts/assets/icon-1024.png');
console.log('og.png and icon-1024.png written');
