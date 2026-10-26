import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { dayIdFor, typeLabel } from '../lib/events';

/** Lightweight index the schedule page fetches the first time search is opened. */
export const GET: APIRoute = async () => {
  const events = await getCollection('events');
  const venues = await getCollection('venues');
  const venueById = new Map(venues.map((v) => [v.id, v]));
  const items = events.map((e) => {
    const v = venueById.get(e.data.venue.id)!;
    return {
      slug: e.id,
      title: e.data.title,
      day: dayIdFor(e.data.date),
      venue: v.data.shortName ?? v.data.name,
      venueFull: v.data.name,
      location: e.data.location ?? '',
      type: typeLabel(e.data.type),
      organizer: e.data.organizer ?? '',
      tags: e.data.tags,
      description: (e.body ?? '').replace(/<!--[\s\S]*?-->/g, '').trim().slice(0, 400),
    };
  });
  return new Response(JSON.stringify(items), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
