/**
 * POST /api/feedback  →  opens a GitHub issue on the site repo.
 *
 * The only backend this site has. Needs one env var in Vercel:
 *   FEEDBACK_GITHUB_TOKEN  a fine-grained personal access token scoped to the
 *                          spookybear2026 repo with "Issues: Read and write".
 *
 * Spam defences: honeypot field, minimum time-on-form, size limits, and a
 * best-effort per-IP rate limit (in-memory, so per warm instance).
 */
const REPO = process.env.FEEDBACK_GITHUB_REPO || 'sghoweri/spookybear2026';
const KINDS = {
  wrong: { label: 'event-correction', title: (d) => `Event correction: ${d.event || 'unspecified event'}` },
  event: { label: 'new-event', title: (d) => `New event: ${d.event || 'untitled'}` },
  bug: { label: 'bug', title: (d) => `Bug: ${firstLine(d.message)}` },
};
const hits = new Map(); // ip -> [timestamps]

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });

  const token = process.env.FEEDBACK_GITHUB_TOKEN;
  if (!token) return res.status(503).json({ ok: false, error: 'not configured' });

  const d = typeof req.body === 'object' && req.body ? req.body : {};
  const kind = KINDS[d.kind] ? d.kind : null;
  const message = String(d.message || '').trim();
  if (!kind) return res.status(400).json({ ok: false, error: 'unknown kind' });
  if (message.length < 10 || message.length > 4000) return res.status(400).json({ ok: false, error: 'message must be 10 to 4000 characters' });
  if (d.website) return res.status(200).json({ ok: true, number: 0 }); // honeypot: pretend success
  if (Number(d.elapsed) < 3000) return res.status(400).json({ ok: false, error: 'that was quick, try again' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 5) return res.status(429).json({ ok: false, error: 'too many messages, try again later' });
  hits.set(ip, [...recent, now]);

  const clean = (s, n = 300) => String(s || '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);
  const body = [
    `**Kind:** ${kind}`,
    d.event && `**Event:** ${clean(d.event, 140)}`,
    d.slug && `**File:** \`src/content/events/${clean(d.slug, 120)}.md\``,
    '',
    '**Message**',
    '',
    quote(message),
    '',
    d.source && `**Source:** ${clean(d.source, 500)}`,
    d.page && `**Page:** ${clean(d.page, 500)}`,
    d.contact && `**Reply to:** _(provided, stored privately)_`,
    `**Client:** ${clean(d.userAgent, 200)}`,
    '',
    '_Sent from the feedback form on spookybear2026.com._',
  ]
    .filter((l) => l !== undefined && l !== null && l !== false)
    .join('\n');

  const gh = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'spookybear2026-feedback',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({ title: clean(KINDS[kind].title(d), 200), body, labels: [KINDS[kind].label, 'from-site'] }),
  });
  if (!gh.ok) {
    const text = await gh.text();
    console.error('GitHub issue create failed', gh.status, text.slice(0, 300));
    return res.status(502).json({ ok: false, error: 'could not reach GitHub' });
  }
  const issue = await gh.json();
  // The contact email is deliberately kept out of the public issue. It is only
  // logged server-side so the owner can reply; Vercel log retention is short.
  if (d.contact) console.log(`feedback #${issue.number} reply-to: ${clean(d.contact, 120)}`);
  return res.status(200).json({ ok: true, number: issue.number, url: issue.html_url });
}

function firstLine(s) {
  return String(s || '').split('\n')[0].trim().slice(0, 70);
}
function quote(s) {
  return s
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
}
