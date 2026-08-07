/**
 * ZS VSL Resume — handles iOS Safari minimize/restore + bfcache restoration
 *
 * Problem: on iPhone Safari, when the user minimizes the app and reopens it,
 * the VTurb / converteai video stays paused with no way to resume short of
 * a full page reload. Same issue on bfcache restoration.
 *
 * Strategy:
 *  1. Listen to visibilitychange / pageshow / focus events
 *  2. When the page becomes visible AND the VSL screen is active,
 *     locate the underlying <video> element rendered by VTurb and
 *     attempt to .play() it.
 *  3. If play() rejects (iOS autoplay policy after backgrounding can
 *     occasionally block resume without user gesture), render an overlay
 *     button "▶ Resume video" that the user can tap to resume.
 *
 * Zero dependencies. Safe to include on pages without a VSL.
 */
(function () {
  'use strict';
  if (window.ZSVSLResume) return;

  var ACTIVE_SCREEN_ID = 'screen3';
  var CONTAINER_ID = 'vslContainer';
  var OVERLAY_ID = 'vslResumeOverlay';

  // i18n labels — fallback to EN if html lang is missing/unknown
  var LABELS = {
    en: 'RESUME VIDEO',
    es: 'REANUDAR VIDEO',
    pt: 'RETOMAR VÍDEO',
    fr: 'REPRENDRE LA VIDÉO'
  };

  function lang() {
    var l = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    return LABELS[l] ? l : 'en';
  }

  function isVSLActive() {
    var s = document.getElementById(ACTIVE_SCREEN_ID);
    return !!(s && s.classList.contains('active'));
  }

  function videoEls() {
    var vc = document.getElementById(CONTAINER_ID);
    if (!vc) return [];
    // VTurb player renders a <video>; we also look for nested iframes that
    // sometimes appear during ad pre-roll, but we only resume <video> tags.
    return Array.prototype.slice.call(vc.querySelectorAll('video'));
  }

  function removeOverlay() {
    var ov = document.getElementById(OVERLAY_ID);
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  function showOverlay(video) {
    if (document.getElementById(OVERLAY_ID)) return;
    var vc = document.getElementById(CONTAINER_ID);
    if (!vc) return;
    // Make sure the container can host an absolutely-positioned overlay
    if (!vc.style.position) vc.style.position = 'relative';
    var ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    ov.setAttribute('role', 'button');
    ov.setAttribute('aria-label', LABELS[lang()]);
    ov.style.cssText = [
      'position:absolute',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(0,0,0,0.72)',
      'z-index:9999',
      'cursor:pointer',
      'border-radius:12px',
      'animation:zsVslOvIn 180ms ease-out'
    ].join(';');
    var btn = document.createElement('div');
    btn.style.cssText = [
      'padding:18px 30px',
      'background:#00A884',
      'color:#fff',
      'border-radius:50px',
      'font:700 15px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      'display:flex',
      'align-items:center',
      'gap:12px',
      'box-shadow:0 8px 28px rgba(0,168,132,0.45)',
      'letter-spacing:0.3px'
    ].join(';');
    btn.innerHTML = '<span style="font-size:22px;line-height:1;">&#9654;</span> ' + LABELS[lang()];
    ov.appendChild(btn);
    ov.addEventListener('click', function () {
      try {
        var p = video.play();
        if (p && typeof p.then === 'function') {
          p.then(removeOverlay).catch(function () {});
        } else {
          removeOverlay();
        }
      } catch (e) {}
    }, { passive: true });
    vc.appendChild(ov);

    // Inject keyframe once
    if (!document.getElementById('zsVslOvKf')) {
      var st = document.createElement('style');
      st.id = 'zsVslOvKf';
      st.textContent = '@keyframes zsVslOvIn{from{opacity:0}to{opacity:1}}';
      document.head.appendChild(st);
    }
  }

  function tryResume() {
    if (!isVSLActive()) return;
    if (!window._vslLoaded) return;
    var vids = videoEls();
    if (!vids.length) return;
    vids.forEach(function (v) {
      if (!v.paused || v.ended) {
        // Already playing or finished — clean up any leftover overlay
        if (!v.paused) removeOverlay();
        return;
      }
      try {
        var p = v.play();
        if (p && typeof p.then === 'function') {
          p.then(removeOverlay).catch(function () {
            showOverlay(v);
          });
        } else {
          removeOverlay();
        }
      } catch (e) {
        showOverlay(v);
      }
    });
  }

  // Schedule resume attempt — VTurb may need a tick after restore
  function scheduleResume() {
    setTimeout(tryResume, 120);
    setTimeout(tryResume, 450);
    setTimeout(tryResume, 1000);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') scheduleResume();
  });

  window.addEventListener('pageshow', function (e) {
    // Always attempt — bfcache restoration AND normal navigations both benefit
    scheduleResume();
  });

  window.addEventListener('focus', scheduleResume);

  window.ZSVSLResume = { tryResume: tryResume, schedule: scheduleResume };
})();
