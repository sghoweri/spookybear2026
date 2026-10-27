import { getCollection } from 'astro:content';
import { fmtRange, isoDateTime, priceKind, priceLabel, sortEvents, typeLabel } from './events';
import { SITE } from '../site.config';

/** One normalised, machine-friendly record per event, shared by events.json, events.ics and llms.txt. */
export async function loadFeed() {
  const [events, venues] = await Promise.all([getCollection('events'), getCollection('venues')]);
  const venueById = new Map(venues.map((v) => [v.id, v]));
  const items = sortEvents(events).map((e) => {
    const v = venueById.get(e.data.venue.id)!;
    const d = e.data;
    return {
      id: e.id,
      url: `${SITE.url}/event/${e.id}`,
      title: d.title,
      date: d.date,
      start: d.start ?? null,
      end: d.end ?? null,
      startDateTime: isoDateTime(d.date, d.start) ?? null,
      endDateTime: isoDateTime(d.date, d.end) ?? null,
      timeLabel: fmtRange(d.start, d.end),
      type: d.type,
      typeLabel: typeLabel(d.type),
      venue: { id: v.id, name: v.data.name, address: v.data.address, area: v.data.area, url: v.data.url ?? null, mapsUrl: v.data.mapsUrl },
      location: d.location ?? null,
      price: priceLabel(e),
      priceKind: priceKind(e),
      ticketUrl: d.ticketUrl ?? null,
      infoUrl: d.infoUrl ?? null,
      image: d.image ? new URL(d.image.src, SITE.url).href : null,
      organizer: d.organizer ?? null,
      ageRestriction: d.ageRestriction ?? null,
      dressCode: d.dressCode ?? null,
      tags: d.tags,
      /** True for standing "this bar is open" entries that are not real events. */
      placeholder: d.placeholder,
      description: (e.body ?? '').replace(/<!--[\s\S]*?-->/g, '').trim(),
      sources: d.sources,
      confidence: d.confidence,
      lastVerified: d.lastVerified ?? null,
    };
  });
  return { items, venues: venues.map((v) => ({ id: v.id, ...v.data })) };
}

export type FeedItem = Awaited<ReturnType<typeof loadFeed>>['items'][number];
