/**
 * Welcome Email Service
 *
 * Sends the purchase-welcome email (confirmation + PDF access) via Brevo.
 * Email 1 is sent immediately on purchase approval; a conditional email 2
 * (+1h) is enqueued and only fires if email 1 was not opened/clicked.
 *
 * (Legacy Supabase user provisioning was removed.)
 */

const brevo = require('./brevo');

/**
 * Send the welcome email to a buyer.
 *
 * @param {string} email - Buyer's email
 * @param {string} name - Buyer's name
 * @param {string} funnelLanguage - 'en', 'es', 'pt', 'fr'
 */
async function sendWelcomeEmail(email, name, funnelLanguage) {
    const lang = (funnelLanguage || 'en').startsWith('es') ? 'es' :
                 (funnelLanguage || 'en').startsWith('pt') ? 'pt' :
                 (funnelLanguage || 'en').startsWith('fr') ? 'fr' : 'en';

    try {
        const dispatch = require('../services/email-dispatch');
        const tracking = require('../services/email-tracking');

        // Send welcome email 1 immediately via Brevo.
        const trackId = tracking.generateTrackId();
        await brevo.sendTransactional({
            email,
            category: 'welcome',
            emailNum: 1,
            name: name || '',
            trackId,
        });
        await tracking.createTrackingRecord(email, 'welcome', lang, 1, null);

        // Enqueue conditional welcome email 2 (+1h). The cron skips it if
        // email 1 was opened/clicked. Email 1 was already sent above, so
        // only schedule from email 2 onwards.
        await dispatch.enqueueRecovery({ email, name, category: 'welcome', language: lang, fromEmailNum: 2 });

        console.log(`📧 Brevo: welcome email sent to ${email} (${lang})`);
    } catch (err) {
        console.error(`📧 Brevo: Error sending welcome email to ${email}:`, err.message);
    }
}

module.exports = {
    sendWelcomeEmail
};
