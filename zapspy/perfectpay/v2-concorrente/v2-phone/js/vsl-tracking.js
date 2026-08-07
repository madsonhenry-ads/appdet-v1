/**
 * ZS VSL Tracking — fires play / 25 / 50 / 75 / complete events to:
 *   - Meta Pixel (custom events: VideoStart, VideoQ25, VideoQ50, VideoQ75, VideoComplete)
 *   - Google Ads / GA4 via gtag (event: 'video_progress' with percent)
 *   - FunnelTracker (internal funnel analytics, if available)
 *
 * Works with the VTurb / Converte AI player which renders a real <video>
 * element inside #vslContainer once player.js finishes hydration.
 *
 * Strategy:
 *   1. MutationObserver on #vslContainer waits for the <video> tag to appear.
 *   2. Once attached, listen to 'play' (once per session) and 'timeupdate'
 *      to detect 25/50/75/complete thresholds (each fires only once).
 *   3. All events are deduped via a per-session Set so they never spam.
 *
 * Zero dependency. Safe on pages without a VSL.
 */
(function () {
  'use strict';
  if (window.ZSVSLTrack) return;

  var CONTAINER_ID = 'vslContainer';
  var fired = Object.create(null);
  var bound = false;
  var lastVideo = null;

  function track(eventName, payload) {
    if (fired[eventName]) return;
    fired[eventName] = true;
    payload = payload || {};
    payload.video_id = 'vid-69d4f6d649922114cb89b55b';
    payload.video_provider = 'vturb-converteai';

    // Meta Pixel — trackCustom (no standard event for video quartiles)
    try {
      if (typeof fbq === 'function') {
        var eid = eventName + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        fbq('trackCustom', eventName, payload, { eventID: eid });
      }
    } catch (e) {}

    // Google Ads / GA4 — single video_progress event, percent in payload
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'video_progress', {
          video_title: 'VSL Whats Spy',
          video_id: payload.video_id,
          video_percent: payload.percent || 0,
          milestone: eventName
        });
      }
    } catch (e) {}

    // FunnelTracker — internal analytics
    try {
      if (typeof FunnelTracker !== 'undefined' && FunnelTracker.track) {
        FunnelTracker.track(eventName, payload);
      }
    } catch (e) {}
  }

  function bind(video) {
    if (!video || video.dataset.zsBound) return;
    video.dataset.zsBound = '1';
    lastVideo = video;
    bound = true;

    var sentQ25 = false, sentQ50 = false, sentQ75 = false;

    video.addEventListener('play', function () {
      track('VideoStart', { percent: 0 });
    });

    video.addEventListener('timeupdate', function () {
      var d = video.duration;
      if (!d || isNaN(d) || d < 1) return;
      var pct = (video.currentTime / d) * 100;
      if (!sentQ25 && pct >= 25) { sentQ25 = true; track('VideoQ25', { percent: 25 }); }
      if (!sentQ50 && pct >= 50) { sentQ50 = true; track('VideoQ50', { percent: 50 }); }
      if (!sentQ75 && pct >= 75) { sentQ75 = true; track('VideoQ75', { percent: 75 }); }
    });

    video.addEventListener('ended', function () {
      track('VideoComplete', { percent: 100 });
    });
  }

  function scan() {
    var vc = document.getElementById(CONTAINER_ID);
    if (!vc) return;
    var v = vc.querySelector('video');
    if (v) bind(v);
  }

  // Observe DOM until the player injects its <video>
  function startObserver() {
    var vc = document.getElementById(CONTAINER_ID);
    if (!vc) return;
    scan();
    if (bound) return;
    var mo = new MutationObserver(function () {
      scan();
      if (bound) mo.disconnect();
    });
    mo.observe(vc, { childList: true, subtree: true });
    // Stop trying after 60s
    setTimeout(function () { if (!bound) mo.disconnect(); }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  // Re-scan when VSL is (re)loaded after navigating between screens
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && !bound) scan();
  });

  window.ZSVSLTrack = { rescan: scan, isBound: function () { return bound; } };
})();
