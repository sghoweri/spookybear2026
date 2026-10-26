/* Client behaviour for the schedule: day tabs, filters, favourites ("my den"),
   the event dialog with shareable URLs, and the "Now" badge. Vanilla, no deps. */

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

type Filters = { day: string; venue: string; type: string; price: string; den: boolean };

const root = document.querySelector<HTMLElement>('[data-schedule]');
if (root) init(root);

function init(root: HTMLElement) {
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-event]'));
  const groups = Array.from(root.querySelectorAll<HTMLElement>('[data-day-group]'));
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-day-tab]'));
  const selects = Array.from(root.querySelectorAll<HTMLSelectElement>('select[data-filter]'));
  const denToggle = root.querySelector<HTMLButtonElement>('[data-den-toggle]')!;
  const denCount = root.querySelector<HTMLElement>('[data-den-count]')!;
  const den = root.querySelector<HTMLElement>('[data-den]')!;
  const denList = root.querySelector<HTMLElement>('[data-den-list]')!;
  const emptyAll = root.querySelector<HTMLElement>('[data-empty]')!;
  const dialog = root.querySelector<HTMLDialogElement>('[data-dialog]')!;
  const dialogBody = dialog.querySelector<HTMLElement>('[data-dialog-body]')!;
  const availableDays = new Set(groups.map((g) => g.dataset.dayGroup!));

  // ---- favourites -------------------------------------------------------
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

  function paintSaved(slug?: string) {
    const targets = slug ? [slug] : rows.map((r) => r.dataset.slug!);
    for (const s of targets) {
      const on = saved.has(s);
      document.querySelectorAll<HTMLElement>(`[data-paw="${s}"]`).forEach((b) => {
        b.setAttribute('aria-pressed', String(on));
        const label = b.querySelector('[data-paw-label]');
        if (label) label.textContent = on ? 'In my den' : 'Save to my den';
        else b.setAttribute('aria-label', `${on ? 'Remove' : 'Save'} ${titleFor(s)} ${on ? 'from' : 'to'} your den`);
      });
      document.querySelectorAll<HTMLElement>(`[data-event][data-slug="${s}"]`).forEach((r) => r.classList.toggle('is-saved', on));
      document.querySelectorAll<HTMLElement>(`[data-detail-slug="${s}"] [data-saved-badge]`).forEach((b) => (b.hidden = !on));
    }
    denCount.textContent = String(saved.size);
    renderDen();
  }

  function titleFor(slug: string): string {
    return rows.find((r) => r.dataset.slug === slug)?.querySelector('.row-title')?.textContent?.trim() ?? 'this event';
  }

  function renderDen() {
    denList.replaceChildren();
    const picks = rows.filter((r) => saved.has(r.dataset.slug!));
    for (const r of picks) {
      const clone = r.cloneNode(true) as HTMLElement;
      clone.removeAttribute('data-event');
      clone.dataset.denClone = '';
      denList.append(clone);
    }
    den.hidden = saved.size === 0 && !filters.den;
  }

  function toggleSave(slug: string, source?: HTMLElement) {
    if (saved.has(slug)) saved.delete(slug);
    else saved.add(slug);
    writeDen();
    paintSaved(slug);
    if (source && saved.has(slug)) {
      source.classList.remove('pop');
      void source.offsetWidth;
      source.classList.add('pop');
    }
    track(saved.has(slug) ? 'save_event' : 'unsave_event', slug);
  }

  // ---- filters ------------------------------------------------------------
  const filters: Filters = { day: defaultDay(), venue: '', type: '', price: '', den: false };

  function defaultDay(): string {
    const fromUrl = new URLSearchParams(location.search).get('day');
    if (fromUrl && (fromUrl === 'all' || availableDays.has(fromUrl))) return fromUrl;
    const initial = root.dataset.initialDay;
    if (initial && availableDays.has(initial)) return initial;
    const today = ptownDay();
    return today && availableDays.has(today) ? today : 'all';
  }

  /** Which weekend day it is in Provincetown right now; nights belong to the previous day until 5am. */
  function ptownDay(): string | null {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    let date = `${get('year')}-${get('month')}-${get('day')}`;
    const hour = Number(get('hour')) % 24;
    if (hour < 5) {
      const d = new Date(`${date}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      date = d.toISOString().slice(0, 10);
    }
    return DAY_IDS.find((id) => DAY_DATES[id] === date) ?? null;
  }

  function matches(r: HTMLElement): boolean {
    if (filters.day !== 'all' && r.dataset.day !== filters.day) return false;
    if (filters.venue) {
      if (filters.venue.startsWith('area:')) {
        if (r.dataset.area !== filters.venue.slice(5)) return false;
      } else if (r.dataset.venue !== filters.venue) return false;
    }
    if (filters.type && r.dataset.type !== filters.type) return false;
    if (filters.price && r.dataset.price !== filters.price) return false;
    if (filters.den && !saved.has(r.dataset.slug!)) return false;
    return true;
  }

  function apply() {
    let total = 0;
    for (const g of groups) {
      const id = g.dataset.dayGroup!;
      const dayOn = filters.day === 'all' || filters.day === id;
      let shown = 0;
      g.querySelectorAll<HTMLElement>('[data-event]').forEach((r) => {
        const ok = dayOn && matches(r);
        r.hidden = !ok;
        if (ok) shown++;
      });
      total += shown;
      g.hidden = !dayOn;
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
    denToggle.setAttribute('aria-pressed', String(filters.den));
    den.hidden = saved.size === 0 && !filters.den;
    const active = Boolean(filters.venue || filters.type || filters.price || filters.den);
    root.querySelectorAll<HTMLElement>('[data-clear]').forEach((b) => (b.hidden = !active));
  }

  function syncDayToUrl() {
    if (location.pathname !== '/') return;
    const url = new URL(location.href);
    url.searchParams.set('day', filters.day);
    history.replaceState(history.state, '', url);
  }

  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      filters.day = t.dataset.dayTab!;
      apply();
      syncDayToUrl();
      track('select_day', filters.day);
    }),
  );
  root.querySelector('[role="tablist"]')?.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'ArrowRight' && ke.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    const next = tabs[(i + (ke.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    next.click();
    ke.preventDefault();
  });
  selects.forEach((s) =>
    s.addEventListener('change', () => {
      (filters as Record<string, unknown>)[s.dataset.filter!] = s.value;
      apply();
      track('filter', `${s.dataset.filter}:${s.value || 'any'}`);
    }),
  );
  denToggle.addEventListener('click', () => {
    filters.den = !filters.den;
    apply();
    if (filters.den) den.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-clear]');
    if (!t) return;
    filters.venue = filters.type = filters.price = '';
    filters.den = false;
    selects.forEach((s) => (s.value = ''));
    apply();
  });

  // ---- dialog -----------------------------------------------------------
  let pushedOpen = false;
  let lastTrigger: HTMLElement | null = null;

  function openEvent(slug: string, { push = true, trigger }: { push?: boolean; trigger?: HTMLElement } = {}) {
    const tpl = root.querySelector<HTMLTemplateElement>(`template[data-detail="${slug}"]`);
    if (!tpl) return false;
    dialogBody.replaceChildren(tpl.content.cloneNode(true));
    paintSaved(slug);
    if (dialog.open && !dialog.matches(':modal')) dialog.close();
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('has-dialog');
    dialog.querySelector<HTMLElement>('.dialog-card')?.scrollTo(0, 0);
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
        const url = new URL(location.href);
        url.pathname = '/';
        url.searchParams.set('day', filters.day);
        history.replaceState({}, '', url);
      }
    }
    pushedOpen = false;
    lastTrigger?.focus();
    lastTrigger = null;
  }

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
    // Escape key or the close button (form method=dialog) landed here.
    if (document.body.classList.contains('has-dialog')) closeEvent();
  });
  dialog.addEventListener('click', (e) => {
    // Tap on the backdrop (outside the card) closes.
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
      if (nav.share) {
        await nav.share({ title, text: `${title} at Spooky Bear 2026`, url });
      } else {
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
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const today = `${get('year')}-${get('month')}-${get('day')}`;
    const nowMin = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
    for (const r of rows) {
      const { date, start, end } = r.dataset;
      const badge = r.querySelector<HTMLElement>('[data-now]');
      if (!badge || !start) continue;
      let s = toMin(start);
      let e = end ? toMin(end) : s + 180;
      if (e <= s) e += 24 * 60;
      let n = nowMin;
      if (date !== today) {
        // Could be the small hours of the following day.
        const next = new Date(`${date}T12:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        if (next.toISOString().slice(0, 10) === today) n += 24 * 60;
        else continue;
      }
      badge.hidden = !(n >= s && n < e);
    }
  }
  function toMin(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function track(action: string, label: string) {
    const w = window as Window & { dataLayer?: unknown[] };
    (w.dataLayer ??= []).push({ event: action, label });
  }

  // ---- boot -------------------------------------------------------------
  paintSaved();
  apply();
  paintNow();
  setInterval(paintNow, 60_000);

  const m = location.pathname.match(/^\/event\/([^/]+)\/?$/);
  if (m) {
    // Shared link: the server already rendered the detail; upgrade it to a modal.
    history.replaceState({ sbEvent: m[1] }, '', location.href);
    openEvent(decodeURIComponent(m[1]), { push: false });
  }
}
