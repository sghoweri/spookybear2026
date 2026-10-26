/* Feedback dialog: opens from any [data-feedback] trigger, posts to /api/feedback. */

type Kind = 'wrong' | 'event' | 'bug';

const dialog = document.querySelector<HTMLDialogElement>('[data-feedback-dialog]');
if (dialog) init(dialog);

function init(dialog: HTMLDialogElement) {
  const form = dialog.querySelector<HTMLFormElement>('[data-feedback-form]')!;
  const stepForm = dialog.querySelector<HTMLElement>('[data-fb-step="form"]')!;
  const stepDone = dialog.querySelector<HTMLElement>('[data-fb-step="done"]')!;
  const error = dialog.querySelector<HTMLElement>('[data-fb-error]')!;
  const submit = dialog.querySelector<HTMLButtonElement>('[data-fb-submit]')!;
  const github = dialog.querySelector<HTMLAnchorElement>('[data-fb-github]')!;
  const eventField = dialog.querySelector<HTMLElement>('[data-fb-field="event"]')!;
  const eventLabel = dialog.querySelector<HTMLElement>('[data-fb-event-label]')!;
  const messageLabel = dialog.querySelector<HTMLElement>('[data-fb-message-label]')!;
  const message = form.elements.namedItem('message') as HTMLTextAreaElement;
  const eventInput = form.elements.namedItem('event') as HTMLInputElement;
  const slugInput = form.elements.namedItem('slug') as HTMLInputElement;
  const repo = github.href.replace(/\/issues\/.*$/, '');
  let lastTrigger: HTMLElement | null = null;

  const COPY: Record<Kind, { event: string; message: string; placeholder: string; showEvent: boolean }> = {
    wrong: { event: 'Which event?', message: 'What’s wrong?', placeholder: 'It actually starts at 5pm, not 4pm. / It moved to the A-House.', showEvent: true },
    event: { event: 'Event name', message: 'When, where, and anything else you know', placeholder: 'Friday Oct 30, 10pm to 1am at the A-House. $20 at the door. Flyer is on their Instagram.', showEvent: true },
    bug: { event: '', message: 'What happened?', placeholder: 'Tapping the paw on iPhone Safari does nothing. / The Saturday tab shows Friday events.', showEvent: false },
  };

  function setKind(kind: Kind) {
    const c = COPY[kind];
    eventField.hidden = !c.showEvent;
    eventLabel.textContent = c.event;
    messageLabel.textContent = c.message;
    message.placeholder = c.placeholder;
    eventInput.required = kind === 'event';
    github.href = `${repo}/issues/new?template=${kind === 'wrong' ? 'event-correction' : kind === 'event' ? 'new-event' : 'bug'}.yml`;
  }

  function open(kind: Kind, opts: { event?: string; slug?: string; trigger?: HTMLElement } = {}) {
    form.reset();
    (form.elements.namedItem('kind') as RadioNodeList).value = kind;
    setKind(kind);
    eventInput.value = opts.event ?? '';
    slugInput.value = opts.slug ?? '';
    (form.elements.namedItem('page') as HTMLInputElement).value = location.href;
    (form.elements.namedItem('opened') as HTMLInputElement).value = String(Date.now());
    error.hidden = true;
    stepForm.hidden = false;
    stepDone.hidden = true;
    lastTrigger = opts.trigger ?? null;
    if (!dialog.open) dialog.showModal();
    setTimeout(() => (kind === 'event' && !opts.event ? eventInput : message).focus(), 50);
    track('feedback_open', kind);
  }

  function close() {
    if (dialog.open) dialog.close();
    lastTrigger?.focus();
    lastTrigger = null;
  }

  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-feedback]');
    if (!t) return;
    e.preventDefault();
    open((t.dataset.feedback as Kind) || 'wrong', { event: t.dataset.feedbackEvent, slug: t.dataset.feedbackSlug, trigger: t });
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
    if ((e.target as HTMLElement).closest('[data-fb-close]')) close();
  });
  form.addEventListener('change', (e) => {
    if ((e.target as HTMLInputElement).name === 'kind') setKind((e.target as HTMLInputElement).value as Kind);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    data.userAgent = navigator.userAgent;
    data.elapsed = String(Date.now() - Number(data.opened));
    submit.setAttribute('aria-busy', 'true');
    submit.textContent = 'Sending…';
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(data),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; number?: number; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
      stepForm.hidden = true;
      stepDone.hidden = false;
      const link = dialog.querySelector<HTMLAnchorElement>('[data-fb-issue-link]')!;
      const text = dialog.querySelector<HTMLElement>('[data-fb-done-text]')!;
      if (body.url) {
        link.href = body.url;
        link.hidden = false;
        text.textContent = `Logged as issue #${body.number}. We’ll take a look shortly.`;
      }
      track('feedback_sent', data.kind);
    } catch (err) {
      const msg = (err as Error).message;
      error.innerHTML =
        msg === 'not configured'
          ? 'The feedback inbox isn’t switched on yet. Please use the GitHub button below for now.'
          : `Couldn’t send that (${escapeHtml(msg)}). Try again, or use GitHub below.`;
      error.hidden = false;
      github.href = githubFallback(repo, data);
    } finally {
      submit.removeAttribute('aria-busy');
      submit.textContent = 'Send';
    }
  });

  function githubFallback(repo: string, d: Record<string, string>) {
    const title = d.kind === 'event' ? `New event: ${d.event}` : d.kind === 'bug' ? 'Bug: ' : `Event correction: ${d.event}`;
    const body = [d.event && `**Event:** ${d.event}`, d.message, d.source && `**Source:** ${d.source}`, `**Page:** ${d.page}`].filter(Boolean).join('\n\n');
    const p = new URLSearchParams({ title, body });
    return `${repo}/issues/new?${p}`;
  }
  function escapeHtml(s: string) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  }
  function track(action: string, label: string) {
    const w = window as Window & { dataLayer?: unknown[] };
    (w.dataLayer ??= []).push({ event: action, label });
  }
}
