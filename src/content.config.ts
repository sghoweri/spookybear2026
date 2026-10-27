import { defineCollection, reference, z } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { DAYS, EVENT_TYPES } from './site.config';

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h HH:MM')
  .nullable()
  .optional();

const dates = DAYS.map((d) => d.date) as [string, ...string[]];

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      venue: reference('venues'),
      /** Overrides the venue address, e.g. a specific room or a one-off location. */
      location: z.string().nullable().optional(),
      date: z.preprocess(
        (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
        z.enum(dates),
      ),
      start: time,
      end: time,
      type: z.enum(Object.keys(EVENT_TYPES) as [string, ...string[]]),
      /** Human readable price. Leave null when unknown. */
      price: z.string().nullable().optional(),
      isFree: z.boolean().nullable().optional(),
      ticketUrl: z.string().url().nullable().optional(),
      infoUrl: z.string().url().nullable().optional(),
      /** Local promo image, relative to the markdown file (e.g. ./images/foo.jpg). */
      image: image().nullable().optional(),
      /** Where the image came from, so the update script can re-fetch it. */
      imageSource: z.string().url().nullable().optional(),
      organizer: z.string().nullable().optional(),
      ageRestriction: z.string().nullable().optional(),
      dressCode: z.string().nullable().optional(),
      tags: z.array(z.string()).default([]),
      featured: z.boolean().default(false),
      /** A standing "this bar is open" entry for a venue with no posted events; styled as a hint, kept out of calendars and structured data. */
      placeholder: z.boolean().default(false),
      sources: z.array(z.string().url()).default([]),
      confidence: z.enum(['high', 'medium', 'low']).default('medium'),
      /** When true, scripts/update-events.mjs will never rewrite this file. */
      locked: z.boolean().default(false),
      lastVerified: z
        .preprocess((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v), z.string())
        .nullable()
        .optional(),
    }),
});

const venues = defineCollection({
  loader: file('./src/data/venues.json'),
  schema: z.object({
    name: z.string(),
    shortName: z.string().optional(),
    address: z.string(),
    /** Rough position along Commercial St, used for the location filter. */
    area: z.enum(['West End', 'Center', 'East End']),
    url: z.string().url().nullable().optional(),
    instagram: z.string().nullable().optional(),
    mapsUrl: z.string().url(),
    hours: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
});

export const collections = { events, venues };
