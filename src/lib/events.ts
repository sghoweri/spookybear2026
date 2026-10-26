import type { CollectionEntry } from 'astro:content';
import { DAYS, EVENT_TYPES, type DayId } from '../site.config';

export type EventEntry = CollectionEntry<'events'>;
export type VenueEntry = CollectionEntry<'venues'>;

export function dayFor(date: string) {
  const day = DAYS.find((d) => d.date === date);
  if (!day) throw new Error(`No day configured for ${date}`);
  return day;
}

export function dayIdFor(date: string): DayId {
  return dayFor(date).id;
}

/** "16:00" -> "4pm", "16:30" -> "4:30pm" */
export function fmtTime(t: string | null | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
}

/** "16:00"–"19:00" -> "4–7pm"; "21:00"–"01:00" -> "9pm–1am" */
export function fmtRange(start?: string | null, end?: string | null): string {
  if (!start) return 'Time TBA';
  if (!end) return fmtTime(start);
  const s = fmtTime(start);
  const e = fmtTime(end);
  const sameSuffix = s.slice(-2) === e.slice(-2);
  return sameSuffix ? `${s.slice(0, -2)}–${e}` : `${s}–${e}`;
}

/** Minutes since midnight, treating anything before 6am as "later that night". */
export function sortKey(e: EventEntry): number {
  const t = e.data.start ?? '23:59';
  const [h, m] = t.split(':').map(Number);
  const mins = h * 60 + m;
  return mins < 6 * 60 ? mins + 24 * 60 : mins;
}

export function typeLabel(type: string): string {
  return (EVENT_TYPES as Record<string, string>)[type] ?? type;
}

export function priceLabel(e: EventEntry): string {
  const { price, isFree } = e.data;
  if (price) return price;
  if (isFree === true) return 'Free';
  if (isFree === false) return 'Ticketed';
  return 'Price TBA';
}

/** Short price for the glanceable row chip: "Free", "$25", "$22–28", "Ticketed", "Price TBA". */
export function priceShort(e: EventEntry): string {
  const kind = priceKind(e);
  if (kind === 'free') return 'Free';
  const nums = [...(e.data.price ?? '').matchAll(/\$(\d+(?:\.\d+)?)/g)].map((m) => Math.round(Number(m[1])));
  if (nums.length) {
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    return hi > lo ? `$${lo}–${hi}` : `$${lo}`;
  }
  if (/donation/i.test(e.data.price ?? '')) return 'Donation';
  if (/sold out/i.test(e.data.price ?? '')) return 'Sold out';
  return kind === 'paid' ? 'Ticketed' : 'Price TBA';
}

/** "free" | "paid" | "unknown" for the free-vs-ticketed filter. */
export function priceKind(e: EventEntry): 'free' | 'paid' | 'unknown' {
  const { price, isFree } = e.data;
  if (isFree === true || /^free\b/i.test(price ?? '')) return 'free';
  if (isFree === false || /\$\d/.test(price ?? '')) return 'paid';
  return 'unknown';
}

export function sortEvents(events: EventEntry[]): EventEntry[] {
  return [...events].sort((a, b) => {
    if (a.data.date !== b.data.date) return a.data.date < b.data.date ? -1 : 1;
    const diff = sortKey(a) - sortKey(b);
    return diff !== 0 ? diff : a.data.title.localeCompare(b.data.title);
  });
}

/** ISO 8601 with the Ptown offset, for schema.org. EDT ends Nov 1 2026 at 2am. */
export function isoDateTime(date: string, time: string | null | undefined): string | undefined {
  if (!time) return undefined;
  const offset = date >= '2026-11-01' && time >= '02:00' ? '-05:00' : '-04:00';
  return `${date}T${time}:00${offset}`;
}

export function longDate(date: string): string {
  const d = dayFor(date);
  const [, m, dd] = date.split('-').map(Number);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return `${d.label}, ${month} ${dd}`;
}

/** Prefilled GitHub issue URL for reporting a problem with one event. */
export function correctionUrl(repo: string, e: EventEntry, siteUrl: string): string {
  const title = `Event correction: ${e.data.title}`;
  const body = [
    `**Event:** ${e.data.title}`,
    `**Page:** ${siteUrl}/event/${e.id}`,
    `**File:** \`src/content/events/${e.id}.md\``,
    '',
    '**What’s wrong?** (time, price, venue, cancelled, etc.)',
    '',
    '',
    '**Where did you see the correct info?** (link, flyer, Instagram post)',
    '',
  ].join('\n');
  const params = new URLSearchParams({ title, body, labels: 'event-correction' });
  return `${repo}/issues/new?${params.toString()}`;
}

/** Deterministic placeholder index for events without a promo image. */
export function placeholderIndex(id: string, count: number): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % count;
}
