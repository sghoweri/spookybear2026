import type { APIRoute } from 'astro';
import { loadFeed } from '../lib/feed';
import { SITE } from '../site.config';

/** Subscribe-able calendar of every event (Apple/Google Calendar understand this). */
export const GET: APIRoute = async () => {
  const { items } = await loadFeed();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const fold = (line: string) => {
    const out: string[] = [];
    let s = line;
    while (s.length > 72) {
      out.push(s.slice(0, 72));
      s = ' ' + s.slice(72);
    }
    out.push(s);
    return out.join('\r\n');
  };
  const local = (date: string, time: string) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${SITE.name}//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(SITE.name)}`,
    `X-WR-TIMEZONE:${SITE.timezone}`,
    `X-WR-CALDESC:${esc(SITE.tagline)}`,
  ];
  for (const e of items) {
    const start = e.start ?? '12:00';
    let endDate = e.date;
    let end = e.end;
    if (!end) {
      const [h, m] = start.split(':').map(Number);
      const mins = Math.min(h * 60 + m + 120, 23 * 60 + 59);
      end = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    } else if (end <= start) {
      const d = new Date(`${e.date}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      endDate = d.toISOString().slice(0, 10);
    }
    const desc = [e.description, e.price ? `Price: ${e.price}` : '', e.ticketUrl ? `Tickets: ${e.ticketUrl}` : '', `Details: ${e.url}`, '', 'Unofficial listing. Check with the venue.'].filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@spookybear2026.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${SITE.timezone}:${local(e.date, start)}`,
      `DTEND;TZID=${SITE.timezone}:${local(endDate, end)}`,
      fold(`SUMMARY:${esc(e.title)}`),
      fold(`LOCATION:${esc(`${e.location ? e.location + ', ' : ''}${e.venue.name}, ${e.venue.address}`)}`),
      fold(`DESCRIPTION:${esc(desc)}`),
      fold(`URL:${e.url}`),
      `CATEGORIES:${esc(e.typeLabel)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.join('\r\n') + '\r\n', {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="spookybear2026.ics"' },
  });
};
