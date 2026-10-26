export const SITE = {
  name: 'Spooky Bear 2026',
  tagline: 'The unofficial, all-in-one-place schedule for Spooky Bear weekend in Provincetown.',
  url: 'https://spookybear2026.com',
  repo: 'https://github.com/sghoweri/spookybear2026',
  gaId: 'G-9W31GZXY39',
  timezone: 'America/New_York',
  /** Official organizer, for the "not affiliated" disclaimer. */
  organizer: { name: 'Northeast Ursamen', url: 'https://www.ursamen.org/spookybear' },
  author: { name: 'Salem', url: 'https://github.com/sghoweri' },
} as const;

/** The weekend, in order. Wednesday is for early arrivals and pre-parties. */
export const DAYS = [
  { id: 'wed', date: '2026-10-28', label: 'Wednesday', short: 'Wed', nick: 'Early arrivals' },
  { id: 'thu', date: '2026-10-29', label: 'Thursday', short: 'Thu', nick: 'Kickoff' },
  { id: 'fri', date: '2026-10-30', label: 'Friday', short: 'Fri', nick: 'Devil’s night' },
  { id: 'sat', date: '2026-10-31', label: 'Saturday', short: 'Sat', nick: 'Halloween' },
  { id: 'sun', date: '2026-11-01', label: 'Sunday', short: 'Sun', nick: 'Last call' },
] as const;

export type DayId = (typeof DAYS)[number]['id'];

export const EVENT_TYPES = {
  party: 'Party',
  'tea-dance': 'Tea dance',
  drag: 'Drag',
  show: 'Show',
  'costume-contest': 'Costume contest',
  market: 'Market',
  brunch: 'Brunch',
  meetup: 'Meetup',
  dance: 'Dance party',
  fundraiser: 'Fundraiser',
  dining: 'Food & drink',
  other: 'Other',
} as const;

export type EventType = keyof typeof EVENT_TYPES;
