/**
 * ActiveCampaign Admin API Routes
 * 
 * Provides endpoints for the admin panel to manage
 * ActiveCampaign automations, contacts, and email campaigns.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware');
const { AC_API_URL, AC_API_KEY } = require('../config');
const acService = require('../services/activecampaign');

// ==================== HELPERS ====================

function isACConfigured() {
    return !!(AC_API_URL && AC_API_KEY);
}

async function acApiRequest(method, endpoint, body = null) {
    const url = `${AC_API_URL}/api/3/${endpoint}`;
    const options = {
        method,
        headers: {
            'Api-Token': AC_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
}

// ==================== STATUS ====================

// GET /api/admin/ac/status - Check AC connection status
router.get('/api/admin/ac/status', authenticateToken, async (req, res) => {
    try {
        if (!isACConfigured()) {
            return res.json({ configured: false, connected: false, message: 'ActiveCampaign not configured. Set AC_API_URL and AC_API_KEY.' });
        }
        const result = await acApiRequest('GET', 'users/me');
        if (result.ok) {
            return res.json({ configured: true, connected: true, user: result.data.user?.email || 'Unknown' });
        }
        return res.json({ configured: true, connected: false, message: 'API key invalid or expired' });
    } catch (error) {
        res.json({ configured: true, connected: false, message: error.message });
    }
});

// ==================== AUTOMATIONS ====================

// GET /api/admin/ac/automations - List all Whats Spy automations
router.get('/api/admin/ac/automations', authenticateToken, async (req, res) => {
    try {
        if (!isACConfigured()) {
            return res.status(400).json({ error: 'ActiveCampaign not configured' });
        }

        // Fetch all automations
        const result = await acApiRequest('GET', 'automations?limit=100');
        if (!result.ok) {
            return res.status(500).json({ error: 'Failed to fetch automations', details: result.data });
        }

        // Filter Whats Spy automations
        const allAutomations = result.data.automations || [];
        const WhatSpyAutomations = allAutomations.filter(a => 
            a.name && a.name.toLowerCase().includes('whats spy')
        );

        // Enrich with contact counts
        const enriched = [];
        for (const auto of WhatSpyAutomations) {
            // Get contacts in this automation
            let contactCount = 0;
            try {
                const contactsResult = await acApiRequest('GET', `automations/${auto.id}/contacts?limit=1`);
                if (contactsResult.ok && contactsResult.data.meta) {
                    contactCount = parseInt(contactsResult.data.meta.total || 0);
                }
            } catch (e) {}

            enriched.push({
                id: auto.id,
                name: auto.name,
                status: auto.status === '1' ? 'active' : 'inactive',
                entered: parseInt(auto.entered || 0),
                exited: parseInt(auto.exited || 0),
                contacts: contactCount,
                created: auto.cdate,
                modified: auto.mdate,
                // Parse type from name
                type: parseAutomationType(auto.name),
                language: parseAutomationLanguage(auto.name)
            });
        }

        res.json({ automations: enriched, total: enriched.length });
    } catch (error) {
        console.error('Error fetching AC automations:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/admin/ac/automations/:id/activate - Activate an automation
router.put('/api/admin/ac/automations/:id/activate', authenticateToken, async (req, res) => {
    try {
        if (!isACConfigured()) return res.status(400).json({ error: 'AC not configured' });
        
        const result = await acApiRequest('PUT', `automations/${req.params.id}`, {
            automation: { status: '1' }  // 1 = active
        });
        
        if (result.ok) {
            return res.json({ success: true, message: 'Automation activated' });
        }
        res.status(500).json({ error: 'Failed to activate', details: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/admin/ac/automations/:id/deactivate - Deactivate an automation
router.put('/api/admin/ac/automations/:id/deactivate', authenticateToken, async (req, res) => {
    try {
        if (!isACConfigured()) return res.status(400).json({ error: 'AC not configured' });
        
        const result = await acApiRequest('PUT', `automations/${req.params.id}`, {
            automation: { status: '0' }  // 0 = inactive
        });
        
        if (result.ok) {
            return res.json({ success: true, message: 'Automation deactivated' });
        }
        res.status(500).json({ error: 'Failed to deactivate', details: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== CONTACTS ====================

// GET /api/admin/ac/contacts - List contacts with tags/automations
router.get('/api/admin/ac/contacts', authenticateToken, async (req, res) => {
    try {
        if (!isACConfigured()) return res.status(400).json({ error: 'AC not configured' });
        
        const { page = 1, limit = 20, search, tag, automation } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let endpoint = `contacts?limit=${limit}&offset=${offset}&orders[cdate]=DESC`;
        if (search) endpoint += `&search=${encodeURIComponent(search)}`;
        if (tag) endpoint += `&tagid=${tag}`;
        
        const result = await acApiRequest('GET', endpoint);
        if (!result.ok) {
            return res.status(500).json({ error: 'Failed to fetch contacts' });
        }

        const contacts = (result.data.contacts || []).map(c => ({
            id: c.id,
            email: c.email,
            firstName: c.firstName,
            lastName: c.lastName,
            phone: c.phone,
            created: c.cdate,
            updated: c.udate,
            score: c.scoreValues ? c.scoreValues[0]?.score : null
        }));

        res.json({
            contacts,
            total: parseInt(result.data.meta?.total || 0),
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/ac/contacts/add - Add a contact and trigger automation
router.post('/api/admin/ac/contacts/add', authenticateToken, async (req, res) => {
    try {
        if (!isACConfigured()) return res.status(400).json({ error: 'AC not configured' });
        
        const { email, firstName, phone, eventType, language } = req.body;
        
        if (!email || !eventType || !language) {
            return res.status(400).json({ error: 'email, eventType, and language are required' });
        }

        const result = await acService.processEvent(eventType, language, {
            email,
            name: firstName || '',
            phone: phone || ''
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TAGS ====================

// GET /api/admin/ac/tags - List all Whats Spy tags
router.get('/api/admin/ac/tags', authenticateToken, async (req, res) => {
    try {
        if (!isACConfigured()) return res.status(400).json({ error: 'AC not configured' });
        
        let allTags = [];
        let offset = 0;
        while (true) {
            const result = await acApiRequest('GET', `tags?limit=100&offset=${offset}`);
            if (!result.ok || !result.data.tags || result.data.tags.length === 0) break;
            allTags.push(...result.data.tags);
            if (result.data.tags.length < 100) break;
            offset += 100;
        }

        const WhatSpyTags = allTags.filter(t => t.tag && t.tag.toLowerCase().includes('whats spy'));
        
        // Get contact count for each tag
        const enrichedTags = [];
        for (const tag of WhatSpyTags) {
            let contactCount = 0;
            try {
                const contactsResult = await acApiRequest('GET', `contacts?tagid=${tag.id}&limit=1`);
                if (contactsResult.ok && contactsResult.data.meta) {
                    contactCount = parseInt(contactsResult.data.meta.total || 0);
                }
            } catch (e) {}
            
            enrichedTags.push({
                id: tag.id,
                name: tag.tag,
                description: tag.description || '',
                contacts: contactCount,
                created: tag.cdate
            });
        }

        res.json({ tags: enrichedTags });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== LISTS ====================

// GET /api/admin/ac/lists - List all Whats Spy lists
router.get('/api/admin/ac/lists', authenticateToken, async (req, res) => {
    try {
        if (!isACConfigured()) return res.status(400).json({ error: 'AC not configured' });
        
        const result = await acApiRequest('GET', 'lists?limit=100');
        if (!result.ok) return res.status(500).json({ error: 'Failed to fetch lists' });
        
        const allLists = result.data.lists || [];
        const WhatSpyLists = allLists.filter(l => l.name && l.name.toLowerCase().includes('whats spy'));
        
        const enrichedLists = WhatSpyLists.map(l => ({
            id: l.id,
            name: l.name,
            subscribers: parseInt(l.subscriber_count || 0),
            unsubscribers: parseInt(l.unsubscriber_count || 0),
            created: l.cdate
        }));

        res.json({ lists: enrichedLists });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== MESSAGES (EMAILS) ====================

// GET /api/admin/ac/messages - List all Whats Spy email messages
router.get('/api/admin/ac/messages', authenticateToken, async (req, res) => {
    try {
        if (!isACConfigured()) return res.status(400).json({ error: 'AC not configured' });
        
        let allMessages = [];
        let offset = 0;
        while (true) {
            const result = await acApiRequest('GET', `messages?limit=100&offset=${offset}`);
            if (!result.ok || !result.data.messages || result.data.messages.length === 0) break;
            allMessages.push(...result.data.messages);
            if (result.data.messages.length < 100) break;
            offset += 100;
        }

        const WhatSpyMessages = allMessages.filter(m => 
            m.subject && (m.subject.toLowerCase().includes('whats spy') || m.subject.toLowerCase().includes('zap spy') || m.subject.toLowerCase().includes('x ai monitor'))
        );

        const enrichedMessages = WhatSpyMessages.map(m => ({
            id: m.id,
            subject: m.subject,
            fromName: m.fromname,
            fromEmail: m.fromemail,
            created: m.cdate,
            modified: m.mdate
        }));

        res.json({ messages: enrichedMessages, total: enrichedMessages.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== DASHBOARD STATS ====================

// GET /api/admin/ac/dashboard - Get AC dashboard overview
router.get('/api/admin/ac/dashboard', authenticateToken, async (req, res) => {
    try {
        if (!isACConfigured()) {
            return res.json({
                configured: false,
                automations: [],
                totalContacts: 0,
                totalTags: 0,
                totalLists: 0
            });
        }

        // Fetch automations
        const autoResult = await acApiRequest('GET', 'automations?limit=100');
        const allAutomations = autoResult.ok ? (autoResult.data.automations || []) : [];
        const WhatSpyAutomations = allAutomations.filter(a => a.name && a.name.toLowerCase().includes('whats spy'));

        // Fetch tags
        const tagsResult = await acApiRequest('GET', 'tags?limit=100');
        const allTags = tagsResult.ok ? (tagsResult.data.tags || []) : [];
        const WhatSpyTags = allTags.filter(t => t.tag && t.tag.toLowerCase().includes('whats spy'));

        // Fetch lists
        const listsResult = await acApiRequest('GET', 'lists?limit=100');
        const allLists = listsResult.ok ? (listsResult.data.lists || []) : [];
        const WhatSpyLists = allLists.filter(l => l.name && l.name.toLowerCase().includes('whats spy'));

        // Fetch total contacts
        const contactsResult = await acApiRequest('GET', 'contacts?limit=1');
        const totalContacts = contactsResult.ok ? parseInt(contactsResult.data.meta?.total || 0) : 0;

        // Build automation summary
        const automationSummary = WhatSpyAutomations.map(a => ({
            id: a.id,
            name: a.name,
            status: a.status === '1' ? 'active' : 'inactive',
            entered: parseInt(a.entered || 0),
            exited: parseInt(a.exited || 0),
            type: parseAutomationType(a.name),
            language: parseAutomationLanguage(a.name)
        }));

        // Calculate totals
        const totalEntered = automationSummary.reduce((sum, a) => sum + a.entered, 0);
        const totalExited = automationSummary.reduce((sum, a) => sum + a.exited, 0);
        const activeCount = automationSummary.filter(a => a.status === 'active').length;

        res.json({
            configured: true,
            connected: true,
            automations: automationSummary,
            stats: {
                totalAutomations: automationSummary.length,
                activeAutomations: activeCount,
                inactiveAutomations: automationSummary.length - activeCount,
                totalEntered: totalEntered,
                totalExited: totalExited,
                totalContacts: totalContacts,
                totalTags: WhatSpyTags.length,
                totalLists: WhatSpyLists.length
            },
            tags: WhatSpyTags.map(t => ({ id: t.id, name: t.tag })),
            lists: WhatSpyLists.map(l => ({ id: l.id, name: l.name, subscribers: parseInt(l.subscriber_count || 0) }))
        });
    } catch (error) {
        console.error('Error fetching AC dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== HELPERS ====================

function parseAutomationType(name) {
    if (!name) return 'unknown';
    const lower = name.toLowerCase();
    if (lower.includes('checkout')) return 'checkout_abandon';
    if (lower.includes('sale') || lower.includes('cancel')) return 'sale_cancelled';
    if (lower.includes('funnel') || lower.includes('lead')) return 'funnel_abandon';
    return 'other';
}

function parseAutomationLanguage(name) {
    if (!name) return 'unknown';
    if (name.endsWith(' EN') || name.includes(' EN ')) return 'en';
    if (name.endsWith(' ES') || name.includes(' ES ')) return 'es';
    return 'unknown';
}

module.exports = router;
