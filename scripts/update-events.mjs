#!/usr/bin/env node
/**
 * Re-check the sources behind the schedule and propose updates.
 *
 *   npm run update:fetch            # snapshot every source in data/sources.json, show what changed
 *   npm run update:extract          # ask Claude to extract events from the changed sources
 *   npm run update:extract -- --all # ...from every source, changed or not
 *   node scripts/ingest.mjs data/proposed/<timestamp>.json --dry-run   # review
 *   node scripts/ingest.mjs data/proposed/<timestamp>.json             # apply (locked files untouched)
 *   npm run update:images           # pull down any new promo images
 *
 * `extract` needs ANTHROPIC_API_KEY (or an `ant auth login` profile). Nothing is
 * written to src/content by this script; ingest.mjs does that so you can review first.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const SOURCES = JSON.parse(await readFile('data/sources.json', 'utf8'));
const SNAP_DIR = 'data/snapshots';
const PROPOSED_DIR = 'data/proposed';
const EVENTS_DIR = 'src/content/events';
const cmd = process.argv[2];
const flags = new Set(process.argv.slice(3));

if (cmd === 'fetch') await fetchAll();
else if (cmd === 'extract') await extract();
else {
  console.error('Usage: node scripts/update-events.mjs <fetch|extract> [--all]');
  process.exit(1);
}

// ---- fetch ------------------------------------------------------------------
async function fetchAll() {
  await mkdir(SNAP_DIR, { recursive: true });
  const changed = [];
  for (const s of SOURCES) {
    const file = path.join(SNAP_DIR, `${s.id}.txt`);
    const prev = existsSync(file) ? await readFile(file, 'utf8') : null;
    let text;
    try {
      text = await fetchText(s.url);
    } catch (err) {
      console.log(`✗ ${s.id}: ${err.message}`);
      continue;
    }
    if (prev === text) {
      console.log(`  ${s.id}: unchanged`);
      continue;
    }
    await writeFile(file, text);
    changed.push(s.id);
    console.log(`${prev === null ? '+' : '~'} ${s.id}: ${prev === null ? 'first snapshot' : `changed (${diffSummary(prev, text)})`}`);
  }
  await writeFile(path.join(SNAP_DIR, '_changed.json'), JSON.stringify({ at: new Date().toISOString(), changed }, null, 2));
  console.log(changed.length ? `\n${changed.length} source(s) changed. Run: npm run update:extract` : '\nNothing changed.');
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; spookybear2026.com schedule bot; +https://github.com/sghoweri/spookybear2026)',
      accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(25000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  const type = res.headers.get('content-type') ?? '';
  return type.includes('json') ? prettyJson(body) : htmlToText(body);
}

function prettyJson(s) {
  try {
    return JSON.stringify(JSON.parse(s), null, 1);
  } catch {
    return s;
  }
}

/** Crude but dependency-free HTML -> text that keeps links and image URLs. */
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, ' [img $1] ')
    .replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, txt) => ` ${txt} [${href}] `)
    .replace(/<(br|p|div|li|h\d|tr|section|article|header|footer)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function diffSummary(a, b) {
  const A = new Set(a.split('\n'));
  const B = new Set(b.split('\n'));
  let added = 0;
  let removed = 0;
  for (const l of B) if (!A.has(l)) added++;
  for (const l of A) if (!B.has(l)) removed++;
  return `+${added} / -${removed} lines`;
}

// ---- extract --------------------------------------------------------------------
async function extract() {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const changedFile = path.join(SNAP_DIR, '_changed.json');
  const changed = flags.has('--all')
    ? SOURCES.map((s) => s.id)
    : existsSync(changedFile)
      ? JSON.parse(await readFile(changedFile, 'utf8')).changed
      : [];
  if (!changed.length) {
    console.log('No changed sources. Run `npm run update:fetch` first, or pass --all.');
    return;
  }

  const current = [];
  for (const f of await readdir(EVENTS_DIR)) {
    if (!f.endsWith('.md')) continue;
    const doc = matter(await readFile(path.join(EVENTS_DIR, f), 'utf8'));
    const { image, imageSource, sources, ...rest } = doc.data;
    current.push({ slug: f.replace(/\.md$/, ''), ...rest, description: doc.content.trim().split('\n\n')[0] });
  }
  const venues = JSON.parse(await readFile('src/data/venues.json', 'utf8')).map((v) => ({ id: v.id, name: v.name }));

  const sourceBlocks = [];
  for (const id of changed) {
    const s = SOURCES.find((x) => x.id === id);
    const text = await readFile(path.join(SNAP_DIR, `${id}.txt`), 'utf8');
    sourceBlocks.push(`<source id="${id}" venue="${s.venue}" url="${s.url}">\n${text.slice(0, 60000)}\n</source>`);
  }

  const system = `You maintain the event data for spookybear2026.com, an unofficial schedule of Spooky Bear weekend in Provincetown, MA (Wed Oct 28 through Sun Nov 1, 2026). You are given the current list of known events, the list of known venues, and fresh text from one or more source pages. Extract every event in the window from the sources and return JSON only.

Output: a JSON object {"events": [...]} where each event has exactly these keys:
title, slug (reuse the existing slug when it is clearly the same event, otherwise null), venue (a venue id from the venue list, or the venue name if new), location (room, or null), date (YYYY-MM-DD), startTime ("HH:MM" 24h or null), endTime, type (party|tea-dance|drag|show|costume-contest|market|brunch|meetup|fundraiser|dining|other), price (human readable or null), isFree (true|false|null), ticketUrl, infoUrl, imageUrl (direct image URL or null), description (2-3 factual sentences in your own words), organizer, ageRestriction, dressCode, sources (array of URLs), confidence ("high"|"medium"|"low"), notes (conflicts or things to verify, or null), change ("new"|"updated"|"same"|"cancelled").

Rules: never invent facts; use null when the source doesn't say. Only include events inside the date window. Mark change:"cancelled" if a source says an event is cancelled or it has disappeared from the venue's own listing. Keep descriptions free of copied marketing copy.`;

  const user = `<venues>\n${JSON.stringify(venues)}\n</venues>\n\n<current_events>\n${JSON.stringify(current)}\n</current_events>\n\n${sourceBlocks.join('\n\n')}`;

  console.log(`Asking Claude to extract from ${changed.length} source(s)...`);
  const stream = client.messages.stream({
    model: 'claude-opus-5-5',
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error(`Refused: ${msg.stop_details?.explanation ?? 'no explanation'}`);
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const parsed = JSON.parse(json);

  await mkdir(PROPOSED_DIR, { recursive: true });
  const out = path.join(PROPOSED_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(out, JSON.stringify(parsed, null, 2));
  const counts = {};
  for (const e of parsed.events) counts[e.change ?? 'unknown'] = (counts[e.change ?? 'unknown'] ?? 0) + 1;
  console.log(`Wrote ${parsed.events.length} events to ${out}`, counts);
  console.log(`Tokens: ${msg.usage.input_tokens} in / ${msg.usage.output_tokens} out`);
  console.log(`\nReview with:\n  node scripts/ingest.mjs ${out} --dry-run\nApply with:\n  node scripts/ingest.mjs ${out} && npm run update:images`);
  const cancelled = parsed.events.filter((e) => e.change === 'cancelled');
  if (cancelled.length) console.log(`\nPossibly cancelled (handle by hand):\n  ${cancelled.map((e) => `${e.title} (${e.slug ?? 'no slug'})`).join('\n  ')}`);
}
