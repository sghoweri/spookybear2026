/* Error monitoring with zero cost on the happy path.
   Nothing from Sentry is downloaded until the first uncaught error or unhandled
   rejection. Early errors are queued, then replayed once the SDK has loaded. */

const dsn = import.meta.env.PUBLIC_SENTRY_DSN as string | undefined;

if (dsn && import.meta.env.PROD) {
  type Queued = { kind: 'error'; error: unknown } | { kind: 'rejection'; reason: unknown };
  const queue: Queued[] = [];
  let loading: Promise<typeof import('@sentry/browser')> | null = null;

  const load = () =>
    (loading ??= import('@sentry/browser').then((Sentry) => {
      Sentry.init({
        dsn,
        release: import.meta.env.PUBLIC_COMMIT_SHA as string | undefined,
        environment: 'production',
        defaultIntegrations: false,
        integrations: [Sentry.globalHandlersIntegration(), Sentry.dedupeIntegration(), Sentry.linkedErrorsIntegration()],
        sendDefaultPii: false,
        sampleRate: 1,
        tracesSampleRate: 0,
        ignoreErrors: [/ResizeObserver loop/, /Load failed/, /NetworkError/, /AbortError/, /partytown/i],
        denyUrls: [/googletagmanager\.com/, /google-analytics\.com/],
        beforeSend(event) {
          // Keep it anonymous: no IPs, no user context.
          delete event.user;
          return event;
        },
      });
      for (const q of queue) {
        if (q.kind === 'error') Sentry.captureException(q.error);
        else Sentry.captureException(q.reason instanceof Error ? q.reason : new Error(`Unhandled rejection: ${String(q.reason)}`));
      }
      queue.length = 0;
      return Sentry;
    }));

  const onError = (e: ErrorEvent) => {
    if (queue.length < 10) queue.push({ kind: 'error', error: e.error ?? new Error(e.message) });
    void load();
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    if (queue.length < 10) queue.push({ kind: 'rejection', reason: e.reason });
    void load();
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  // Once the SDK is live its own global handlers take over; drop the bootstrap listeners.
  const stop = () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
  const check = () => (loading ? loading.then(stop) : setTimeout(check, 5000));
  setTimeout(check, 5000);
}
