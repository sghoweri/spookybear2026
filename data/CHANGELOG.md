# Data changelog

What changed in the schedule data and when. Newest first. Source checks use `npm run update:fetch`.

## 2026-10-28

Source sweep against yesterday's snapshots (kept a copy this time, so the diffs are real). Eight sources changed; all but one were tokens, widget versions or the Crown's list window rolling forward a day.

**Removed**

- `the-popes-holy-halloween-spooktacular-sat`: the Saturday Oct 31 show is gone from the Pilgrim House calendar, the ticket page's date dropdown offers only Friday Oct 30, and ptownie lists Friday only. Friday's entry now says so. Re-add if the venue restores it.

**Checked, no change needed**

- Provincetown Inn and Governor Bradford still 403 the fetcher but load with a browser UA: Scott Allan (doors 5:30, show 6 to 7:30, signing to 8) and Zombie Drag Brunch 3 (11am and 1pm) match; the Gov's page is now generic ("karaoke Wednesday through Sunday"), nothing contradicting our entries.
- Crown & Anchor list now covers Oct 28 to 31; same events as before.
- Boatslip widget, Out x Out, Tin Pan Alley, sickening.events: noise only (new sickening items are DC, NYC and Portland).

**Not added**

- PBG calendar added a Center for Coastal Studies "Whale Walks" outing Thu Oct 29, 11am to 12:30pm at Herring Cove ($15 suggested). Not Spooky Bear related; skipped.

## 2026-10-27

Overnight source sweep: 8 of 18 sources changed, almost all cosmetic (timestamps, reordered markup). Provincetown Inn and Governor Bradford now return HTTP 403 to the fetcher, so those two were checked by hand against the existing entries.

**Added**

- `a-house-{thu..sun}`: **A-House Halloween Weekend**, Thu Oct 29 to Sun Nov 1, doors 10pm, costume contest and prizes. From the poster on ahouse.com/#events (spotted after the placeholders went up). Wednesday stays a placeholder.
- `a-house-wed` and `shipwreck-lounge-{wed..sun}`: standing "open nightly" placeholder entries so the two bars show up in the list, grid and venue filter even without posted Spooky Bear events. Flagged `placeholder: true` (new schema field): styled as a hint, kept out of the calendar feed, the hero count and structured data. Requested via site feedback (GitHub issue #2).
- `come-and-scrum-all-that-jazz`: Boston Ironsides RFC fundraiser, Sat Oct 31, 12:30–3:30pm, Harbor Lounge, 1920s jazz theme. From the club's flyer (shared by Salem); not yet on the club site or any Ptown calendar, so price is left open.
- `queer-figure-drawing-bill-and-hogan`: Fri Oct 30, 2:00–3:30pm, Eric Lesh Gallery (new venue, 237 Commercial St). From the Provincetown Business Guild Halloween calendar.
- `book-signing-glam-reapers-guide-to-slaying`: Fri Oct 30, 6:30–8:00pm, Eric Lesh Gallery, free. Same source.

**Checked, no change needed**

- Crown & Anchor: every listed Spooky Bear event already matches (Carve Me Daddy, Wave of Terror, FAT SLUT, both Burner Brunch seatings, Witch Perfect ×2, Sirens, The Vault ×3, Mixtape, Motherdisco, Crown Ghouls ×2, Rest in Piano, Drop Dead, Death Becomes Them, Tryster Act ×2, Booo-b Bash).
- Boatslip calendar widget: Solid Gold Tea (Thu, Sun), Halloween Uniform Tea (Fri), Spooky Tea 4–9pm (Sat) all match.
- Pilgrim House: the Friday 9pm Peter & Paige piano set was already noted in the 6pm entry.
- Gifford House / sickening.events: Destroy Mona, Stranger Queen, Townie Masquerade, All Hallows Tea match. The 15 removed lines were other cities' listings on the shared ticketing page.
- Out x Out guide: trivial edits, event list unchanged.

**Not added (unconfirmed)**

- "A to Z: Piano Night with Alexander Zenoz – Spooky Bear" at the Crown. The Crown's own page dates it Oct 25 and Oct 27 (outside the window). The PBG calendar lists it Sat Oct 31 6:30–9pm, but the Crown's Oct 31 list shows Rest in Piano with Lily Mae in that slot instead, so the PBG entry looks stale. Re-check if the Crown updates.
