## Notes

**Dead / unfetchable sources**
- `boatslipresort.com` 301-redirects to `theboatslip.com`. `theboatslip.com/events/` is 404; the real page is `theboatslip.com/pages/events`, which rate-limited WebFetch (429) and renders its calendar client-side via an Elfsight widget. The widget JSON was pulled directly (`core.service.elfsight.com/p/boot/?w=588829d7-aa7e-42e8-8c6d-df5b85ccca54`) – that is the source for the four Boatslip tea entries and their images.
- `spookybear.com` is a parked HugeDomains page.
- `ursamen.org/spookybear` publishes its schedule only as a JPG; it was downloaded and read (all times/venues match it). Both Zeffy ticket pages (Monster Mash, Bingo) are Cloudflare/JS-gated – 403 to WebFetch and curl – so Ursamen ticket prices are unknown.
- `ahouse.com` loads but its "Upcoming Events" section is empty (no feed, no scripts, no Instagram embed); `ahouse.com/events` is 403. No 2026 A-House Halloween listing is indexed anywhere (ptownie calendar, Out x Out, ptownperch, gaytravel4u, chamber, tourism all silent).
- `thepiedbar.com` – DNS does not resolve; `piedbar.com` hung. No Pied Bar website or 2026 Halloween listing found anywhere.
- `giffordhouse.com` currently serves spam/slot content, not the inn.
- `ptownbears.events` calendar shows 0 events for Oct 28–Nov 2, 2026.
- Tryst "Witch Perfect" ticket pages show no price tiers (reserved-seat picker), so those prices are null.
- Bear World Magazine "Ursamen reveal schedule" article and the ptownie "Spooky Bear Weekend in Provincetown" feature are 2024 and 2023 respectively – not used for 2026 data. The ptownie "huge halloween dance costume party" (Possessed) article is 2021.

**Regular hours found**
- Boatslip: Tea Dance starts 4 PM, roughly a 3-hour DJ set (DJ Maryalice), Fri–Sun in shoulder season. The 2026 season continues past Halloween: Dog Tag Tea Nov 6, Heated Rival-Tea Nov 7, "The Very Last Dance 2026" Nov 8; reopens "First Tea 2027" May 7, 2027. No cover price published. Phone (508) 487-1669.
- Crown & Anchor: Restaurant & Courtyard shows are free/no-cover; everything else ticketed via tryst.events/profile/crown-anchor-provincetown. Phone 508-487-1430.
- A-House: "Open Year Round / 365 nights"; third-party listings say roughly 4 PM–1 AM weekdays, noon–1 AM weekends (unverified). Three rooms: Little Bar, Macho Bar, Big Room/Dance Club. Phone (508) 487-3169.
- Pied Bar: no 2026 hours found; an undated guide describes an after-tea party 6:30–9:30 PM, women's club after 10 PM.

**Suspected but unconfirmed**
- A-House almost certainly runs its usual Halloween-night dance/costume party in the Big Room (historically with cash costume prizes, e.g. 2019 with DJ David LaSalle) and Macho Bar is a bear-weekend staple, but nothing for 2026 is published. Check @ahouseptown Instagram.
- The Vault "three nights" wording implies a Sunday Nov 1 edition, but the Crown calendar only lists Oct 30 and Oct 31.
- Motherdisco and Death Becomes Them are very likely in the Paramount, but the Crown pages don't name the room.
- Boatslip may charge a door cover for Spooky Tea (extended hours) – not stated anywhere.
- Pied Bar may be closed for the season after Women's Week (Oct 12–18); no listing exists either way.
- Off-target events left out: Red Room Belly underwear party (Fri 9:30 PM), Possessed 7 (Sat 10 PM, $1,000 costume prize), Thirsty Burlington "Spooky Cher" (Fri 8:30 PM), Furball (Thu 9:30 PM); Keyhole at Provincetown Inn "Prohibition Pawty" (Sat 6–8 PM, on the official Ursamen schedule); Gifford House Stranger Queen / Destroy Mona / Country Line Dancing.

Scratch files (downloaded HTML, Elfsight JSON, Ursamen flyers): /private/tmp/claude-501/-Users-salemcobalt-sites-spookybear2026/a3213fe9-e4e5-4d74-9793-4337ec107afc/scratchpad/dl/
