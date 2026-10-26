import type { APIRoute } from 'astro';
import { loadFeed } from '../lib/feed';
import { SITE, DAYS } from '../site.config';

/**
 * Full machine-readable dump of the schedule, with sources, for anyone building on
 * top of this (bots, assistants, your own spreadsheet). Also linked from <head>.
 */
export const GET: APIRoute = async () => {
  const { items, venues } = await loadFeed();
  const body = {
    name: SITE.name,
    description: SITE.tagline,
    url: SITE.url,
    license: 'Event facts are public information gathered from the linked sources; this compilation is CC BY 4.0.',
    disclaimer: `Unofficial fan-made guide. Not affiliated with ${SITE.organizer.name} or any venue. Verify with the venue before you go.`,
    generatedAt: new Date().toISOString(),
    timezone: SITE.timezone,
    days: DAYS,
    venues,
    events: items,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
