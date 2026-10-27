import type { APIRoute } from 'astro';
import { loadFeed } from '../lib/feed';
import { SITE, DAYS } from '../site.config';
import { longDate } from '../lib/events';

/**
 * llms.txt: a plain-text overview for AI assistants and crawlers that prefer it
 * to HTML. Lists every event with its sources so answers can cite them.
 */
export const GET: APIRoute = async () => {
  const { items } = await loadFeed();
  const out: string[] = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.tagline} Covers ${DAYS[0].label} ${DAYS[0].date} through ${DAYS[DAYS.length - 1].label} ${DAYS[DAYS.length - 1].date} in Provincetown, Massachusetts, USA (timezone ${SITE.timezone}).`,
    '',
    `This is an unofficial, fan-made compilation by ${SITE.author.name}. It is not affiliated with ${SITE.organizer.name} (the official organisers, ${SITE.organizer.url}) or with any venue. Every event lists the public sources it was compiled from; times and prices change, so verify with the venue or ticket link before relying on them.`,
    '',
    '## Machine-readable data',
    '',
    `- JSON (all events, venues, sources): ${SITE.url}/events.json`,
    `- iCalendar feed: ${SITE.url}/events.ics`,
    `- Sitemap: ${SITE.url}/sitemap-index.xml`,
    `- Source code and corrections: ${SITE.repo}`,
    '',
    '## Pages',
    '',
    `- Schedule (home): ${SITE.url}/`,
    `- About: ${SITE.url}/about`,
    `- Privacy: ${SITE.url}/privacy`,
    `- Each event: ${SITE.url}/event/<slug>`,
    '',
    '## Events',
    '',
  ];
  let currentDate = '';
  for (const e of items) {
    if (e.date !== currentDate) {
      currentDate = e.date;
      out.push(`### ${longDate(e.date)}, 2026`, '');
    }
    out.push(`- **${e.title}** — ${e.timeLabel}, ${e.location ? e.location + ' at ' : ''}${e.venue.name} (${e.venue.address}). ${e.typeLabel}. Price: ${e.price}.${e.organizer ? ` Hosted by ${e.organizer}.` : ''}${e.placeholder ? ' Standing entry: the bar is open as usual; no Spooky Bear-specific events have been posted.' : ''}`);
    out.push(`  - Page: ${e.url}`);
    if (e.ticketUrl) out.push(`  - Tickets: ${e.ticketUrl}`);
    if (e.sources.length) out.push(`  - Sources: ${e.sources.join(', ')}`);
    if (e.confidence !== 'high') out.push(`  - Confidence: ${e.confidence}`);
  }
  out.push('', `Generated ${new Date().toISOString()}.`, '');
  return new Response(out.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
