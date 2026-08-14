/**
 * Brevo Transactional Email Service
 *
 * Sends recovery funnel emails and welcome emails directly via the Brevo
 * Transactional (SMTP) API, reading HTML/text templates from the local
 * email-templates/ folder and substituting lead variables (%FIRSTNAME%,
 * %LAST4DIGITS%, %MAGICLINK%) at send time.
 *
 * Brevo is the sole provider. Emails get the self-hosted tracking pixel
 * and click-wrapper injected, and carry a track_id in the Brevo payload
 * params so transactional webhook events can be correlated in the DB.
 */

const path = require('path');
const fs = require('fs');
const pool = require('../database');
const trackingService = require('./email-tracking');
const {
    BREVO_API_KEY,
    BREVO_ENABLED,
    BREVO_SENDER_EMAIL,
    BREVO_SENDER_NAME,
    BREVO_API_URL,
    TRACKING_BASE_URL
} = require('../config');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'email-templates');

// Map category <-> folder name in email-templates/
const TEMPLATE_FOLDER_MAP = {
    'checkout_abandon': 'Whats Spy - Recovery Checkout Abandon EN',
    'sale_cancelled': 'Whats Spy - Recovery Sale Cancelled EN',
    'funnel_abandon': 'Whats Spy - Recovery Funnel Abandon EN',
    'welcome': 'Whats Spy - Compra aprovada - EN',
};

// Email file name by number
const EMAIL_FILE_INDEX = {
    1: 'email_1_reminder.txt',
    2: 'email_2_urgency.txt',
    3: 'email_3_discount_30.txt',
    4: 'email_4_final_offer.txt',
};

// Welcome emails use their own file naming (email_1_access.txt, ...)
const WELCOME_FILE_INDEX = {
    1: 'email_1_access.txt',
    2: 'email_2_urgency.txt',
};

/**
 * Check whether a given dispatch category should be routed to Brevo.
 */
function isCategoryEnabled(category) {
    return BREVO_ENABLED;
}

/**
 * Get the target template file path for a category + email number.
 * Uses the EN folder (templates are currently EN only in the repo).
 */
function getTemplateFile(category, emailNum) {
    const folder = TEMPLATE_FOLDER_MAP[category];
    if (!folder) {
        throw new Error(`No Brevo template folder mapped for category: ${category}`);
    }
    const index = category === 'welcome' ? WELCOME_FILE_INDEX : EMAIL_FILE_INDEX;
    const fileName = index[emailNum] || (category === 'welcome'
        ? `email_${emailNum}_access.txt`
        : `email_${emailNum}_reminder.txt`);
    const filePath = path.join(TEMPLATES_DIR, folder, fileName);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Brevo template file not found: ${filePath}`);
    }
    return filePath;
}

/**
 * Parse the .txt template file into { subject, preheader, fromEmail, fromName, html }.
 * Format: optional header lines (Subject line:/Preheader:/From:) followed by HTML.
 */
function parseTemplateFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    let subject = '';
    let preheader = '';
    let from = '';

    // Header format in the .txt files:
    //   Subject line:
    //   <value on next non-empty line>
    //   Preheader:
    //   <value on next non-empty line>
    //   From:
    //   <value on next non-empty line>
    function valueAfterLabel(rawText, label) {
        const lines = rawText.split(/\r?\n/);
        // Case 1: label and value on same line (e.g. "Subject line: My subject")
        const re = new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(.*)$');
        for (const line of lines) {
            const m = line.trim().match(re);
            if (m && m[1] && m[1].trim()) {
                return m[1].trim();
            }
        }
        // Case 2: label alone on its line, value on next non-empty line
        const idx = lines.findIndex(l => l.trim() === label);
        if (idx !== -1) {
            for (let i = idx + 1; i < lines.length; i++) {
                const val = lines[i].trim();
                if (!val) continue;
                if (val.startsWith('<')) break;
                return val;
            }
        }
        return '';
    }

    subject = valueAfterLabel(raw, 'Subject line:');
    preheader = valueAfterLabel(raw, 'Preheader:');
    from = valueAfterLabel(raw, 'From:');

    // Body is everything from <!DOCTYPE or <html onwards
    const htmlStart = raw.search(/<(!DOCTYPE|html)/i);
    let html = htmlStart >= 0 ? raw.slice(htmlStart) : raw;

    // Parse From "Name - email" or "email"
    let fromName = BREVO_SENDER_NAME;
    let fromEmail = BREVO_SENDER_EMAIL;
    if (from) {
        const dashSplit = from.split(' - ');
        if (dashSplit.length === 2) {
            fromName = dashSplit[0].trim() || fromName;
            fromEmail = dashSplit[1].trim() || fromEmail;
        } else if (from.includes('@')) {
            fromEmail = from.trim();
        }
    }

    return { subject, preheader, fromName, fromEmail, html };
}

/**
 * Fetch lead data (name + target_phone) from the DB by email and
 * compute the last 4 digits of the target phone.
 */
async function getLeadData(email) {
    if (!email) return { name: '', last4digits: '' };
    try {
        const res = await pool.queryRetry(`
            SELECT name, target_phone
            FROM leads
            WHERE LOWER(email) = LOWER($1)
            ORDER BY created_at DESC
            LIMIT 1
        `, [email]);
        if (res.rows.length === 0) {
            return { name: '', last4digits: '' };
        }
        const row = res.rows[0];
        let last4digits = '';
        if (row.target_phone) {
            const digitsOnly = String(row.target_phone).replace(/\D/g, '');
            if (digitsOnly.length >= 4) {
                last4digits = digitsOnly.slice(-4);
            }
        }
        return { name: row.name || '', last4digits };
    } catch (error) {
        console.error(`❌ Brevo getLeadData error for ${email}:`, error.message);
        return { name: '', last4digits: '' };
    }
}

/**
 * Substitute AC-style variables in the HTML/subject.
 */
function substituteVariables(text, vars) {
    let out = text;
    for (const [key, value] of Object.entries(vars)) {
        out = out.split(`%${key}%`).join(value || '');
    }
    return out;
}

/**
 * Inject the self-hosted tracking pixel and click-wrapper into email HTML.
 * - Pixel: a 1x1 transparent image pointing at /t/o/{trackId}.
 * - Clicks: wraps external <a href> links with /t/c/{trackId}?url=...
 * Skips mailto:, privacy links, unsubscribe placeholders and already-wrapped URLs.
 */
function injectTracking(html, trackId) {
    const pixel = `<img src="${TRACKING_BASE_URL}/t/o/${trackId}" width="1" height="1" alt="" style="display:none;height:1px;width:1px;max-height:1px;max-width:1px;opacity:0;overflow:hidden;border:0;margin:0;padding:0" />`;

    let out = html;
    if (out.includes('</body>')) {
        out = out.replace('</body>', `${pixel}</body>`);
    } else {
        out = out + pixel;
    }

    // Wrap external links for click tracking.
    out = out.replace(/<a\b([^>]*)href="(https?:\/\/[^"]*)"([^>]*)>/g, (match, before, url, after) => {
        const href = url;
        const lowered = href.toLowerCase();
        if (
            lowered.startsWith('mailto:') ||
            lowered.includes('/privacy') ||
            lowered.includes('/unsubscribe') ||
            href.includes('%UNSUBSCRIBELINK%') ||
            href.includes('/t/c/')
        ) {
            return match; // leave untouched
        }
        const wrapped = `${TRACKING_BASE_URL}/t/c/${trackId}?url=${encodeURIComponent(href)}`;
        return `<a${before}href="${wrapped}"${after}>`;
    });

    return out;
}

/**
 * Send a transactional email via Brevo API (POST /smtp/email).
 *
 * @param {object} opts
 * @param {string} opts.email - recipient
 * @param {string} opts.category - dispatch category (checkout_abandon, sale_cancelled, funnel_abandon, welcome)
 * @param {number} opts.emailNum - which email in the flow (1-4)
 * @param {string} [opts.name] - lead first name (falls back to DB)
 * @param {string} [opts.last4digits] - last4digits (falls back to DB)
 * @param {string} [opts.magicLink] - magic link for welcome emails
 * @param {string} [opts.trackId] - existing track id (generated if omitted)
 * @returns {Promise<{trackId: string, data: object}>}
 */
async function sendTransactional({ email, category, emailNum, name = '', last4digits = '', magicLink = '', trackId }) {
    if (!BREVO_API_KEY) {
        throw new Error('Brevo not configured: BREVO_API_KEY missing');
    }

    const templateFile = getTemplateFile(category, emailNum);
    const template = parseTemplateFile(templateFile);

    // Resolve lead data (merge provided values with DB lookups)
    const lead = await getLeadData(email);
    const firstName = (name || lead.name || '').split(' ')[0];
    if (!last4digits) last4digits = lead.last4digits;

    const vars = {
        FIRSTNAME: firstName,
        LAST4DIGITS: last4digits,
    };
    if (magicLink) vars.MAGICLINK = magicLink;

    const subject = template.subject ? substituteVariables(template.subject, vars) : '';
    let htmlContent = substituteVariables(template.html, vars);

    // Track id for self-hosted tracking + webhook correlation.
    if (!trackId) trackId = trackingService.generateTrackId();

    // Prepend hidden preheader if the template didn't include one.
    if (template.preheader) {
        htmlContent =
            `<div style="display:none;font-size:1px;color:#0a0a0a;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${template.preheader}</div>` +
            htmlContent;
    }

    // Inject self-hosted tracking pixel + click wrapper.
    htmlContent = injectTracking(htmlContent, trackId);

    const payload = {
        sender: {
            name: template.fromName,
            email: template.fromEmail,
        },
        to: [{ email }],
        subject,
        htmlContent,
        headers: {
            'X-Param-Category': category,
            'X-Param-EmailNum': String(emailNum),
            'X-Param-TrackId': trackId,
        },
        params: {
            track_id: trackId,
            category,
            email_num: String(emailNum),
            ...(template.preheader ? { preheader: template.preheader } : {}),
        },
        tags: [category === 'welcome' ? 'welcome' : `recovery_${category}`],
    };

    const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
        method: 'POST',
        headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (e) {
        data = { raw: text };
    }

    if (!response.ok || (data && data.code && data.code !== 'success')) {
        console.error(`❌ Brevo send failed (${response.status}) for ${email} #${emailNum}:`, data);
        throw new Error(`Brevo send failed: ${data?.message || data?.raw || response.status}`);
    }

    console.log(`📧 Brevo: sent email #${emailNum} to ${email} (${category}) [last4: ${last4digits || 'n/a'}] trackId=${trackId}`);
    return { data, trackId };
}

module.exports = {
    isCategoryEnabled,
    sendTransactional,
    getLeadData,
    getTemplateFile,
    parseTemplateFile,
    substituteVariables,
    injectTracking,
    TEMPLATE_FOLDER_MAP,
};
