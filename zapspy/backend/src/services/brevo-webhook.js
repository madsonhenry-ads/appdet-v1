/**
 * Brevo Outbound Webhook Service
 *
 * Receives real-time transactional email events from Brevo and records them
 * into the self-hosted tracking tables so the dashboard can show delivery,
 * bounce, unsubscribe and complaint metrics alongside open/click.
 *
 * Correlation strategy (in order of preference):
 *   1. payload.params.track_id -> exact email_tracking row (preferred).
 *   2. payload.headers.X-Param-Category / X-Param-EmailNum + recipient
 *      email -> email_tracking lookup.
 *   3. Fallback: log and ignore (no match).
 *
 * Always "accepts" the event (never throws on unknown events) so Brevo does
 * not keep retrying.
 */

const trackingService = require('./email-tracking');

// Map Brevo event names -> canonical metric event type.
const EVENT_MAP = {
    delivered: 'delivered',
    sent: 'delivered',
    request: 'delivered',
    deferred: 'delivered',
    open: 'open',
    click: 'click',
    hard_bounce: 'hard_bounce',
    invalid_email: 'hard_bounce',
    blocked: 'hard_bounce',
    soft_bounce: 'soft_bounce',
    unsubscribed: 'unsubscribed',
    unsubscribed_from_list: 'unsubscribed',
    complaint: 'complaint',
    spam: 'complaint',
};

function normalizeHeaders(headers) {
    if (!headers) return {};
    const out = {};
    if (typeof headers === 'string') {
        // Some event payloads send headers as a JSON string.
        try {
            return JSON.parse(headers);
        } catch (e) {
            return out;
        }
    }
    for (const [k, v] of Object.entries(headers)) {
        out[String(k).toLowerCase().replace(/-/g, '_')] = v;
    }
    return out;
}

async function resolveTrackInfo(payload) {
    // 1. Preferred: params.track_id
    const params = payload.params || payload.attributes || {};
    if (params.track_id) {
        return { trackId: String(params.track_id) };
    }

    // 2. Via custom headers echoed back (X-Param-Category / X-Param-EmailNum)
    const headers = normalizeHeaders(payload.headers || {});
    const category = headers['x_param_category'] || headers['x-param-category'];
    const emailNum = headers['x_param_emailnum'] || headers['x-param-emailnum'];
    const trackIdHeader = headers['x_param_trackid'] || headers['x-param-trackid'];
    const email = payload.email;

    if (trackIdHeader) {
        return { trackId: String(trackIdHeader) };
    }

    if (email && category && emailNum) {
        return { email, category, language: null, emailNum: parseInt(emailNum) };
    }

    return null;
}

/**
 * Process a single Brevo webhook event.
 * Always resolves to { accepted: true } unless invalid.
 */
async function processBrevoWebhook(payload) {
    if (!payload || !payload.event) {
        return { accepted: true, matched: false, ignored: true, reason: 'no_event' };
    }

    const canonical = EVENT_MAP[String(payload.event).toLowerCase()];
    if (!canonical) {
        console.log(`📧 Brevo webhook: ignoring unknown event "${payload.event}" for ${payload.email || '?'}`);
        return { accepted: true, matched: false, ignored: true, reason: 'unknown_event' };
    }

    const info = await resolveTrackInfo(payload);
    if (!info) {
        console.log(`📧 Brevo webhook: no correlation for ${payload.event} -> ${payload.email || '?'}`);
        return { accepted: true, matched: false, reason: 'no_correlation' };
    }

    const eventData = {
        url: payload.link || payload.url || '',
        ip: payload.ip || '',
        userAgent: payload['user-agent'] || payload.user_agent || '',
    };

    let recorded = false;
    if (info.trackId) {
        recorded = await trackingService.recordEvent(info.trackId, canonical, eventData);
    } else if (info.email && info.category) {
        recorded = await trackingService.recordEventByEmail(
            info.email, info.category, (info.language || 'en'), info.emailNum, canonical, eventData
        );
    }

    if (recorded) {
        console.log(`📧 Brevo webhook: ${payload.event} -> ${canonical} recorded for ${payload.email} (track ${info.trackId || 'by-email'})`);
    } else {
        console.log(`📧 Brevo webhook: ${payload.event} recorded=false for ${payload.email}`);
    }

    return { accepted: true, matched: true, eventType: canonical, recorded };
}

module.exports = {
    processBrevoWebhook,
    EVENT_MAP,
};
