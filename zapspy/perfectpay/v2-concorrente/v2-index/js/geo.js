/* ============================================================
 * shared/js/geo.js
 * --------------------------------------------------------------
 * Robust IP-geolocation with fallback chain + cache.
 *
 * Why: legacy code calls fetch('https://ipapi.co/json/') in 70+
 * places. ipapi.co free tier has aggressive limits (1k req/day,
 * 30 req/min) that get exhausted quickly under real ad traffic
 * — locally everything works, in production the fetch silently
 * fails and the country/DDI auto-selection breaks.
 *
 * This shim monkey-patches window.fetch so any call matching
 * `ipapi.co/json` is transparently rerouted through a fallback
 * chain (api.country.is -> ipwho.is -> ipapi.co) with localStorage
 * caching (7-day TTL). Response shape mimics ipapi.co's JSON so
 * existing call sites keep working unchanged.
 * ============================================================ */
(function () {
    'use strict';
    if (window.__geoShimInstalled) return;
    window.__geoShimInstalled = true;

    var CACHE_KEY = '__geoShimCache_v1';
    var CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    var REQUEST_TIMEOUT_MS = 3000;

    var APIS = [
        {
            // Cloudflare-fronted, no documented rate-limit, returns ISO country code only.
            url: 'https://api.country.is/',
            map: function (d) {
                return {
                    country_code: d && d.country ? String(d.country).toUpperCase() : '',
                    city: '',
                    region: '',
                    latitude: 0,
                    longitude: 0
                };
            }
        },
        {
            // 10k req/month free, drop-in compatible field names.
            url: 'https://ipwho.is/',
            map: function (d) {
                return {
                    country_code: d && d.country_code ? String(d.country_code).toUpperCase() : '',
                    city: (d && d.city) || '',
                    region: (d && d.region) || '',
                    latitude: (d && d.latitude) || 0,
                    longitude: (d && d.longitude) || 0
                };
            }
        },
        {
            // Original endpoint kept as last-resort fallback.
            url: 'https://ipapi.co/json/',
            map: function (d) {
                return {
                    country_code: d && d.country_code ? String(d.country_code).toUpperCase() : '',
                    city: (d && d.city) || '',
                    region: (d && d.region) || '',
                    latitude: (d && d.latitude) || 0,
                    longitude: (d && d.longitude) || 0
                };
            }
        }
    ];

    function readCache() {
        try {
            var raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (!parsed || !parsed.t || (Date.now() - parsed.t) > CACHE_TTL_MS) return null;
            return parsed.d || null;
        } catch (e) { return null; }
    }

    function writeCache(data) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: data })); } catch (e) { /* quota / private mode */ }
    }

    function fetchWithTimeout(url, ms) {
        return new Promise(function (resolve, reject) {
            var aborted = false;
            var timer = setTimeout(function () { aborted = true; reject(new Error('geo-timeout')); }, ms);
            window.__geoOriginalFetch(url, { credentials: 'omit', cache: 'no-store' })
                .then(function (r) {
                    if (aborted) return;
                    clearTimeout(timer);
                    if (!r.ok) { reject(new Error('geo-http-' + r.status)); return; }
                    resolve(r);
                })
                .catch(function (e) { if (!aborted) { clearTimeout(timer); reject(e); } });
        });
    }

    function tryChain(idx) {
        if (idx >= APIS.length) return Promise.reject(new Error('geo-all-failed'));
        var api = APIS[idx];
        return fetchWithTimeout(api.url, REQUEST_TIMEOUT_MS)
            .then(function (r) { return r.json(); })
            .then(function (raw) {
                var mapped = api.map(raw);
                if (!mapped.country_code) throw new Error('geo-empty-country');
                writeCache(mapped);
                return mapped;
            })
            .catch(function () { return tryChain(idx + 1); });
    }

    function lookup() {
        var cached = readCache();
        if (cached) return Promise.resolve(cached);
        return tryChain(0).catch(function () {
            // Last-resort safety net so call sites never crash on null.
            return { country_code: '', city: '', region: '', latitude: 0, longitude: 0 };
        });
    }

    // Preserve original fetch and install the proxy.
    window.__geoOriginalFetch = window.fetch.bind(window);
    var ipapiPattern = /ipapi\.co\/json/i;

    window.fetch = function (input, init) {
        var url = '';
        try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (e) { url = ''; }
        if (ipapiPattern.test(url)) {
            return lookup().then(function (data) {
                return {
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: { get: function () { return null; } },
                    json: function () { return Promise.resolve(data); },
                    text: function () { return Promise.resolve(JSON.stringify(data)); },
                    clone: function () { return this; }
                };
            });
        }
        return window.__geoOriginalFetch(input, init);
    };

    // Expose a convenience global for new code.
    window.GeoLookup = lookup;
})();
