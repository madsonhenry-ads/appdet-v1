/**
 * Brevo Outbound Webhook Route
 *
 * Receives real-time transactional email events from Brevo.
 *
 * Auth: if BREVO_WEBHOOK_SECRET is configured, the webhook URL must include
 * ?token=<secret>. Otherwise the endpoint is open (dev). Always responds 200
 * so Brevo does not retry non-actionable events.
 */

const express = require('express');
const router = express.Router();
const { BREVO_WEBHOOK_SECRET } = require('../config');
const brevoWebhookService = require('../services/brevo-webhook');

router.post('/api/webhook/brevo', async (req, res) => {
    try {
        // Validate shared secret if configured.
        if (BREVO_WEBHOOK_SECRET) {
            const provided = req.query.token
                || req.body?.token
                || req.headers['x-brevo-token'];
            if (!provided || provided !== BREVO_WEBHOOK_SECRET) {
                console.log('📧 Brevo webhook: unauthorized request rejected');
                return res.status(401).json({ error: 'Unauthorized' });
            }
        }

        const body = req.body;

        // Brevo may send a single event object or an array of events.
        const events = Array.isArray(body) ? body : [body];
        const results = [];
        for (const evt of events) {
            if (evt) results.push(await brevoWebhookService.processBrevoWebhook(evt));
        }

        res.status(200).json({ success: true, accepted: results.length });
    } catch (error) {
        // Never 5xx on a webhook that Brevo can't handle - log and accept.
        console.error('📧 Brevo webhook error:', error.message);
        res.status(200).json({ success: false, error: error.message });
    }
});

module.exports = router;
