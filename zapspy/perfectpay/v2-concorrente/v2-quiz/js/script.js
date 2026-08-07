(function() {
    'use strict';

    var DEST = (window.location.pathname.indexOf('/quiz/') !== -1) ? '../cta-unified.html' : 'cta-unified.html';
    var _fromPhone = (window.location.search.indexOf('from_phone=true') !== -1);
    var TOTAL = 6;
    var ACTIVE = TOTAL - 1; /* GENDER_Q1_REMOVED_V1 */
    var ANALYSIS_MS = 6000;

    var LOGS = [
        'Processing digital behavior patterns...',
        'Analyzing phone protection indicators...',
        'Measuring emotional connection strength...',
        'Cross-referencing bond depth with access level...',
        'Evaluating emotional and intimacy patterns...',
        'Detecting guilt compensation signals...',
        'Comparing with 127,493 previous analyses...',
        'Verifying connection threshold...',
        'Generating personalized diagnosis...'
    ];

    var SIGNAL_MAP = {
        2: { a: 'Legitimate motive: well-founded suspicion requiring investigation', b: 'Initial doubts requiring clarification' },
        3: { a: 'Emotional readiness confirmed for receiving sensitive information', b: 'Partial readiness — monitoring recommended' },
        4: { a: 'Prolonged exposure to emotional stress — priority case', b: 'Recent but growing impact on mental health' },
        5: { a: 'Deep emotional connection detected — maximum data access enabled', b: 'Moderate connection — partial data access available' },
        6: { a: 'Full acceptance of terms and responsibilities', b: 'Acceptance with reservations — cautious profile' }
    };

    var LEVELS = {
        high: {
            label: 'IMMEDIATE ACCESS APPROVED',
            color: '#22c55e',
            headline: 'Verification complete. You have been approved for immediate access.',
            diag: 'Your answers demonstrate <strong>genuine need and emotional maturity</strong> to use this tool. Your profile meets all security criteria. <strong>Access granted without restrictions</strong> — proceed while your slot is reserved.',
            stat: '97%'
        },
        moderate: {
            label: 'ACCESS APPROVED',
            color: '#f59e0b',
            headline: 'Verification complete. Your access has been granted.',
            diag: 'Your profile meets the <strong>minimum security criteria</strong>. Although some answers indicate hesitation, we identified genuine need. <strong>Your access has been approved</strong> — but it is limited and may expire at any time.',
            stat: '83%'
        },
        low: {
            label: 'CONDITIONAL ACCESS',
            color: '#f59e0b',
            headline: 'Verification complete. Access granted with restrictions.',
            diag: 'Although your answers indicate lower urgency, the fact that you got this far demonstrates a <strong>need that cannot be ignored</strong>. Your access has been granted conditionally — <strong>act now before it expires</strong>.',
            stat: '64%'
        }
    };

    var state = {
        answers: {},
        score: 0,
        gender: null,
        currentScene: 0
    };

    document.addEventListener('DOMContentLoaded', function() {
        personalizeGreeting();
        typewriteHook();
        bindAll();
        /* QUIZ_NUDGE_V1 — recover idle users on start scene */
        try {
            var __nudgeBtn = document.getElementById('btnStart');
            if (!__nudgeBtn) return;
            var __nudgeFired = false;
            var __nudgeCancel = function() { __nudgeFired = true; };
            __nudgeBtn.addEventListener('click', __nudgeCancel, { once: true });
            setTimeout(function() {
                if (__nudgeFired) return;
                try {
                    __nudgeBtn.style.transition = 'transform 0.35s cubic-bezier(.34,1.56,.64,1), box-shadow 0.35s ease';
                    __nudgeBtn.style.boxShadow = '0 0 0 0 rgba(34,197,94,0.6)';
                    __nudgeBtn.style.transform = 'scale(1.05)';
                    setTimeout(function() {
                        __nudgeBtn.style.transform = 'scale(1)';
                        __nudgeBtn.style.boxShadow = '0 0 0 18px rgba(34,197,94,0)';
                    }, 350);
                    __nudgeBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } catch(_) {}
                /* repeat pulse every 4s up to 3 times */
                var __pulses = 0;
                var __iv = setInterval(function() {
                    if (__nudgeFired || __pulses >= 3) { clearInterval(__iv); return; }
                    try {
                        __nudgeBtn.style.transform = 'scale(1.05)';
                        setTimeout(function() { __nudgeBtn.style.transform = 'scale(1)'; }, 300);
                    } catch(_) {}
                    __pulses++;
                }, 4000);
            }, 5000);
        } catch(_) {}
    });

    function personalizeGreeting() {
        var el = document.getElementById('hookGreeting');
        if (!el) return;
        var name = '';
        try { name = localStorage.getItem('userName') || ''; } catch(e) {}
        var first = (name || '').trim().split(' ')[0];
        if (first) {
            first = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
            el.innerHTML = '<span>' + first + '</span>, we need to verify your access.';
        } else {
            el.innerHTML = 'Hey, we need to verify your access.';
        }
        el.style.display = '';
    }

    function typewriteHook() {
        var el = document.getElementById('hookTitle');
        var segments = [
            { text: 'Are they ', cls: '' },
            { text: 'hiding', cls: 'word-green' },
            { text: '\n', cls: '' },
            { text: 'something from you', cls: '' },
            { text: '?', cls: '' }
        ];

        var plain = segments.map(function(s) { return s.text; }).join('');
        var idx = 0;
        el.innerHTML = '<span class="cursor"></span>';

        function tick() {
            if (idx >= plain.length) {
                renderFull();
                return;
            }
            idx++;
            renderPartial();
            var d = plain[idx - 1] === '\n' ? 180 : 35 + Math.random() * 25;
            setTimeout(tick, d);
        }

        function renderPartial() {
            var html = '', pos = 0;
            segments.forEach(function(s) {
                var end = pos + s.text.length;
                var vis = Math.max(0, Math.min(idx, end) - pos);
                var t = s.text.substring(0, vis).replace(/\n/g, '<br>');
                if (vis > 0) html += s.cls ? '<span class="' + s.cls + '">' + t + '</span>' : t;
                pos = end;
            });
            el.innerHTML = html + '<span class="cursor"></span>';
        }

        function renderFull() {
            var html = '';
            segments.forEach(function(s) {
                var t = s.text.replace(/\n/g, '<br>');
                html += s.cls ? '<span class="' + s.cls + '">' + t + '</span>' : t;
            });
            el.innerHTML = html;
        }

        setTimeout(tick, 700);
    }

    function bindAll() {
        document.getElementById('btnStart').addEventListener('click', function() {
            /* GENDER_Q1_REMOVED_V1: gender já vem do modal de dashboard.html */
            var gp = '';
            try {
                gp = new URLSearchParams(window.location.search).get('gender')
                    || localStorage.getItem('targetGender') || '';
            } catch(_){}
            if (gp) {
                state.gender = gp;
                state.answers[1] = { value: gp, points: 0 };
            }
            goToScene(2);
            if (typeof FacebookCAPI !== 'undefined') {
                FacebookCAPI.trackEvent('QuizStarted', { content_name: 'Quiz' });
            } else if (typeof fbq === 'function') {
                fbq('trackCustom', 'QuizStarted');
            }
            if (typeof FunnelTracker !== 'undefined') {
                FunnelTracker.track(FunnelTracker.events.QUIZ_STARTED, { from_phone: _fromPhone });
            }
        });

        document.querySelectorAll('.opt[data-q]').forEach(function(btn) {
            btn.addEventListener('click', function() { onSelect(btn); });
        });
    }

    function onSelect(btn) {
        var q = parseInt(btn.dataset.q);
        var v = btn.dataset.v;
        var p = parseInt(btn.dataset.p);

        state.answers[q] = { value: v, points: p };
        state.score = Object.values(state.answers).reduce(function(s, a) { return s + a.points; }, 0);
        /* GENDER_Q1_REMOVED_V1: Q1 desativada — não sobrescrever targetGender aqui */

        if (typeof FunnelTracker !== 'undefined') {
            FunnelTracker.track(FunnelTracker.events.QUIZ_QUESTION_ANSWERED, { question: q, value: v, points: p, score: state.score });
        }

        (btn.closest('.opts') ? btn.closest('.opts').querySelectorAll('.opt') : document.querySelectorAll('.opt[data-q="' + q + '"]')).forEach(function(o) { o.classList.remove('selected'); });
        btn.classList.add('selected');
        if (navigator.vibrate) navigator.vibrate(25);

        setTimeout(function() {
            if (q < TOTAL) {
                goToScene(q + 1);
            } else {
                goToScene('analysis');
                runAnalysis();
            }
        }, 450);
    }

    function goToScene(id) {
        var cur = document.querySelector('.scene.active');
        var next = document.querySelector('[data-scene="' + id + '"]');
        if (!next) return;

        if (typeof id === 'number' && id >= 1 && id <= TOTAL) {
            showProgress(id);
        } else {
            hideProgress();
        }

        if (cur) {
            cur.classList.add('leaving');
            cur.classList.remove('active');
            setTimeout(function() { cur.classList.remove('leaving'); }, 400);
        }

        setTimeout(function() {
            next.classList.add('active');
            state.currentScene = id;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 120);
    }

    function showProgress(q) {
        var bar = document.getElementById('topbar');
        bar.classList.add('visible');
        document.getElementById('topbarFill').style.width = (((q - 1) / ACTIVE) * 100) + '%';
        document.getElementById('topbarLabel').textContent = (q - 1) + ' of ' + ACTIVE;
    }

    function hideProgress() {
        document.getElementById('topbar').classList.remove('visible');
    }

    function runAnalysis() {
        var pctEl = document.getElementById('scanPct');
        var logEl = document.getElementById('analysisLog');
        var headEl = document.getElementById('analysisHeadline');
        var subEl = document.getElementById('analysisSub');
        var start = Date.now();

        logEl.innerHTML = '';
        LOGS.forEach(function(text) {
            var div = document.createElement('div');
            div.className = 'log-line';
            div.innerHTML = '<span class="log-dot"></span><span>' + text + '</span>';
            logEl.appendChild(div);
        });

        var lines = logEl.querySelectorAll('.log-line');
        var step = ANALYSIS_MS / (LOGS.length + 1);

        lines.forEach(function(line, i) {
            setTimeout(function() { line.classList.add('show', 'processing'); }, step * i);
            setTimeout(function() { line.classList.remove('processing'); line.classList.add('done'); }, step * i + step * 0.7);
        });

        var pctI = setInterval(function() {
            var el = Date.now() - start;
            var raw = el / ANALYSIS_MS;
            var eased = 1 - Math.pow(1 - Math.min(raw, 1), 2.5);
            pctEl.textContent = Math.round(eased * 100);
            if (raw >= 1) clearInterval(pctI);
        }, 50);

        setTimeout(function() {
            headEl.style.opacity = '0';
            subEl.style.opacity = '0';
            setTimeout(function() {
                headEl.textContent = 'Diagnosis almost ready...';
                subEl.textContent = 'Finalizing the result';
                headEl.style.opacity = '1';
                subEl.style.opacity = '1';
            }, 300);
        }, ANALYSIS_MS * 0.55);

        setTimeout(function() {
            headEl.style.opacity = '0';
            subEl.style.opacity = '0';
            setTimeout(function() {
                headEl.textContent = 'Result ready.';
                subEl.textContent = '';
                headEl.style.opacity = '1';
            }, 300);
        }, ANALYSIS_MS * 0.88);

        setTimeout(function() {
            try { showResult(); } catch(e) { console.error('showResult error:', e); goToScene('result'); }
        }, ANALYSIS_MS + 1000);
    }

    var __QUIZ_SCORE_V9_COPY = /* QUIZ_SCORE_V9 */ { high: ['URGENT: Unlock the full investigation', 'Score above 75 — high suspicion patterns detected'], moderate: ['Get clarity now — start the verification', 'Investigate the signs and remove the doubt'], low: ['Confirm everything is fine — verify now', 'Anonymous and silent verification'] };
    function showResult() {
        var maxScore = ACTIVE * 15;
        var rawPct = Math.round((state.score / maxScore) * 100);
        var displayPct = Math.max(65, Math.min(rawPct + 20, 97));

        var key = displayPct >= 75 ? 'high' : displayPct >= 50 ? 'moderate' : 'low';
        /* QUIZ_SCORE_V9 */
        try {
            // Persist score for downstream pages (cta-unified can show it)
            try { localStorage.setItem('quizSuspicionScore', String(displayPct)); } catch (e) {}
            try { localStorage.setItem('quizSuspicionLevel', String(key)); } catch (e) {}
            // Personalize CTA copy based on suspicion level
            var __ctaCopy = __QUIZ_SCORE_V9_COPY[key] || __QUIZ_SCORE_V9_COPY.moderate;
            setTimeout(function() {
                var ctaTextEl = document.querySelector('#ctaFinal .cta-text strong');
                var ctaSubEl  = document.querySelector('#ctaFinal .cta-text span');
                if (ctaTextEl) ctaTextEl.textContent = __ctaCopy[0];
                if (ctaSubEl)  ctaSubEl.textContent  = __ctaCopy[1];
                var ctaSecondary = document.getElementById('ctaSecondary');
                if (ctaSecondary) ctaSecondary.textContent = __ctaCopy[0] + ' →';
            }, 50);
        } catch (e) { /* swallow */ }

        var level = LEVELS[key];
        var c = level.color;

        var el;
        el = document.getElementById('resLevel');
        if (el) { el.textContent = level.label; el.style.color = c; }
        el = document.getElementById('resHeadline');
        if (el) el.textContent = level.headline;
        el = document.getElementById('resStat');
        if (el) el.textContent = level.stat;
        el = document.getElementById('resNumber');
        if (el) el.style.color = c;
        el = document.querySelector('.res-pct');
        if (el) el.style.color = c;

        var diagBox = document.getElementById('resDiagnosis');
        if (diagBox) {
            diagBox.style.borderLeftColor = c;
            var svgEl = diagBox.querySelector('.diag-header svg');
            if (svgEl) svgEl.style.stroke = c;
        }
        el = document.getElementById('diagText');
        if (el) el.innerHTML = level.diag;

        var signalsList = document.getElementById('signalsList');
        if (signalsList) {
            signalsList.innerHTML = '';
            var delay = 0;
            for (var q = 2; q <= TOTAL; q++) {
                var ans = state.answers[q];
                if (!ans) continue;
                var map = SIGNAL_MAP[q];
                if (!map) continue;
                var signalText = map[ans.value];
                if (!signalText) continue;

                var isYellow = ans.value === 'b';
                var div = document.createElement('div');
                div.className = 'signal-item' + (isYellow ? ' yellow' : '');
                div.style.animationDelay = (delay * 0.1) + 's';
                div.innerHTML = '<span class="signal-dot"></span>' + signalText;
                signalsList.appendChild(div);
                delay++;
            }
        }

        var arc = document.getElementById('resArc');
        var circumference = 276.46;
        var offset = circumference - (circumference * displayPct / 100);

        var url = DEST + '?from_quiz=true&score=' + displayPct;
        try {
            var params = window.location.search;
            if (typeof TrackingUtils !== 'undefined') {
                var baseUrl = DEST + (params || '') + (params ? '&' : '?') + 'from_quiz=true&score=' + displayPct;
                url = TrackingUtils.appendUTMs(baseUrl);
            } else {
                if (!params || params.indexOf('utm_source') === -1) {
                    var utmKeys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
                    var stored = [];
                    utmKeys.forEach(function(k) { var v = localStorage.getItem(k); if (v) stored.push(k + '=' + encodeURIComponent(v)); });
                    if (stored.length) params = (params ? params + '&' : '?') + stored.join('&');
                }
                var sep = params ? '&' : '?';
                url = DEST + params + sep + 'from_quiz=true&score=' + displayPct;
            }
        } catch(e) { console.error('URL build error:', e); }

        if (_fromPhone) {
            var gp = state.gender || localStorage.getItem('targetGender') || '';
            url = '../phone.html?resume=true' + (gp ? '&gender=' + gp : '');
        }

        goToScene('result');

        var ctaF = document.getElementById('ctaFinal');
        var ctaS = document.getElementById('ctaSecondary');
        if (ctaF) { ctaF.href = url; ctaF.onclick = function() { window.location.href = url; }; }
        if (ctaS) { ctaS.href = url; ctaS.onclick = function() { window.location.href = url; }; }

        startAccessCountdown();

        setTimeout(function() {
            if (arc) {
                arc.style.stroke = c;
                arc.style.strokeDashoffset = offset;
            }
            countUp('resNumber', 0, displayPct, 2500);
        }, 500);

        try {
            var quizData = {
                score: displayPct,
                level: level.label,
                gender: state.gender || 'unknown',
                signals: Object.keys(state.answers).filter(function(k) {
                    return state.answers[k].value === 'a';
                }).length
            };
            if (typeof FacebookCAPI !== 'undefined') {
                FacebookCAPI.trackEvent('QuizCompleted', Object.assign({ content_name: 'Quiz' }, quizData));
            } else if (typeof fbq === 'function') {
                fbq('trackCustom', 'QuizCompleted', quizData);
            }
            if (typeof FunnelTracker !== 'undefined') {
                FunnelTracker.track(FunnelTracker.events.QUIZ_COMPLETED, quizData);
            }
        } catch(e) { console.error('Quiz tracking error:', e); }

        if (typeof FunnelTracker !== 'undefined') {
            var fireCtaTrack = function(label) {
                FunnelTracker.track(FunnelTracker.events.QUIZ_CTA_CLICKED, { cta: label, score: displayPct });
            };
            if (ctaF) ctaF.addEventListener('click', function(){ fireCtaTrack('primary'); }, { once: true });
            if (ctaS) ctaS.addEventListener('click', function(){ fireCtaTrack('secondary'); }, { once: true });
        }
    }

    function startAccessCountdown() {
        var COUNTDOWN_KEY = 'accessExpiresAt';
        var SLOTS_KEY = 'accessSlots';
        var DURATION = 15 * 60 * 1000;

        var expiresAt = localStorage.getItem(COUNTDOWN_KEY);
        if (!expiresAt) {
            expiresAt = Date.now() + DURATION;
            localStorage.setItem(COUNTDOWN_KEY, expiresAt);
            localStorage.setItem(SLOTS_KEY, Math.floor(Math.random() * 3) + 2);
        }
        expiresAt = parseInt(expiresAt);

        var box = document.getElementById('resCountdownBox');
        var timerEl = document.getElementById('countdownTimer');
        var slotsEl = document.getElementById('countdownSlots');
        if (!box || !timerEl) return;

        var slots = parseInt(localStorage.getItem(SLOTS_KEY)) || 3;
        if (slotsEl) slotsEl.textContent = slots;

        box.style.display = '';

        function tick() {
            var remaining = Math.max(0, expiresAt - Date.now());
            var mins = Math.floor(remaining / 60000);
            var secs = Math.floor((remaining % 60000) / 1000);
            timerEl.textContent = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;

            if (mins < 5) timerEl.classList.add('urgent');
            else timerEl.classList.remove('urgent');

            if (remaining > 0) {
                setTimeout(tick, 1000);
            } else if (!document.getElementById('quizExpiredBanner')) {
                var banner = document.createElement('div');
                banner.id = 'quizExpiredBanner';
                banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#ef4444,#dc2626);padding:12px 16px;text-align:center;animation:ub-slide .4s ease;';
                banner.innerHTML = '<p style="margin:0;color:#fff;font-size:13px;font-weight:600;">⚠️ Your access slot is expiring — <a href="javascript:void(0)" onclick="var c=document.querySelector(\'.cta-final,#ctaFinal,.cta-primary,.cta-button,[data-cta]\');if(c)c.click();" style="color:#fff;text-decoration:underline;font-weight:700;">Secure it now</a></p>';
                document.body.appendChild(banner);
            }
        }
        tick();
    }

    function countUp(id, from, to, duration) {
        var el = document.getElementById(id);
        var startT = performance.now();
        function frame(ts) {
            var p = Math.min((ts - startT) / duration, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(from + (to - from) * eased);
            if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

})();
