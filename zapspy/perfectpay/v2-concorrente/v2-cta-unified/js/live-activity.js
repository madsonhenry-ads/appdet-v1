(function() {
    if (window.__zsLiveActivityLoaded) return;
    window.__zsLiveActivityLoaded = true;

    var lang = (document.documentElement.lang || 'en').substring(0, 2).toLowerCase();
    var i18n = {
        en: { tail: 'just unlocked full access', timeFmt: function(m){ return m + ' min ago'; } },
        es: { tail: 'acaba de desbloquear acceso completo', timeFmt: function(m){ return 'hace ' + m + ' min'; } },
        pt: { tail: 'acabou de desbloquear acesso completo', timeFmt: function(m){ return 'há ' + m + ' min'; } },
        fr: { tail: 'vient de débloquer l\'accès complet', timeFmt: function(m){ return 'il y a ' + m + ' min'; } }
    };
    var fromI18n = {
        en: 'from', es: 'de', pt: 'de', fr: 'de'
    };
    var t = i18n[lang] || i18n.en;
    var fromWord = fromI18n[lang] || 'from';

    var people = [
        { name: 'Sarah M.', city: 'London, UK' },
        { name: 'Carlos R.', city: 'Mexico City, MX' },
        { name: 'Priya K.', city: 'Mumbai, IN' },
        { name: 'Ahmed H.', city: 'Dubai, UAE' },
        { name: 'Lisa W.', city: 'Toronto, CA' },
        { name: 'Juan P.', city: 'Madrid, ES' },
        { name: 'Yuki T.', city: 'Tokyo, JP' },
        { name: 'Fatima A.', city: 'Riyadh, SA' },
        { name: 'Emily R.', city: 'Sydney, AU' },
        { name: 'Marco B.', city: 'Milan, IT' },
        { name: 'Nina S.', city: 'Berlin, DE' },
        { name: 'David L.', city: 'New York, US' },
        { name: 'Ana C.', city: 'Buenos Aires, AR' },
        { name: 'Ravi P.', city: 'Singapore, SG' },
        { name: 'Chloe D.', city: 'Paris, FR' },
        { name: 'Omar M.', city: 'Istanbul, TR' },
        { name: 'Kim J.', city: 'Seoul, KR' },
        { name: 'Grace N.', city: 'Lagos, NG' },
        { name: 'Lena V.', city: 'Stockholm, SE' },
        { name: 'Chen W.', city: 'Taipei, TW' },
        { name: 'Sofia G.', city: 'Bogota, CO' },
        { name: 'James O.', city: 'Dublin, IE' },
        { name: 'Mia K.', city: 'Amsterdam, NL' },
        { name: 'Hassan B.', city: 'Cairo, EG' }
    ];

    var css = '' +
        '#zsLiveActivityContainer{position:fixed;left:16px;bottom:16px;z-index:99996;display:flex;flex-direction:column;gap:8px;pointer-events:none;}' +
        '.zs-la-toast{display:flex;align-items:flex-start;gap:10px;background:rgba(20,22,26,0.96);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(34,197,94,0.28);border-radius:14px;padding:12px 14px;min-width:240px;max-width:320px;box-shadow:0 10px 28px rgba(0,0,0,0.45);color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;opacity:0;transform:translateX(-24px);transition:opacity .35s ease, transform .35s ease;pointer-events:auto;}' +
        '.zs-la-toast.zs-show{opacity:1;transform:translateX(0);}' +
        '.zs-la-icon{flex-shrink:0;width:28px;height:28px;border-radius:50%;background:rgba(34,197,94,0.18);display:flex;align-items:center;justify-content:center;font-size:14px;color:#22c55e;}' +
        '.zs-la-body{flex:1;min-width:0;}' +
        '.zs-la-text{font-size:13px;line-height:1.4;color:#e5e7eb;}' +
        '.zs-la-text strong{color:#fff;font-weight:700;}' +
        '.zs-la-time{font-size:11px;color:#9ca3af;margin-top:2px;}' +
        'body.theme-light .zs-la-toast{background:rgba(255,255,255,0.98);border-color:rgba(34,197,94,0.40);color:#111b21;box-shadow:0 10px 28px rgba(0,0,0,0.12);}' +
        'body.theme-light .zs-la-text{color:#111b21;}' +
        'body.theme-light .zs-la-text strong{color:#000;}' +
        'body.theme-light .zs-la-time{color:#667781;}' +
        '@media(max-width:480px){#zsLiveActivityContainer{left:8px;right:8px;bottom:8px;}.zs-la-toast{min-width:0;max-width:100%;}}';

    function inject() {
        if (document.getElementById('zsLiveActivityContainer')) return;
        if (document.getElementById('socialProofContainer')) return; // page already has its own
        var style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        var c = document.createElement('div');
        c.id = 'zsLiveActivityContainer';
        document.body.appendChild(c);
    }

    var idx = Math.floor(Math.random() * people.length);
    function show() {
        var c = document.getElementById('zsLiveActivityContainer');
        if (!c) return;
        var p = people[idx % people.length];
        idx++;
        var mins = Math.floor(Math.random() * 12) + 1;
        var toast = document.createElement('div');
        toast.className = 'zs-la-toast';
        toast.innerHTML = '<div class="zs-la-icon">✅</div>' +
            '<div class="zs-la-body">' +
                '<div class="zs-la-text"><strong>' + p.name + '</strong> ' + fromWord + ' ' + p.city + ' ' + t.tail + '</div>' +
                '<div class="zs-la-time">' + t.timeFmt(mins) + '</div>' +
            '</div>';
        c.appendChild(toast);
        requestAnimationFrame(function(){ requestAnimationFrame(function(){ toast.classList.add('zs-show'); }); });
        setTimeout(function() {
            toast.classList.remove('zs-show');
            setTimeout(function(){ if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
        }, 5500);
    }

    function loop() {
        setTimeout(function(){ show(); loop(); }, 28000 + Math.random() * 22000);
    }

    function start() {
        inject();
        if (!document.getElementById('zsLiveActivityContainer')) return;
        setTimeout(show, 9000);
        loop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
