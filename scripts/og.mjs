// Generates the social preview image and PNG icons from inline SVG. Runs before build.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const paw = (x, y, s, rot, fill) => `<g fill="${fill}" transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><ellipse cy="8" rx="13" ry="11"/><circle cx="-16" cy="-7" r="5.5"/><circle cx="-7" cy="-17" r="5.8"/><circle cx="7" cy="-17" r="5.8"/><circle cx="16" cy="-7" r="5.5"/></g>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g1" cx="1" cy="0" r="0.9"><stop offset="0" stop-color="#ff5c9a" stop-opacity="0.35"/><stop offset="1" stop-color="#15081f" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="0" cy="1" r="0.8"><stop offset="0" stop-color="#ff7a1a" stop-opacity="0.3"/><stop offset="1" stop-color="#15081f" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#15081f"/>
  <rect width="1200" height="630" fill="url(#g1)"/>
  <rect width="1200" height="630" fill="url(#g2)"/>
  <circle cx="1010" cy="150" r="110" fill="#ffd166"/>
  <circle cx="975" cy="125" r="96" fill="#15081f" opacity="0.93"/>
  ${paw(760, 470, 2.2, -25, '#ff7a1a')}
  ${paw(900, 380, 2.2, -10, '#ff7a1a')}
  ${paw(1040, 460, 2.2, 8, '#ff7a1a')}
  <text x="80" y="200" font-family="Alfa Slab One, Arial Black, sans-serif" font-size="120" fill="#fff1dc">Spooky Bear</text>
  <text x="80" y="330" font-family="Alfa Slab One, Arial Black, sans-serif" font-size="120" fill="#ff5c9a">2026</text>
  <text x="84" y="420" font-family="Helvetica Neue, Arial, sans-serif" font-size="38" font-weight="600" fill="#d9c4cf">Provincetown, Oct 29 to Nov 1</text>
  <text x="84" y="475" font-family="Helvetica Neue, Arial, sans-serif" font-size="30" fill="#a98fb0">The unofficial all-in-one schedule. spookybear2026.com</text>
</svg>`;

const icon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><rect width="64" height="64" fill="#15081f"/>${paw(32, 34, 1, -15, '#ff7a1a')}</svg>`;

await mkdir('public', { recursive: true });
await sharp(Buffer.from(og), { density: 144 }).png({ compressionLevel: 9, palette: true }).toFile('public/og.png');
await sharp(Buffer.from(icon(180))).png().toFile('public/apple-touch-icon.png');
await sharp(Buffer.from(icon(512))).png().toFile('public/icon-512.png');
console.log('og.png, apple-touch-icon.png, icon-512.png written');
