(function() {
    var COUNTDOWN_KEY = 'accessExpiresAt';
    var SLOTS_KEY = 'accessSlots';
    var DURATION = 15 * 60 * 1000;

    var expiresAt = localStorage.getItem(COUNTDOWN_KEY);
    if (!expiresAt || isNaN(parseInt(expiresAt))) {
        expiresAt = Date.now() + DURATION;
        localStorage.setItem(COUNTDOWN_KEY, String(expiresAt));
        localStorage.setItem(SLOTS_KEY, String(Math.floor(Math.random() * 3) + 2));
    }
    expiresAt = parseInt(expiresAt);

    var remaining = expiresAt - Date.now();
    if (remaining <= 0) return;

    var slots = parseInt(localStorage.getItem(SLOTS_KEY)) || 3;

    var lang = (document.documentElement.lang || '').substring(0, 2).toLowerCase();
    var i18n = {
        pt: { expires: 'Acesso expira em', slots: 'vagas restantes', lost: 'Acesso expirado' },
        en: { expires: 'Access expires in', slots: 'slots remaining', lost: 'Access expired' },
        es: { expires: 'Acceso expira en', slots: 'vacantes restantes', lost: 'Acceso expirado' },
        fr: { expires: 'Accès expire dans', slots: 'places restantes', lost: 'Accès expiré' }
    };
    var t = i18n[lang] || i18n.en;

    var css = document.createElement('style');
    css.textContent = [
        '.urgency-bar{position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%);border-bottom:1px solid rgba(233,30,99,.2);padding:8px 16px;display:flex;align-items:center;justify-content:center;gap:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;animation:ub-slide .4s ease;}',
        '.urgency-bar *{margin:0;padding:0;box-sizing:border-box;}',
        '@keyframes ub-slide{from{transform:translateY(-100%)}to{transform:translateY(0)}}',
        '@keyframes ub-pulse{0%,100%{opacity:1}50%{opacity:.3}}',
        '@keyframes ub-flash{0%,100%{opacity:1}50%{opacity:.6}}',
        '.ub-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;animation:ub-pulse 1.5s ease infinite;flex-shrink:0;}',
        '.ub-label{font-size:11px;font-weight:600;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:1px;white-space:nowrap;}',
        '.ub-timer{font-size:16px;font-weight:900;color:#e91e63;font-variant-numeric:tabular-nums;letter-spacing:1px;white-space:nowrap;}',
        '.ub-timer.ub-urgent{color:#ef4444;animation:ub-flash 1s ease infinite;}',
        '.ub-sep{width:1px;height:16px;background:rgba(255,255,255,.1);flex-shrink:0;}',
        '.ub-slots{font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap;}',
        '.ub-slots strong{color:#ef4444;font-weight:700;}',
        '@media(max-width:400px){.ub-label{font-size:10px;letter-spacing:.5px;}.ub-timer{font-size:14px;}.ub-slots{display:none;}}'
    ].join('\n');
    document.head.appendChild(css);

    var bar = document.createElement('div');
    bar.className = 'urgency-bar';
    bar.innerHTML = '<span class="ub-dot"></span>' +
        '<span class="ub-label">' + t.expires + '</span>' +
        '<span class="ub-timer" id="ubTimer">--:--</span>' +
        '<span class="ub-sep"></span>' +
        '<span class="ub-slots"><strong>' + slots + '</strong> ' + t.slots + '</span>';
    document.body.insertBefore(bar, document.body.firstChild);

    var barH = bar.offsetHeight;
    var body = document.body;
    var currentPadding = parseInt(window.getComputedStyle(body).paddingTop) || 0;
    body.style.paddingTop = (currentPadding + barH) + 'px';

    var existingBars = document.querySelectorAll('.live-counter-bar, .timer-bar');
    for (var i = 0; i < existingBars.length; i++) {
        var s = window.getComputedStyle(existingBars[i]);
        if (s.position === 'fixed' && parseInt(s.top) === 0) {
            existingBars[i].style.top = barH + 'px';
            body.style.paddingTop = (parseInt(body.style.paddingTop) + existingBars[i].offsetHeight) + 'px';
        }
    }

    var timerEl = document.getElementById('ubTimer');

    function tick() {
        var rem = Math.max(0, expiresAt - Date.now());
        var mins = Math.floor(rem / 60000);
        var secs = Math.floor((rem % 60000) / 1000);
        timerEl.textContent = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;

        if (mins < 5) timerEl.classList.add('ub-urgent');
        else timerEl.classList.remove('ub-urgent');

        if (rem > 0) setTimeout(tick, 1000);
        else timerEl.textContent = t.lost;
    }
    tick();
})();
