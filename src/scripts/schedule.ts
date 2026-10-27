/* Client behaviour for the schedule: day tabs, multi-select filters, time window,
   fuzzy search, favourites ("my favs"), the event dialog with shareable URLs, and
   the "Now" badge. Vanilla TypeScript; fuse.js is loaded only when search opens. */

const TZ = 'America/New_York';
const DEN_KEY = 'sb26:den';
const DAY_IDS = ['wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_DATES: Record<string, string> = {
  wed: '2026-10-28',
  thu: '2026-10-29',
  fri: '2026-10-30',
  sat: '2026-10-31',
  sun: '2026-11-01',
};

const GRID_START = 9 * 60;
const GRID_SLOT = 15;
const GRID_SLOTS = (26 * 60 - GRID_START) / GRID_SLOT;
const VIEW_KEY = 'sb26:view';
const GROUP_KEY = 'sb26:group';

type Filters = {
  view: 'list' | 'grid';
  group: 'time' | 'venue';
  day: string;
  venue: Set<string>;
  type: Set<string>;
  price: Set<string>;
  from: string;
  to: string;
  den: boolean;
  q: string;
};
type SearchDoc = { slug: string; title: string; venue: string; venueFull: string; location: string; type: string; organizer: string; tags: string[]; description: string };

const root = document.querySelector<HTMLElement>('[data-schedule]');
if (root) init(root);

function init(root: HTMLElement) {
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-event]'));
  const groups = Array.from(root.querySelectorAll<HTMLElement>('[data-day-group]'));
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-day-tab]'));
  const tablist = root.querySelector<HTMLElement>('[role="tablist"]')!;
  const denToggle = root.querySelector<HTMLButtonElement>('[data-den-toggle]')!;
  const denCount = root.querySelector<HTMLElement>('[data-den-count]')!;
  const den = root.querySelector<HTMLElement>('[data-den]')!;
  const denList = root.querySelector<HTMLElement>('[data-den-list]')!;
  const emptyAll = root.querySelector<HTMLElement>('[data-empty]')!;
  const dialog = root.querySelector<HTMLDialogElement>('[data-dialog]')!;
  const dialogBody = dialog.querySelector<HTMLElement>('[data-dialog-body]')!;
  const filtersBar = root.querySelector<HTMLElement>('[data-filters]')!;
  const backdrop = root.querySelector<HTMLElement>('[data-menu-backdrop]')!;
  const searchToggle = root.querySelector<HTMLButtonElement>('[data-search-toggle]')!;
  const searchBar = root.querySelector<HTMLElement>('[data-search-bar]')!;
  const searchInput = root.querySelector<HTMLInputElement>('[data-search-input]')!;
  const searchNote = root.querySelector<HTMLElement>('[data-search-note]')!;
  const timeFrom = root.querySelector<HTMLInputElement>('[data-time-from]')!;
  const timeTo = root.querySelector<HTMLInputElement>('[data-time-to]')!;
  const availableDays = new Set(groups.map((g) => g.dataset.dayGroup!));
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isWide = () => matchMedia('(min-width: 720px)').matches;

  // ---- favourites -----------------------------------------------------------
  let saved = new Set<string>(readDen());

  function readDen(): string[] {
    try {
      const raw = localStorage.getItem(DEN_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string') : [];
    } catch {
      return [];
    }
  }
  function writeDen() {
    try {
      localStorage.setItem(DEN_KEY, JSON.stringify([...saved]));
    } catch {
      /* private mode etc. — favourites just won't persist */
    }
  }
  function titleFor(slug: string): string {
    return rows.find((r) => r.dataset.slug === slug)?.querySelector('.row-title')?.textContent?.trim() ?? 'this event';
  }
  function paintSaved(slug?: string) {
    const targets = slug ? [slug] : rows.map((r) => r.dataset.slug!);
    for (const s of targets) {
      const on = saved.has(s);
      document.querySelectorAll<HTMLElement>(`[data-paw="${s}"]`).forEach((b) => {
        b.setAttribute('aria-pressed', String(on));
        const label = b.querySelector('[data-paw-label]');
        if (label) label.textContent = on ? 'In my favs' : 'Save to my favs';
        else b.setAttribute('aria-label', `${on ? 'Remove' : 'Save'} ${titleFor(s)} ${on ? 'from' : 'to'} your favs`);
      });
      document.querySelectorAll<HTMLElement>(`[data-event][data-slug="${s}"], [data-grid-event][data-slug="${s}"]`).forEach((r) => r.classList.toggle('is-saved', on));
      document.querySelectorAll<HTMLElement>(`[data-detail-slug="${s}"] [data-saved-badge]`).forEach((b) => (b.hidden = !on));
    }
    denCount.textContent = String(saved.size);
    renderDen();
  }
  const DAY_LABELS: Record<string, string> = { wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
  const DAY_NICKS: Record<string, string> = { wed: 'Early arrivals', thu: 'Kickoff', fri: 'Devil\u2019s night', sat: 'Halloween', sun: 'Last call' };

  /** Favourites, grouped by day in weekend order (rows are already in schedule order). */
  function renderDen() {
    denList.replaceChildren();
    for (const day of DAY_IDS) {
      const picks = rows.filter((r) => r.dataset.day === day && saved.has(r.dataset.slug!));
      if (!picks.length) continue;
      const h = document.createElement('h3');
      h.className = 'den-day';
      h.textContent = DAY_LABELS[day];
      const nick = document.createElement('span');
      nick.textContent = DAY_NICKS[day];
      h.append(nick);
      const list = document.createElement('ol');
      list.className = 'rows';
      for (const r of picks) {
        const clone = r.cloneNode(true) as HTMLElement;
        clone.removeAttribute('data-event');
        clone.hidden = false;
        clone.dataset.denClone = '';
        list.append(clone);
      }
      denList.append(h, list);
    }
    den.hidden = saved.size === 0 && !filters.den;
  }
  function toggleSave(slug: string, source?: HTMLElement) {
    if (saved.has(slug)) saved.delete(slug);
    else saved.add(slug);
    writeDen();
    paintSaved(slug);
    if (source && saved.has(slug) && !prefersReducedMotion) {
      source.classList.remove('pop');
      void source.offsetWidth;
      source.classList.add('pop');
    }
    track(saved.has(slug) ? 'save_event' : 'unsave_event', slug);
  }

  // ---- filters ----------------------------------------------------------------
  const filters: Filters = readFiltersFromUrl();

  function readFiltersFromUrl(): Filters {
    const p = new URLSearchParams(location.search);
    const list = (k: string) => new Set((p.get(k) ?? '').split(',').filter(Boolean));
    const day = p.get('day');
    const initial = root.dataset.initialDay;
    const today = ptownDay();
    let storedView: string | null = null;
    let storedGroup: string | null = null;
    try {
      storedView = localStorage.getItem(VIEW_KEY);
      storedGroup = localStorage.getItem(GROUP_KEY);
    } catch {
      /* ignore */
    }
    const view = p.get('view') ?? storedView;
    const group = p.get('group') ?? storedGroup;
    return {
      view: view === 'grid' ? 'grid' : 'list',
      group: group === 'venue' ? 'venue' : 'time',
      day: day && (day === 'all' || availableDays.has(day)) ? day : initial && availableDays.has(initial) ? initial : today && availableDays.has(today) ? today : 'all',
      venue: list('venue'),
      type: list('type'),
      price: list('price'),
      from: validTime(p.get('from')),
      to: validTime(p.get('to')),
      den: p.get('den') === '1',
      q: (p.get('q') ?? '').slice(0, 80),
    };
  }
  function validTime(t: string | null) {
    return t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : '';
  }

  /** Which weekend day it is in Provincetown right now; nights belong to the previous day until 5am. */
  function ptownDay(): string | null {
    const { date, hour } = nowInPtown();
    let d = date;
    if (hour < 5) {
      const x = new Date(`${date}T12:00:00Z`);
      x.setUTCDate(x.getUTCDate() - 1);
      d = x.toISOString().slice(0, 10);
    }
    return DAY_IDS.find((id) => DAY_DATES[id] === d) ?? null;
  }
  function nowInPtown() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24, minute: Number(get('minute')) };
  }

  /** Minutes since midnight; anything before 5am counts as late the night before. */
  function toMin(t: string, shiftNight = true) {
    const [h, m] = t.split(':').map(Number);
    const v = h * 60 + m;
    return shiftNight && v < 5 * 60 ? v + 24 * 60 : v;
  }
  function timeWindow(): [number, number] | null {
    if (!filters.from && !filters.to) return null;
    const f = filters.from ? toMin(filters.from) : 0;
    let t = filters.to ? toMin(filters.to) : 30 * 60;
    if (t <= f) t += 24 * 60;
    return [f, t];
  }

  let searchHits: Set<string> | null = null;

  function matches(r: HTMLElement, win: [number, number] | null): boolean {
    const d = r.dataset;
    if (filters.venue.size) {
      let ok = false;
      for (const v of filters.venue) if (v.startsWith('area:') ? d.area === v.slice(5) : d.venue === v) ok = true;
      if (!ok) return false;
    }
    if (filters.type.size && !filters.type.has(d.type!)) return false;
    if (filters.price.size && !filters.price.has(d.price!)) return false;
    if (filters.den && !saved.has(d.slug!)) return false;
    if (searchHits && !searchHits.has(d.slug!)) return false;
    if (win) {
      if (!d.start) return false;
      const s = toMin(d.start);
      let e = d.end ? toMin(d.end) : s + 120;
      if (e <= s) e += 24 * 60;
      if (!(s < win[1] && e > win[0])) return false;
    }
    return true;
  }

  function apply() {
    const win = timeWindow();
    const searching = Boolean(searchHits);
    let total = 0;
    for (const g of groups) {
      const id = g.dataset.dayGroup!;
      const dayOn = searching || filters.day === 'all' || filters.day === id;
      let shown = 0;
      g.querySelectorAll<HTMLElement>('[data-event]').forEach((r) => {
        const ok = dayOn && matches(r, win);
        r.hidden = !ok;
        if (ok) shown++;
      });
      total += shown;
      g.hidden = !dayOn || (searching && shown === 0);
      syncGrid(g, win);
      syncVenueGroups(g);
      const empty = g.querySelector<HTMLElement>('[data-day-empty]');
      if (empty) empty.hidden = !dayOn || shown > 0;
      const count = g.querySelector<HTMLElement>('[data-day-count]');
      if (count) {
        const all = g.querySelectorAll('[data-event]').length;
        count.textContent = shown === all ? `${all} ${all === 1 ? 'event' : 'events'}` : `${shown} of ${all}`;
      }
    }
    emptyAll.hidden = total > 0;
    tabs.forEach((t) => {
      const on = t.dataset.dayTab === filters.day;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    tablist.classList.toggle('is-muted', searching);
    searchNote.hidden = !searching;
    denToggle.setAttribute('aria-pressed', String(filters.den));
    den.hidden = saved.size === 0 && !filters.den;
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === filters.view)));
    groupToggle.setAttribute('aria-pressed', String(filters.group === 'venue'));
    groupToggle.hidden = filters.view === 'grid';
    const active = Boolean(filters.venue.size || filters.type.size || filters.price.size || filters.den || win || filters.q);
    filtersBar.querySelectorAll<HTMLElement>('[data-clear]').forEach((b) => (b.hidden = !active));
    paintMenus();
    syncUrl();
  }

  function syncUrl() {
    if (location.pathname !== '/') return;
    const p = new URLSearchParams();
    p.set('day', filters.day);
    if (filters.venue.size) p.set('venue', [...filters.venue].join(','));
    if (filters.type.size) p.set('type', [...filters.type].join(','));
    if (filters.price.size) p.set('price', [...filters.price].join(','));
    if (filters.from) p.set('from', filters.from);
    if (filters.to) p.set('to', filters.to);
    if (filters.den) p.set('den', '1');
    if (filters.q) p.set('q', filters.q);
    if (filters.view === 'grid') p.set('view', 'grid');
    if (filters.group === 'venue') p.set('group', 'venue');
    history.replaceState(history.state, '', `/?${p.toString()}`);
  }

  // ---- list grouped by venue ------------------------------------------------------
  const groupToggle = root.querySelector<HTMLButtonElement>('[data-group-toggle]')!;
  /** Original time-ordered rows per day, so we can restore them. */
  const originalRows = new Map<HTMLElement, HTMLElement[]>(groups.map((g) => [g, Array.from(g.querySelectorAll<HTMLElement>('[data-list] > [data-event]'))]));
  groupToggle.addEventListener('click', () => {
    filters.group = filters.group === 'venue' ? 'time' : 'venue';
    try {
      localStorage.setItem(GROUP_KEY, filters.group);
    } catch {
      /* ignore */
    }
    apply();
    track('group', filters.group);
  });

  /** Move each day's rows into per-venue sections (or back into the time-ordered list). */
  function syncVenueGroups(g: HTMLElement) {
    const list = g.querySelector<HTMLElement>('[data-list]');
    const wrap = g.querySelector<HTMLElement>('[data-venue-groups]');
    const rowsHere = originalRows.get(g);
    if (!list || !wrap || !rowsHere) return;
    const byVenue = filters.group === 'venue' && filters.view === 'list';
    if (!byVenue) {
      if (!wrap.hidden) {
        list.append(...rowsHere);
        wrap.replaceChildren();
        wrap.hidden = true;
        list.hidden = false;
      }
      return;
    }
    if (wrap.hidden) {
      // Build sections: venues ordered by how many events they have, then by name.
      const counts = new Map<string, { name: string; area: string; rows: HTMLElement[] }>();
      for (const r of rowsHere) {
        const id = r.dataset.venue!;
        const entry = counts.get(id) ?? { name: r.querySelector('.row-venue')?.textContent?.trim() ?? id, area: r.dataset.area ?? '', rows: [] };
        entry.rows.push(r);
        counts.set(id, entry);
      }
      const ordered = [...counts.entries()].sort((a, b) => b[1].rows.length - a[1].rows.length || a[1].name.localeCompare(b[1].name));
      for (const [id, v] of ordered) {
        const section = document.createElement('section');
        section.className = 'venue-group';
        section.dataset.venueGroup = id;
        const h = document.createElement('h3');
        h.className = 'venue-head';
        h.innerHTML = `<span>${escapeHtml(v.name)}<span class="venue-area">${escapeHtml(v.area)}</span></span><small data-venue-count></small>`;
        const ol = document.createElement('ol');
        ol.className = 'rows';
        ol.append(...v.rows);
        section.append(h, ol);
        wrap.append(section);
      }
      wrap.hidden = false;
      list.hidden = true;
    }
    wrap.querySelectorAll<HTMLElement>('[data-venue-group]').forEach((sec) => {
      const all = sec.querySelectorAll('[data-event]').length;
      const shown = sec.querySelectorAll('[data-event]:not([hidden])').length;
      sec.hidden = shown === 0;
      const c = sec.querySelector('[data-venue-count]');
      if (c) c.textContent = shown === all ? `${all} ${all === 1 ? 'event' : 'events'}` : `${shown} of ${all}`;
    });
  }
  function escapeHtml(t: string) {
    return t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
  }

  // ---- grid view --------------------------------------------------------------
  const viewBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-view]'));
  viewBtns.forEach((b) =>
    b.addEventListener('click', () => {
      const v = b.dataset.view === 'grid' ? 'grid' : 'list';
      if (v === filters.view) return;
      filters.view = v;
      try {
        localStorage.setItem(VIEW_KEY, v);
      } catch {
        /* ignore */
      }
      apply();
      if (v === 'grid') scrollGridsToStart();
      track('view', v);
    }),
  );

  function slotOf(min: number) {
    return Math.min(GRID_SLOTS, Math.max(0, Math.round((min - GRID_START) / GRID_SLOT)));
  }

  /** Mirror the list's row visibility onto the day's grid blocks, collapse empty lanes, toggle views. */
  function syncGrid(g: HTMLElement, win: [number, number] | null) {
    const list = g.querySelector<HTMLElement>('[data-list]');
    const grid = g.querySelector<HTMLElement>('[data-grid]');
    if (!list || !grid) return;
    const showGrid = filters.view === 'grid';
    grid.hidden = !showGrid;
    if (!showGrid) {
      if (filters.group !== 'venue') list.hidden = false;
      return;
    }
    list.hidden = true;
    const wrap = g.querySelector<HTMLElement>('[data-venue-groups]');
    if (wrap && !wrap.hidden) {
      // Put rows back so counts/visibility logic stays simple while the grid is shown.
      list.append(...(originalRows.get(g) ?? []));
      wrap.replaceChildren();
      wrap.hidden = true;
    }
    const hiddenBySlug = new Map<string, boolean>();
    g.querySelectorAll<HTMLElement>('[data-event]').forEach((r) => hiddenBySlug.set(r.dataset.slug!, r.hidden));
    const laneHasVisible = new Map<string, boolean>();
    grid.querySelectorAll<HTMLElement>('[data-grid-event]').forEach((b) => {
      const hidden = hiddenBySlug.get(b.dataset.slug!) ?? true;
      b.hidden = hidden;
      if (!hidden) laneHasVisible.set(b.dataset.lane!, true);
    });
    // Renumber visible lanes so the grid has no gaps; a label spans whichever of its lanes remain.
    const laneRow = new Map<string, number>();
    let n = 0;
    grid.querySelectorAll<HTMLElement>('[data-grid-lane]').forEach((l) => {
      const covers = (l.dataset.covers ?? l.dataset.gridLane!).split(',');
      const live = covers.filter((id) => laneHasVisible.get(id) === true);
      l.hidden = live.length === 0;
      if (!live.length) return;
      const firstRow = n + 2;
      for (const id of live) {
        n++;
        laneRow.set(id, n + 1);
      }
      l.style.gridRow = `${firstRow} / span ${live.length}`;
    });
    grid.querySelectorAll<HTMLElement>('[data-grid-event]').forEach((b) => {
      const row = laneRow.get(b.dataset.lane!);
      if (row) b.style.gridRow = String(row);
    });
    const table = grid.querySelector<HTMLElement>('[data-grid-table]');
    table?.style.setProperty('--lanes', String(Math.max(n, 1)));
    // Time-window shading.
    const shade = grid.querySelector<HTMLElement>('[data-grid-shade]');
    if (shade) {
      if (win) {
        shade.hidden = false;
        shade.style.gridColumn = `${slotOf(win[0]) + 2} / ${Math.max(slotOf(win[0]) + 3, slotOf(win[1]) + 2)}`;
      } else shade.hidden = true;
    }
    paintGridNow(g);
  }

  function paintGridNow(g: HTMLElement) {
    const now = g.querySelector<HTMLElement>('[data-grid-now]');
    if (!now) return;
    const { date, hour, minute } = nowInPtown();
    let m = hour * 60 + minute;
    let day = date;
    if (hour < 5) {
      m += 24 * 60;
      const x = new Date(`${date}T12:00:00Z`);
      x.setUTCDate(x.getUTCDate() - 1);
      day = x.toISOString().slice(0, 10);
    }
    const isToday = DAY_DATES[g.dataset.dayGroup!] === day;
    const inRange = m >= GRID_START && m < GRID_START + GRID_SLOTS * GRID_SLOT;
    now.hidden = !(isToday && inRange);
    if (!now.hidden) now.style.gridColumn = String(slotOf(m) + 2);
  }

  /** First time a grid shows, scroll it to "now" during the weekend, otherwise to early afternoon. */
  function scrollGridsToStart() {
    root.querySelectorAll<HTMLElement>('[data-day-group]:not([hidden]) [data-grid]:not([hidden])').forEach((grid) => {
      const scroller = grid.querySelector<HTMLElement>('.grid-scroll');
      if (!scroller || scroller.dataset.scrolled) return;
      scroller.dataset.scrolled = '1';
      const slotW = parseFloat(getComputedStyle(grid).getPropertyValue('--slot-w')) || 26;
      const now = grid.querySelector<HTMLElement>('[data-grid-now]');
      let target = 14 * 60;
      if (now && !now.hidden) {
        const { hour, minute } = nowInPtown();
        target = (hour < 5 ? hour + 24 : hour) * 60 + minute - 60;
      }
      scroller.scrollLeft = Math.max(0, (slotOf(target) - 2) * slotW);
    });
  }

  function clearAll() {
    filters.venue.clear();
    filters.type.clear();
    filters.price.clear();
    filters.from = filters.to = '';
    filters.den = false;
    root.querySelectorAll<HTMLInputElement>('[data-menu] input[type="checkbox"]').forEach((c) => (c.checked = false));
    timeFrom.value = timeTo.value = '';
    setSearch('', { closeBar: true });
  }

  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      filters.day = t.dataset.dayTab!;
      if (searchHits) setSearch('', { closeBar: true });
      else apply();
      if (filters.view === 'grid') scrollGridsToStart();
      track('select_day', filters.day);
    }),
  );
  tablist.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'ArrowRight' && ke.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    const next = tabs[(i + (ke.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    next.click();
    ke.preventDefault();
  });
  denToggle.addEventListener('click', () => {
    filters.den = !filters.den;
    apply();
    if (filters.den) den.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  });
  root.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-clear]')) clearAll();
  });

  // ---- menus (multi-select dropdowns) --------------------------------------------
  const menus = Array.from(root.querySelectorAll<HTMLElement>('[data-menu]'));
  let openMenu: HTMLElement | null = null;

  function menuParts(m: HTMLElement) {
    return {
      id: m.dataset.menu as 'venue' | 'type' | 'price' | 'time',
      button: m.querySelector<HTMLButtonElement>('[data-menu-button]')!,
      panel: m.querySelector<HTMLElement>('[data-menu-panel]')!,
      count: m.querySelector<HTMLElement>('[data-menu-count]')!,
      label: m.querySelector<HTMLElement>('[data-menu-label]')!,
    };
  }
  function setMenuOpen(m: HTMLElement | null) {
    if (openMenu && openMenu !== m) {
      const p = menuParts(openMenu);
      p.panel.hidden = true;
      p.button.setAttribute('aria-expanded', 'false');
    }
    openMenu = m;
    if (m) {
      const p = menuParts(m);
      p.panel.hidden = false;
      p.button.setAttribute('aria-expanded', 'true');
      m.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      if (isWide()) p.panel.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true });
    }
    backdrop.hidden = !m;
    filtersBar.classList.toggle('has-open', Boolean(m));
    document.body.classList.toggle('has-sheet', Boolean(m) && !isWide());
  }
  function paintMenus() {
    for (const m of menus) {
      const p = menuParts(m);
      if (p.id === 'time') {
        const on = Boolean(filters.from || filters.to);
        p.label.textContent = on ? `${filters.from ? fmt(filters.from) : 'Any'} to ${filters.to ? fmt(filters.to) : 'late'}` : 'Time';
        p.count.hidden = true;
        p.button.classList.toggle('is-active', on);
        m.querySelectorAll<HTMLElement>('[data-time-preset]').forEach((b) => {
          const [f, t] = b.dataset.timePreset!.split('|');
          b.classList.toggle('is-on', filters.from === f && filters.to === t);
        });
        continue;
      }
      const set = filters[p.id];
      const n = set.size;
      let text = '';
      if (n === 1) {
        const only = m.querySelector<HTMLInputElement>(`input[value="${CSS.escape([...set][0])}"]`);
        text = only?.parentElement?.querySelector('.fm-text')?.textContent?.trim() ?? '';
      }
      p.label.textContent = n === 1 && text ? text : p.id === 'venue' ? 'Location' : p.id === 'type' ? 'Type' : 'Price';
      p.count.hidden = n < 2;
      p.count.textContent = String(n);
      p.button.classList.toggle('is-active', n > 0);
    }
  }
  function fmt(t: string) {
    const [h, m] = t.split(':').map(Number);
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}${m ? ':' + String(m).padStart(2, '0') : ''}${h >= 12 ? 'pm' : 'am'}`;
  }
  for (const m of menus) {
    const p = menuParts(m);
    p.button.addEventListener('click', () => setMenuOpen(openMenu === m ? null : m));
    m.querySelector('[data-menu-done]')?.addEventListener('click', () => setMenuOpen(null));
    m.querySelector('[data-menu-clear]')?.addEventListener('click', () => {
      if (p.id === 'time') {
        filters.from = filters.to = '';
        timeFrom.value = timeTo.value = '';
      } else {
        filters[p.id].clear();
        m.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((c) => (c.checked = false));
      }
      apply();
    });
    m.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.type === 'checkbox') {
        const set = filters[p.id as 'venue' | 'type' | 'price'];
        if (input.checked) set.add(input.value);
        else set.delete(input.value);
        apply();
        track('filter', `${p.id}:${input.value}:${input.checked ? 'on' : 'off'}`);
      } else if (input === timeFrom || input === timeTo) {
        filters.from = validTime(timeFrom.value);
        filters.to = validTime(timeTo.value);
        apply();
        track('filter', `time:${filters.from || '-'}-${filters.to || '-'}`);
      }
    });
    m.querySelectorAll<HTMLButtonElement>('[data-time-preset]').forEach((b) =>
      b.addEventListener('click', () => {
        const [f, t] = b.dataset.timePreset!.split('|');
        const same = filters.from === f && filters.to === t;
        filters.from = same ? '' : f;
        filters.to = same ? '' : t;
        timeFrom.value = filters.from;
        timeTo.value = filters.to;
        apply();
      }),
    );
  }
  backdrop.addEventListener('click', () => setMenuOpen(null));
  document.addEventListener('click', (e) => {
    if (openMenu && !openMenu.contains(e.target as Node) && e.target !== backdrop) setMenuOpen(null);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openMenu) {
      const b = menuParts(openMenu).button;
      setMenuOpen(null);
      b.focus();
    }
  });
  // Restore checkbox state from the URL.
  for (const id of ['venue', 'type', 'price'] as const) {
    for (const v of filters[id]) {
      const c = root.querySelector<HTMLInputElement>(`[data-menu="${id}"] input[value="${CSS.escape(v)}"]`);
      if (c) c.checked = true;
      else filters[id].delete(v);
    }
  }
  timeFrom.value = filters.from;
  timeTo.value = filters.to;

  // ---- search (fuse.js, loaded on demand) ------------------------------------------
  type FuseLike = { search: (q: string, o?: { limit?: number }) => { item: SearchDoc }[] };
  let fuse: Promise<FuseLike> | null = null;
  let searchSeq = 0;

  function loadSearch(): Promise<FuseLike> {
    fuse ??= Promise.all([import('fuse.js'), fetch('/search-index.json').then((r) => r.json() as Promise<SearchDoc[]>)]).then(
      ([mod, docs]) =>
        new mod.default(docs, {
          includeScore: true,
          ignoreLocation: true,
          threshold: 0.34,
          minMatchCharLength: 2,
          keys: [
            { name: 'title', weight: 3 },
            { name: 'venue', weight: 2 },
            { name: 'venueFull', weight: 1.5 },
            { name: 'location', weight: 1.2 },
            { name: 'organizer', weight: 1.5 },
            { name: 'type', weight: 1.2 },
            { name: 'tags', weight: 1 },
            { name: 'description', weight: 0.8 },
          ],
        }) as unknown as FuseLike,
    );
    return fuse;
  }
  function openSearch() {
    setMenuOpen(null);
    searchBar.hidden = false;
    searchToggle.setAttribute('aria-expanded', 'true');
    searchInput.focus();
    void loadSearch();
  }
  function setSearch(q: string, { closeBar = false } = {}) {
    filters.q = q.trim();
    searchInput.value = q;
    if (closeBar) {
      searchBar.hidden = true;
      searchToggle.setAttribute('aria-expanded', 'false');
    }
    if (filters.q.length < 2) {
      searchHits = null;
      apply();
      return;
    }
    const seq = ++searchSeq;
    loadSearch().then((f) => {
      if (seq !== searchSeq) return;
      searchHits = new Set(f.search(filters.q, { limit: 60 }).map((r) => r.item.slug));
      apply();
      track('search', filters.q);
    });
  }
  let debounce = 0;
  searchToggle.addEventListener('click', () => {
    if (searchBar.hidden) openSearch();
    else setSearch('', { closeBar: true });
  });
  searchToggle.addEventListener('pointerenter', () => void loadSearch(), { once: true });
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = window.setTimeout(() => setSearch(searchInput.value), 140);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setSearch('', { closeBar: true });
    if (e.key === 'Enter') {
      e.preventDefault();
      searchInput.blur();
    }
  });
  root.querySelector('[data-search-close]')?.addEventListener('click', () => setSearch('', { closeBar: true }));
  if (filters.q) {
    searchBar.hidden = false;
    searchToggle.setAttribute('aria-expanded', 'true');
    searchInput.value = filters.q;
    setSearch(filters.q);
  }

  // ---- dialog -----------------------------------------------------------
  let pushedOpen = false;
  let lastTrigger: HTMLElement | null = null;
  const fragments = new Map<string, Promise<DocumentFragment>>();

  function loadFragment(slug: string): Promise<DocumentFragment> {
    let p = fragments.get(slug);
    if (!p) {
      p = fetch(`/fragments/${encodeURIComponent(slug)}`, { headers: { accept: 'text/html' } })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          doc.querySelectorAll('link, style, script').forEach((n) => n.remove());
          const frag = document.createDocumentFragment();
          frag.append(...Array.from(doc.body.childNodes));
          return frag;
        });
      p.catch(() => fragments.delete(slug));
      fragments.set(slug, p);
    }
    return p;
  }
  function showDialog() {
    setMenuOpen(null);
    // A server-rendered <dialog open> (shared links) is non-modal. Drop the attribute
    // instead of calling close(), which would queue a 'close' event that fires after
    // showModal() and would tear the modal straight back down.
    if (dialog.open && !dialog.matches(':modal')) dialog.removeAttribute('open');
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('has-dialog');
    dialog.querySelector<HTMLElement>('.dialog-card')?.scrollTo(0, 0);
  }
  let opening = 0;
  function openEvent(slug: string, { push = true, trigger }: { push?: boolean; trigger?: HTMLElement } = {}) {
    if (!rows.some((r) => r.dataset.slug === slug)) return false;
    const token = ++opening;
    const prerendered = dialogBody.querySelector(`[data-detail-slug="${slug}"]`);
    if (!prerendered) {
      dialogBody.innerHTML = '<div class="dialog-loading" aria-busy="true"><span></span><span></span><span></span></div>';
      loadFragment(slug).then(
        (frag) => {
          if (token !== opening) return;
          dialogBody.replaceChildren(frag.cloneNode(true));
          paintSaved(slug);
        },
        () => {
          if (token !== opening) return;
          dialogBody.innerHTML = `<div class="dialog-loading"><p>Couldn’t load this event. <a href="/event/${slug}">Open its page instead</a>.</p></div>`;
        },
      );
    }
    showDialog();
    paintSaved(slug);
    lastTrigger = trigger ?? null;
    if (push) {
      history.pushState({ sbEvent: slug }, '', `/event/${slug}`);
      pushedOpen = true;
    }
    document.title = `${titleFor(slug)} | Spooky Bear 2026`;
    track('view_event', slug);
    return true;
  }
  function closeEvent({ viaHistory = false } = {}) {
    if (dialog.open) dialog.close();
    document.body.classList.remove('has-dialog');
    dialogBody.replaceChildren();
    document.title = 'Spooky Bear 2026: Provincetown Halloween weekend schedule';
    if (!viaHistory) {
      if (pushedOpen) history.back();
      else {
        history.replaceState({}, '', '/');
        syncUrl();
      }
    }
    pushedOpen = false;
    lastTrigger?.focus();
    lastTrigger = null;
  }
  const warm = (e: Event) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-open]');
    if (a) loadFragment(a.dataset.open!);
  };
  root.addEventListener('pointerenter', warm, true);
  root.addEventListener('touchstart', warm, { capture: true, passive: true });
  root.addEventListener('focusin', warm);

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const paw = target.closest<HTMLElement>('[data-paw]');
    if (paw) {
      e.preventDefault();
      toggleSave(paw.dataset.paw!, paw);
      return;
    }
    const share = target.closest<HTMLElement>('[data-share]');
    if (share) {
      e.preventDefault();
      shareEvent(share);
      return;
    }
    const open = target.closest<HTMLAnchorElement>('[data-open]');
    if (open && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
      if (openEvent(open.dataset.open!, { trigger: open })) e.preventDefault();
    }
  });
  dialog.addEventListener('close', () => {
    if (document.body.classList.contains('has-dialog')) closeEvent();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeEvent();
  });
  window.addEventListener('popstate', () => {
    const m = location.pathname.match(/^\/event\/([^/]+)\/?$/);
    if (m) openEvent(decodeURIComponent(m[1]), { push: false });
    else if (dialog.open) {
      pushedOpen = false;
      closeEvent({ viaHistory: true });
    }
  });

  async function shareEvent(btn: HTMLElement) {
    const url = btn.dataset.share!;
    const title = btn.dataset.shareTitle ?? 'Spooky Bear 2026';
    const label = btn.querySelector<HTMLElement>('[data-share-label]') ?? btn;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    try {
      if (nav.share) await nav.share({ title, text: `${title} at Spooky Bear 2026`, url });
      else {
        await navigator.clipboard.writeText(url);
        flash(label, 'Link copied');
      }
      track('share', url);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') flash(label, 'Copy failed');
    }
  }
  function flash(el: HTMLElement, text: string) {
    const prev = el.textContent;
    el.textContent = text;
    setTimeout(() => (el.textContent = prev), 1800);
  }

  // ---- "Now" badge ----------------------------------------------------------
  function paintNow() {
    const { date: today, hour, minute } = nowInPtown();
    const nowMin = hour * 60 + minute;
    for (const r of rows) {
      const { date, start, end } = r.dataset;
      const badge = r.querySelector<HTMLElement>('[data-now]');
      if (!badge || !start) continue;
      const s = toMin(start, false);
      let e = end ? toMin(end, false) : s + 180;
      if (e <= s) e += 24 * 60;
      let n = nowMin;
      if (date !== today) {
        const next = new Date(`${date}T12:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        if (next.toISOString().slice(0, 10) === today) n += 24 * 60;
        else continue;
      }
      badge.hidden = !(n >= s && n < e);
    }
  }

  function track(action: string, label: string) {
    const w = window as Window & { dataLayer?: unknown[] };
    (w.dataLayer ??= []).push({ event: action, label });
  }

  // ---- boot -------------------------------------------------------------------
  paintSaved();
  apply();
  paintNow();
  if (filters.view === 'grid') scrollGridsToStart();
  setInterval(() => {
    paintNow();
    groups.forEach(paintGridNow);
  }, 60_000);

  const m = location.pathname.match(/^\/event\/([^/]+)\/?$/);
  if (m) {
    history.replaceState({ sbEvent: m[1] }, '', location.href);
    openEvent(decodeURIComponent(m[1]), { push: false });
  }
}
