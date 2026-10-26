#!/usr/bin/env node
/**
 * Merges several research JSON files (same shape as ingest.mjs expects) into one,
 * de-duplicating events that several researchers found independently.
 *
 *   node scripts/merge-research.mjs data/research/a.json data/research/b.json > data/research/merged.json
 *
 * Two records are the same event when they share a venue id and date, start within
 * 30 minutes of each other, and their titles overlap enough. Earlier files win on
 * conflicts; later files fill in blanks. Sources and notes are unioned.
 */
import { readFile } from 'node:fs/promises';

const VENUES = JSON.parse(await readFile('src/data/venues.json', 'utf8'));
const ALIASES = [
  [/boatslip/i, 'boatslip'],
  [/crown/i, 'crown-anchor'],
  [/wilde|gifford|purgatory|porch bar/i, 'gifford-house'],
  [/a-?house|atlantic house/i, 'a-house'],
  [/red room/i, 'red-room'],
  [/provincetown inn|keyhole|mayflower/i, 'provincetown-inn'],
  [/pilgrim house/i, 'pilgrim-house'],
  [/post office/i, 'post-office-cabaret'],
  [/shipwreck|brass key/i, 'shipwreck-lounge'],
  [/harbor lounge/i, 'harbor-lounge'],
  [/tin pan/i, 'tin-pan-alley'],
  [/governor bradford/i, 'governor-bradford'],
  [/town hall|ryder/i, 'town-hall'],
  [/art.?s dune/i, 'arts-dune-tours'],
  [/sanctum/i, 'sanctum-paranormal'],
];
const STOP = new Set('spooky bear weekend the a an of and at with in for to edition party night show live music halloween provincetown 2026 26 ptown fri sat sun thu wed oct nov seating am pm'.split(' '));

const files = process.argv.slice(2);
const merged = [];
for (const f of files) {
  const raw = JSON.parse(await readFile(f, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.events;
  for (const ev of list) {
    const venueId = venueFor(ev.venue);
    if (!venueId) {
      console.error(`skip (unknown venue): ${ev.title} @ ${ev.venue}`);
      continue;
    }
    const rec = { ...ev, venueId, location: ev.location ?? roomFrom(ev.venue), _from: [f] };
    const dup = merged.find((m) => sameEvent(m, rec));
    if (dup) mergeInto(dup, rec);
    else merged.push(rec);
  }
}
merged.sort((a, b) => (a.date + (a.startTime ?? '99')).localeCompare(b.date + (b.startTime ?? '99')));
for (const m of merged) {
  m.venue = m.venueId;
  delete m.venueId;
}
console.error(`${merged.length} unique events from ${files.length} files`);
process.stdout.write(JSON.stringify(merged, null, 2) + '\n');

function venueFor(name) {
  if (!name) return null;
  if (VENUES.some((v) => v.id === name)) return name;
  const hit = ALIASES.find(([re]) => re.test(name));
  return hit ? hit[1] : null;
}
function roomFrom(name) {
  const m = name?.match(/\(([^)]+)\)/) ?? name?.match(/^(The .+?|.+? Room|.+? Bar|Purgatory|Wilde Playhouse) at /i);
  return m ? m[1] : null;
}
function tokens(t) {
  return new Set(
    t
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !STOP.has(w)),
  );
}
function similarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}
function mins(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function sameEvent(a, b) {
  if (a.venueId !== b.venueId || a.date !== b.date) return false;
  const ma = mins(a.startTime);
  const mb = mins(b.startTime);
  const close = ma === null || mb === null ? true : Math.abs(ma - mb) <= 30;
  const sim = similarity(a.title, b.title);
  return (close && sim >= 0.5) || sim >= 0.8;
}
function mergeInto(dst, src) {
  for (const [k, v] of Object.entries(src)) {
    if (k === 'sources') dst.sources = [...new Set([...(dst.sources ?? []), ...(v ?? [])])];
    else if (k === 'notes') dst.notes = [dst.notes, v].filter(Boolean).join(' | ') || null;
    else if (k === '_from') dst._from.push(...v);
    else if (k === 'confidence') dst.confidence = rank(v) > rank(dst.confidence) ? v : dst.confidence;
    else if (k === 'description') dst.description = (dst.description?.length ?? 0) >= (v?.length ?? 0) ? dst.description : v;
    else if (dst[k] === null || dst[k] === undefined || dst[k] === '') dst[k] = v;
  }
}
function rank(c) {
  return { low: 0, medium: 1, high: 2 }[c] ?? 1;
}
