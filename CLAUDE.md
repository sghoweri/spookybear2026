# spookybear2026.com

Unofficial Spooky Bear (Provincetown Halloween bear weekend, Oct 29 to Nov 1 2026) schedule. Astro 7 static site on Vercel
(project `spookybear2026`, team scope `salems-projects-c80e6599`). Domain at Namecheap, A/CNAME records pointing at Vercel.

- Use Node 24: `source ~/.nvm/nvm.sh && nvm use 24` (there is an `.nvmrc`). Node 20 cannot build this project.
- `npm run dev` / `npm run build`. The dev server config for the app's browser pane is in `.claude/launch.json`.
- Events are markdown files in `src/content/events/` (schema in `src/content.config.ts`); venues in `src/data/venues.json`.
  Set `locked: true` on an event you hand-edit so `scripts/ingest.mjs` never overwrites it.
- Research dumps live in `data/research/`; `scripts/merge-research.mjs` de-dupes them, `scripts/ingest.mjs` writes markdown,
  `scripts/fetch-images.mjs` downloads `imageSource` into `src/content/events/images/`.
- Refresh flow: `npm run update:fetch` (snapshot + diff sources) then `npm run update:extract` (Claude API, writes `data/proposed/`),
  review with `node scripts/ingest.mjs <file> --dry-run`.
- Perf matters: no client frameworks, one vanilla script (`src/scripts/schedule.ts`), event details load as `/fragments/<slug>`.
  GA4 (`G-9W31GZXY39`) loads via Partytown, production builds only.
- Deploy: push to `main` (Vercel Git integration) or `vercel deploy --prod --yes`.
- Tests: `yarn test` (Playwright, builds then serves dist on :4322). Keep `data-*` hooks in the markup; the tests rely on them.
- Env vars (Vercel, both set): `FEEDBACK_GITHUB_TOKEN` (secret; feedback form -> GitHub issues), `PUBLIC_SENTRY_DSN` (added with `--type config`; lazy Sentry). Redeploy after changing either; PUBLIC_ values are baked in at build time.
- Feeds: `/events.json`, `/events.ics`, `/llms.txt` come from `src/lib/feed.ts`; keep them in sync with the event schema.
