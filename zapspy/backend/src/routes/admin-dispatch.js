/**
 * Email Dispatch Admin API Routes
 * 
 * Provides endpoints for the admin panel to manage
 * batch email dispatch from PostgreSQL to ActiveCampaign.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware');
const dispatchService = require('../services/email-dispatch');

// ==================== LEAD COUNTS ====================

// GET /api/admin/dispatch/counts - Get lead counts by category
router.get('/api/admin/dispatch/counts', authenticateToken, async (req, res) => {
    try {
        const counts = await dispatchService.getLeadCounts();
        res.json({ success: true, counts });
    } catch (error) {
        console.error('Error getting lead counts:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== BATCH DISPATCH ====================

// POST /api/admin/dispatch/start - Start a batch dispatch
router.post('/api/admin/dispatch/start', authenticateToken, async (req, res) => {
    try {
        const { category, language, batchSize = 500 } = req.body;

        if (!category || !language) {
            return res.status(400).json({ error: 'category and language are required' });
        }

        const validCategories = ['checkout_abandon', 'sale_cancelled', 'funnel_abandon'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
        }

        const validLanguages = ['en', 'es'];
        if (!validLanguages.includes(language)) {
            return res.status(400).json({ error: 'Invalid language. Must be en or es' });
        }

        const size = Math.min(Math.max(parseInt(batchSize) || 500, 10), 2000);
        const result = await dispatchService.startBatchDispatch(category, language, size);
        res.json(result);
    } catch (error) {
        console.error('Error starting dispatch:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/dispatch/status - Get current dispatch status
router.get('/api/admin/dispatch/status', authenticateToken, async (req, res) => {
    try {
        const status = dispatchService.getDispatchStatus();
        res.json({ success: true, status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/dispatch/history - Get dispatch history
router.get('/api/admin/dispatch/history', authenticateToken, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const history = await dispatchService.getDispatchHistory(limit);
        res.json({ success: true, history });
    } catch (error) {
        console.error('Error getting dispatch history:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/dispatch/stats - Get dispatch statistics
router.get('/api/admin/dispatch/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await dispatchService.getDispatchStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error getting dispatch stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== SCHEDULED EMAILS ====================

// POST /api/admin/dispatch/process-scheduled - Process due scheduled emails
router.post('/api/admin/dispatch/process-scheduled', authenticateToken, async (req, res) => {
    try {
        const result = await dispatchService.processScheduledEmails();
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Error processing scheduled emails:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEST EMAIL ====================

// POST /api/admin/dispatch/test - Send test emails to a specific email address
router.post('/api/admin/dispatch/test', authenticateToken, async (req, res) => {
    try {
        const { email, category, language, emailNumbers } = req.body;

        if (!email || !category || !language) {
            return res.status(400).json({ error: 'email, category and language are required' });
        }

        const validCategories = ['checkout_abandon', 'sale_cancelled', 'funnel_abandon'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
        }

        const validLanguages = ['en', 'es'];
        if (!validLanguages.includes(language)) {
            return res.status(400).json({ error: 'Invalid language. Must be en or es' });
        }

        const nums = emailNumbers || [1, 2, 3, 4];
        const result = await dispatchService.sendTestEmails(email, category, language, nums);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Error sending test emails:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== CLEANUP ====================

// POST /api/admin/dispatch/cleanup - Run cleanup of completed contacts
router.post('/api/admin/dispatch/cleanup', authenticateToken, async (req, res) => {
    try {
        const result = await dispatchService.cleanupCompletedContacts();
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Error running cleanup:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== CANCEL FUNNEL FOR SPECIFIC CONTACT ====================

// POST /api/admin/dispatch/cancel-funnel - Cancel email funnel for a specific contact
router.post('/api/admin/dispatch/cancel-funnel', authenticateToken, async (req, res) => {
    try {
        const { email, reason } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'email is required' });
        }

        const result = await dispatchService.cancelEmailFunnel(email, reason || 'admin_manual');
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Error cancelling funnel:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== PURGE AC CONTACTS ====================

// POST /api/admin/dispatch/purge-ac - Delete all recovery contacts from ActiveCampaign to free plan slots
router.post('/api/admin/dispatch/purge-ac', authenticateToken, async (req, res) => {
    try {
        const { confirm } = req.body;
        if (confirm !== 'PURGE_AC') {
            return res.json({
                warning: 'This will DELETE contacts from ActiveCampaign that are in recovery lists.',
                instruction: 'Send { "confirm": "PURGE_AC" } to proceed'
            });
        }

        const acService = require('../services/activecampaign');
        if (!acService.isConfigured()) {
            return res.status(400).json({ error: 'ActiveCampaign not configured' });
        }

        const listNames = [
            ...Object.values(acService.LIST_MAP['checkout_abandoned'] || {}),
            ...Object.values(acService.LIST_MAP['sale_cancelled'] || {}),
            ...Object.values(acService.LIST_MAP['lead_captured'] || {})
        ].filter(Boolean);

        let totalDeleted = 0;
        const listResults = {};

        for (const listName of listNames) {
            try {
                const listId = await acService.getOrCreateList(listName);
                if (!listId) continue;

                let contactsInList = [];
                let offset = 0;

                // Fetch all contacts in this list (paginated)
                while (true) {
                    const data = await acService.apiRequest('GET', 
                        `contacts?listid=${listId}&limit=100&offset=${offset}&status=any`
                    );
                    if (!data || !data.contacts || data.contacts.length === 0) break;
                    contactsInList.push(...data.contacts);
                    offset += 100;
                    if (data.contacts.length < 100) break;
                }

                let deleted = 0;
                for (const contact of contactsInList) {
                    try {
                        await acService.deleteContact(contact.id);
                        deleted++;
                        await new Promise(r => setTimeout(r, 200));
                    } catch (delErr) {
                        console.error(`Error deleting contact ${contact.email}:`, delErr.message);
                    }
                }

                listResults[listName] = { found: contactsInList.length, deleted };
                totalDeleted += deleted;
            } catch (listErr) {
                listResults[listName] = { error: listErr.message };
            }
        }

        console.log(`🗑️ AC Purge: Deleted ${totalDeleted} contacts from recovery lists`);
        res.json({ success: true, totalDeleted, lists: listResults });
    } catch (error) {
        console.error('Error purging AC contacts:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== FULL RESET ====================

// POST /api/admin/dispatch/reset - Reset all dispatch data and metrics to start fresh
router.post('/api/admin/dispatch/reset', authenticateToken, async (req, res) => {
    try {
        const { confirm } = req.body;
        if (confirm !== 'RESET_ALL') {
            return res.status(400).json({ 
                error: 'Safety check: send { "confirm": "RESET_ALL" } to proceed',
                warning: 'This will delete ALL dispatch logs, tracking events, and scheduled emails'
            });
        }

        const pool = require('../database');
        const results = {};

        // 1. Truncate email_dispatch_log (all sent/scheduled/error records)
        try {
            const r1 = await pool.queryRetry('DELETE FROM email_dispatch_log');
            results.dispatch_log = { deleted: r1.rowCount };
        } catch (e) {
            results.dispatch_log = { error: e.message };
        }

        // 2. Truncate email_tracking_events
        try {
            const r2 = await pool.queryRetry('DELETE FROM email_tracking_events');
            results.tracking_events = { deleted: r2.rowCount };
        } catch (e) {
            results.tracking_events = { error: e.message };
        }

        // 3. Truncate email_tracking
        try {
            const r3 = await pool.queryRetry('DELETE FROM email_tracking');
            results.tracking = { deleted: r3.rowCount };
        } catch (e) {
            results.tracking = { error: e.message };
        }

        // 4. Reset recovery_contacts
        try {
            const r4 = await pool.queryRetry('DELETE FROM recovery_contacts');
            results.recovery_contacts = { deleted: r4.rowCount };
        } catch (e) {
            results.recovery_contacts = { error: e.message };
        }

        console.log('🔄 FULL RESET completed:', JSON.stringify(results));
        res.json({ 
            success: true, 
            message: 'All dispatch data and metrics have been reset',
            results 
        });
    } catch (error) {
        console.error('Error resetting dispatch:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
