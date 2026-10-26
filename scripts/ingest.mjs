#!/usr/bin/env node
/**
 * Turns research JSON (the shape produced by scripts/update-events.mjs extract,
 * or a hand-written file) into markdown event files in src/content/events.
 *
 *   node scripts/ingest.mjs data/research/foo.json            # write/merge
 *   node scripts/ingest.mjs data/research/foo.json --dry-run  # show what would change
 *   node scripts/ingest.mjs data/research/foo.json --replace  # overwrite unlocked files entirely
 *
 * Rules:
 *   - An event file with `locked: true` is never touched. Edit it by hand.
 *   - By default existing files are merged: new facts fill in nulls, body text is kept.
 *   - Venue names are mapped to ids in src/data/venues.json via VENUE_ALIASES below.
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const EVENTS_DIR = 'src/content/events';
const VENUES = JSON.parse(await readFile('src/data/venues.json', 'utf8'));
const VENUE_ALIASES = [
  [/boatslip/i, 'boatslip'],
  [/crown/i, 'crown-anchor'],
  [/gifford|purgatory|porch bar/i, 'gifford-house'],
  [/a-?house|atlantic house/i, 'a-house'],
  [/red room/i, 'red-room'],
  [/provincetown inn|keyhole|mayflower/i, 'provincetown-inn'],
  [/pilgrim house/i, 'pilgrim-house'],
  [/post office/i, 'post-office-cabaret'],
  [/shipwreck|brass key/i, 'shipwreck-lounge'],
  [/harbor lounge/i, 'harbor-lounge'],
  [/tin pan/i, 'tin-pan-alley'],
  [/governor bradford|gov\.? bradford/i, 'governor-bradford'],
  [/town hall/i, 'town-hall'],
  [/monkey bar/i, 'monkey-bar'],
  [/velvet/i, 'velvet'],
  [/grotta/i, 'grotta-bar'],
  [/bubala/i, 'bubalas'],
  [/nor.?east beer/i, 'noreast-beer-garden'],
  [/brewing/i, 'provincetown-brewing'],
  [/art.?s dune/i, 'arts-dune-tours'],
  [/sanctum/i, 'sanctum-paranormal'],
  [/wilde (playhouse|theater)/i, 'gifford-house'],
];

const TITLE_CLEANUPS = [
  /\s*[–\-:|\/]\s*spooky bear( weekend)?( \d{4})?\s*(\(.*?\))?$/i,
  /\s*\/\s*provincetown \d{4}$/i,
  /\s*–\s*spooky bear\s*\(.*?\)$/i,
  /\s*\(spooky bear\)$/i,
];

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const replace = args.includes('--replace');
if (!file) {
  console.error('Usage: node scripts/ingest.mjs <research.json> [--dry-run] [--replace]');
  process.exit(1);
}

const raw = JSON.parse(await readFile(file, 'utf8'));
const incoming = Array.isArray(raw) ? raw : raw.events;
await mkdir(EVENTS_DIR, { recursive: true });
const existing = new Map();
for (const f of await readdir(EVENTS_DIR)) {
  if (!f.endsWith('.md')) continue;
  const src = await readFile(path.join(EVENTS_DIR, f), 'utf8');
  existing.set(f.replace(/\.md$/, ''), matter(src));
}

const summary = { created: [], updated: [], skippedLocked: [], unchanged: [], errors: [] };

for (const ev of incoming) {
  try {
    const venue = venueIdFor(ev.venue);
    const title = cleanTitle(ev.title);
    const location = ev.location ?? roomFrom(ev.venue);
    const slug = ev.slug ?? uniqueSlug(slugify(title), ev, existing);
    const fm = {
      title,
      venue,
      location: location || null,
      date: ev.date,
      start: ev.startTime ?? ev.start ?? null,
      end: ev.endTime ?? ev.end ?? null,
      type: ev.type ?? 'other',
      price: ev.price ?? null,
      isFree: ev.isFree ?? null,
      ticketUrl: ev.ticketUrl ?? null,
      infoUrl: ev.infoUrl ?? null,
      image: ev.image ?? null,
      imageSource: ev.imageUrl ?? ev.imageSource ?? null,
      organizer: ev.organizer ?? null,
      ageRestriction: ev.ageRestriction ?? null,
      dressCode: ev.dressCode ?? null,
      tags: ev.tags ?? [],
      featured: ev.featured ?? false,
      sources: uniq(ev.sources ?? []),
      confidence: ev.confidence ?? 'medium',
      locked: false,
      lastVerified: new Date().toISOString().slice(0, 10),
    };
    const body = (ev.description ?? '').trim() + (ev.notes ? `\n\n<!-- research notes: ${ev.notes.replace(/-->/g, '')} -->` : '');

    const prev = existing.get(slug);
    if (prev?.data.locked) {
      summary.skippedLocked.push(slug);
      continue;
    }
    let next = fm;
    let nextBody = body;
    if (prev && !replace) {
      // Merge: keep hand-edited values; incoming only fills gaps or updates sources/verification.
      next = { ...fm };
      for (const [k, v] of Object.entries(prev.data)) {
        if (k === 'sources') next.sources = uniq([...(v ?? []), ...fm.sources]);
        else if (k === 'lastVerified' || k === 'locked') continue;
        else if (v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)) next[k] = v;
      }
      nextBody = prev.content.trim() || body;
    }
    const out = matter.stringify(`\n${nextBody}\n`, next);
    const prevOut = prev ? matter.stringify(`\n${prev.content.trim()}\n`, prev.data) : null;
    if (prevOut === out) {
      summary.unchanged.push(slug);
      continue;
    }
    (prev ? summary.updated : summary.created).push(slug);
    if (!dryRun) await writeFile(path.join(EVENTS_DIR, `${slug}.md`), out);
    existing.set(slug, { data: next, content: nextBody });
  } catch (err) {
    summary.errors.push(`${ev.title}: ${err.message}`);
  }
}

for (const [k, v] of Object.entries(summary)) if (v.length) console.log(`${k} (${v.length}):\n  ${v.join('\n  ')}`);
if (dryRun) console.log('\n(dry run, nothing written)');

// ---- helpers ----------------------------------------------------------------
function venueIdFor(name) {
  if (!name) throw new Error('missing venue');
  if (VENUES.some((v) => v.id === name)) return name;
  const hit = VENUE_ALIASES.find(([re]) => re.test(name));
  if (!hit) throw new Error(`unknown venue "${name}" (add it to src/data/venues.json and VENUE_ALIASES)`);
  if (!VENUES.some((v) => v.id === hit[1])) throw new Error(`venue id "${hit[1]}" missing from src/data/venues.json`);
  return hit[1];
}
function roomFrom(name) {
  const m = name?.match(/\(([^)]+)\)/);
  return m ? m[1] : null;
}
function cleanTitle(t) {
  let s = t.trim();
  for (const re of TITLE_CLEANUPS) s = s.replace(re, '').trim();
  return s.replace(/\s+/g, ' ');
}
function slugify(s) {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
function uniqueSlug(base, ev, existing) {
  // Same title on several days (e.g. Witch Perfect) gets a weekday suffix.
  const sameTitle = incoming.filter((e) => slugify(cleanTitle(e.title)) === base);
  if (sameTitle.length > 1 && !existing.has(base)) {
    const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(`${ev.date}T12:00:00Z`).getUTCDay()];
    return `${base}-${day}`;
  }
  return base;
}
function uniq(a) {
  return [...new Set(a.filter(Boolean))];
}
