/* ===================================================================
   conv-time.js — relative timestamps for the WhatsApp simulation page

   Why: hardcoded times like "10:45" feel fake when the user opens the
   page at 20:38. This module rewrites each conversation's time so it
   relates to the user's current local clock, while preserving the
   "lateNight" narrative (those are the suspicion evidence — kept fixed
   on 00:00–05:00 to keep the storyline intact).

   Usage:
     <script src="../shared/js/conv-time.js"></script>
     ...
     ${(window.ZSConvTime && ZSConvTime.format(conv, idx)) || conv.time || ''}

   The output is deterministic per index, so re-renders inside the same
   minute always produce the same time (no flicker / jumping numbers).
=================================================================== */
(function () {
    'use strict';

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function format(conv, idx) {
        if (!conv) return '';
        // Late-night messages (the narrative "evidence") keep their
        // original time so the suspicion analysis still tells a story.
        if (conv.lateNight) return conv.time || '';

        var now = new Date();
        var nowMin = now.getHours() * 60 + now.getMinutes();
        var seed = ((Number(idx) || 0) * 37 + 19) % 997;

        // Don't go further back than 06:00 of the current day, so the
        // displayed times always feel like "today, earlier".
        var dayStart = 6 * 60; // 06:00
        var maxAgo = Math.max(15, nowMin - dayStart);

        var minutesAgo;
        var hasUnread = conv.unread && Number(conv.unread) > 0;

        if (hasUnread) {
            // Unread → very recent (1–45 min).
            var unreadCap = Math.min(45, Math.max(2, maxAgo));
            minutesAgo = 1 + (seed % unreadCap);
        } else {
            // Read → earlier in the day (45 min – 9 h).
            var readCap = Math.min(540, Math.max(60, maxAgo));
            minutesAgo = 45 + (seed % readCap);
        }

        // Hard clamp: never cross past 00:00 today.
        if (minutesAgo > nowMin - 1) minutesAgo = Math.max(1, nowMin - 1);

        var past = new Date(now.getTime() - minutesAgo * 60000);
        return pad(past.getHours()) + ':' + pad(past.getMinutes());
    }

    function currentHHMM() {
        var n = new Date();
        return pad(n.getHours()) + ':' + pad(n.getMinutes());
    }

    var NOW_LABELS = {
        pt: 'agora', es: 'ahora', en: 'now', fr: 'maintenant'
    };
    function nowLabel() {
        var lang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
        return NOW_LABELS[lang] || NOW_LABELS.en;
    }

    /**
     * Mark a conversation row as "active right now":
     *   - sets the time-span to "agora" (i18n) while the typing indicator runs
     *   - on completion, replaces it with the user's real current HH:MM
     * Call this from showTypingIndicator() so the time stays coherent with
     * the live "digitando..." preview the user sees.
     */
    function markActive(timeEl, durationMs) {
        if (!timeEl) return;
        var prevColor = timeEl.style.color;
        var prevWeight = timeEl.style.fontWeight;
        timeEl.textContent = nowLabel();
        timeEl.style.color = '#25D366';
        timeEl.style.fontWeight = '700';
        setTimeout(function () {
            timeEl.textContent = currentHHMM();
            timeEl.style.color = prevColor;
            timeEl.style.fontWeight = prevWeight;
        }, durationMs || 3000);
    }

    window.ZSConvTime = {
        format: format,
        currentHHMM: currentHHMM,
        nowLabel: nowLabel,
        markActive: markActive
    };
})();
