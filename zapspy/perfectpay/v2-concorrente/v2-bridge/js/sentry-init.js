/**
 * Sentry browser init (no-op until window.SENTRY_DSN is set).
 *
 * To enable, set window.SENTRY_DSN in the HTML <head> BEFORE loading this script:
 *   <script>window.SENTRY_DSN = 'https://xxx@oxxx.ingest.sentry.io/xxx';</script>
 *   <script src="js/sentry-init.js"></script>
 *
 * Or set it via tracking-utils.js / runtime config. Without DSN, this is silent.
 */
(function () {
    'use strict';
    if (!window.SENTRY_DSN) return;

    // Lazy-load the Sentry SDK from CDN so it never blocks render
    var s = document.createElement('script');
    s.src = 'https://browser.sentry-cdn.com/8.55.1/bundle.tracing.min.js';
    s.crossOrigin = 'anonymous';
    s.async = true;
    s.onload = function () {
        if (!window.Sentry) return;
        try {
            var lang = (document.documentElement.lang || 'en').toLowerCase().slice(0, 2);
            var page = (location.pathname.split('/').pop() || 'index').replace('.html', '');
            window.Sentry.init({
                dsn: window.SENTRY_DSN,
                environment: window.SENTRY_ENV || 'production',
                release: window.SENTRY_RELEASE || undefined,
                tracesSampleRate: Number(window.SENTRY_TRACES_SAMPLE_RATE || 0.05),
                replaysSessionSampleRate: 0,
                replaysOnErrorSampleRate: 0,
                integrations: function (defaults) {
                    return defaults.filter(function (i) { return i.name !== 'BrowserProfiling'; });
                },
                beforeSend: function (event) {
                    var msg = event && event.exception && event.exception.values && event.exception.values[0] && event.exception.values[0].value;
                    if (typeof msg === 'string') {
                        // Drop common noise
                        if (/ResizeObserver loop/i.test(msg)) return null;
                        if (/Non-Error promise rejection captured/i.test(msg)) return null;
                        if (/Script error\.?$/i.test(msg)) return null;
                    }
                    return event;
                }
            });
            window.Sentry.setTag('lang', lang);
            window.Sentry.setTag('page', page);
        } catch (e) {
            console.warn('[Sentry] init failed', e);
        }
    };
    s.onerror = function () { /* silent */ };
    (document.head || document.body || document.documentElement).appendChild(s);
})();
