# Spooky Bear 2026

The unofficial, all-in-one schedule for [Spooky Bear](https://www.ursamen.org/spookybear) weekend in Provincetown, MA
(Thu Oct 29 to Sun Nov 1, 2026). Live at **[spookybear2026.com](https://spookybear2026.com)**.

Not affiliated with Northeast Ursamen or any venue. Made by one fan who got tired of checking twelve Instagrams.

## Fix something

- **Wrong time, price, or venue?** [Open an event correction](../../issues/new?template=event-correction.yml).
- **Missing event?** [Suggest it](../../issues/new?template=new-event.yml).
- **Site broken?** [File a bug](../../issues/new?template=bug.yml).

Or edit the markdown directly: every event is a file in [`src/content/events/`](src/content/events/).
Set `locked: true` in the frontmatter if you hand-edit an event and don't want the update script to touch it.

## Develop

```bash
nvm use            # Node 24
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
```

Stack: [Astro](https://astro.build) static site, zero client frameworks, one small vanilla script for filters,
favourites and the event dialog. Hosted on Vercel.

## Content model

| Path | What |
|---|---|
| `src/content/events/*.md` | One file per event. Frontmatter schema lives in `src/content.config.ts`. |
| `src/content/events/images/` | Downloaded promo images, referenced as `image: ./images/<slug>.jpg`. |
| `src/data/venues.json` | Venues: name, address, area (West End / Center / East End), links. |
| `src/site.config.ts` | Dates, event types, analytics id, repo link. |

## Keeping the schedule fresh

```bash
npm run update:fetch                     # snapshot every URL in data/sources.json and diff against last time
npm run update:extract                   # ask Claude to extract events from the changed sources (needs ANTHROPIC_API_KEY)
node scripts/ingest.mjs data/proposed/<file>.json --dry-run   # review what would change
node scripts/ingest.mjs data/proposed/<file>.json             # write/merge into src/content/events (locked files untouched)
npm run update:images                    # download any new promo images
```

The original research dumps that seeded the site are in `data/research/`; `scripts/merge-research.mjs` de-duplicates
several of those into one file for `ingest.mjs`.

## Analytics

Google Analytics (`G-…` id in `src/site.config.ts`) loads through [Partytown](https://partytown.qwik.dev/) in a web
worker, so it never touches the main thread. It only renders in production builds.
