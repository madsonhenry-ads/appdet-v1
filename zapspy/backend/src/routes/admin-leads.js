const express = require('express');
const router = express.Router();
const pool = require('../database');
const path = require('path');
const { authenticateToken, requireAdmin, bulkLimiter } = require('../middleware');
const { getCountryFromIP } = require('../services/geolocation');
const { ZAPI_INSTANCE, ZAPI_TOKEN, ZAPI_BASE_URL, ZAPI_CLIENT_TOKEN } = require('../config');
const { zapiCheckStatus, zapiSendText, zapiProfilePicture } = require('../services/zapi');

// ==================== LEADS MANAGEMENT ====================

// Get leads paginated (protected)
router.get('/api/admin/leads', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const language = req.query.language || '';  // Filter by funnel language (en/es)
        const source = req.query.source || '';  // Filter by funnel source (main/affiliate)
        const platform = req.query.platform || '';  // Filter by payment platform (monetizze/perfectpay)
        const { startDate, endDate } = req.query;
        
        let query = `SELECT * FROM leads`;
        let countQuery = `SELECT COUNT(*) FROM leads`;
        let params = [];
        let conditions = [];
        
        if (search) {
            conditions.push(`(email ILIKE $${params.length + 1} OR whatsapp ILIKE $${params.length + 1} OR target_phone ILIKE $${params.length + 1} OR name ILIKE $${params.length + 1})`);
            params.push(`%${search}%`);
        }
        
        if (status) {
            conditions.push(`status = $${params.length + 1}`);
            params.push(status);
        }
        
        if (language) {
            // Treat NULL as 'en' (English is default for legacy leads)
            if (language === 'en') {
                conditions.push(`(funnel_language = $${params.length + 1} OR funnel_language IS NULL)`);
            } else {
                conditions.push(`funnel_language = $${params.length + 1}`);
            }
            params.push(language);
        }
        
        if (source) {
            // Treat NULL as 'main' (main is default for legacy leads)
            if (source === 'main') {
                conditions.push(`(funnel_source = $${params.length + 1} OR funnel_source IS NULL)`);
            } else {
                conditions.push(`funnel_source = $${params.length + 1}`);
            }
            params.push(source);
        }
        
        if (startDate && endDate) {
            conditions.push(`(created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}::date AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 2}::date`);
            params.push(startDate, endDate);
        }
        
        // Platform filter: filter leads whose email appears in transactions of the selected platform
        if (platform === 'monetizze' && !source) {
            conditions.push(`email IN (SELECT DISTINCT email FROM transactions WHERE funnel_source IN ('main', 'affiliate') OR funnel_source IS NULL)`);
        } else if (platform === 'perfectpay' && !source) {
            conditions.push(`email IN (SELECT DISTINCT email FROM transactions WHERE funnel_source = 'perfectpay')`);
        }
        
        // WhatsApp verification filter
        const whatsappVerified = req.query.whatsapp_verified || '';
        if (whatsappVerified) {
            if (whatsappVerified === 'verified') {
                conditions.push(`whatsapp_verified = true`);
            } else if (whatsappVerified === 'invalid') {
                conditions.push(`whatsapp_verified = false`);
            } else if (whatsappVerified === 'pending') {
                conditions.push(`whatsapp_verified IS NULL`);
            }
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
            countQuery += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const [leadsResult, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, params.slice(0, -2))
        ]);
        
        res.json({
            leads: leadsResult.rows,
            pagination: {
                page,
                limit,
                total: parseInt(countResult.rows[0].count),
                totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
            }
        });
        
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
});

// Get clients (leads who purchased) - protected
router.get('/api/admin/clients', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const language = req.query.language || '';
        const source = req.query.source || '';
        const { startDate, endDate } = req.query;
        
        // Clients = leads with status 'converted' OR leads that have transactions with status 'approved'
        let conditions = [`(l.status = 'converted' OR l.total_spent > 0 OR l.first_purchase_at IS NOT NULL)`];
        let params = [];
        
        if (search) {
            conditions.push(`(l.email ILIKE $${params.length + 1} OR l.whatsapp ILIKE $${params.length + 1} OR l.name ILIKE $${params.length + 1})`);
            params.push(`%${search}%`);
        }
        
        if (language) {
            if (language === 'en') {
                conditions.push(`(l.funnel_language = $${params.length + 1} OR l.funnel_language IS NULL)`);
            } else {
                conditions.push(`l.funnel_language = $${params.length + 1}`);
            }
            params.push(language);
        }
        
        if (source) {
            if (source === 'main') {
                conditions.push(`(l.funnel_source = $${params.length + 1} OR l.funnel_source IS NULL)`);
            } else {
                conditions.push(`l.funnel_source = $${params.length + 1}`);
            }
            params.push(source);
        }
        
        // Date range filter on first_purchase_at
        if (startDate && endDate) {
            conditions.push(`(l.first_purchase_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}::date`);
            conditions.push(`(l.first_purchase_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 2}::date`);
            params.push(startDate, endDate);
        }
        
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        // Main query: get clients with their purchase info
        const query = `
            SELECT l.id, l.name, l.email, l.whatsapp, l.country_code, l.country, l.city,
                   l.funnel_language, l.funnel_source, l.status,
                   l.products_purchased, l.total_spent, l.first_purchase_at, l.last_purchase_at,
                   l.whatsapp_verified, l.whatsapp_profile_pic, l.created_at,
                   (SELECT COUNT(*) FROM transactions t WHERE LOWER(t.email) = LOWER(l.email) AND t.status = 'approved') as tx_count,
                   (SELECT SUM(CAST(t.value AS DECIMAL)) FROM transactions t WHERE LOWER(t.email) = LOWER(l.email) AND t.status = 'approved') as tx_total
            FROM leads l
            ${whereClause}
            ORDER BY l.last_purchase_at DESC NULLS LAST, l.first_purchase_at DESC NULLS LAST
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        
        const countQuery = `SELECT COUNT(*) FROM leads l ${whereClause}`;
        
        // Stats query
        const statsQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE (l.first_purchase_at AT TIME ZONE 'America/Sao_Paulo')::date = CURRENT_DATE) as today,
                COALESCE(SUM(l.total_spent), 0) as total_revenue,
                CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(l.total_spent), 0) / COUNT(*) ELSE 0 END as avg_ticket
            FROM leads l
            ${whereClause}
        `;
        
        const queryParams = [...params, limit, offset];
        
        const [clientsResult, countResult, statsResult] = await Promise.all([
            pool.query(query, queryParams),
            pool.query(countQuery, params),
            pool.query(statsQuery, params)
        ]);
        
        const stats = statsResult.rows[0] || {};
        
        res.json({
            clients: clientsResult.rows,
            stats: {
                total: parseInt(stats.total || 0),
                today: parseInt(stats.today || 0),
                totalRevenue: parseFloat(stats.total_revenue || 0),
                avgTicket: parseFloat(stats.avg_ticket || 0)
            },
            pagination: {
                page,
                limit,
                total: parseInt(countResult.rows[0].count),
                totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
            }
        });
        
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

// ==================== WHATSAPP Z-API INTEGRATION ====================

router.get('/api/admin/whatsapp/diagnostics', authenticateToken, async (req, res) => {
    const results = {
        config: {
            instanceId: ZAPI_INSTANCE,
            instanceIdLength: ZAPI_INSTANCE.length,
            instanceIdSource: process.env.ZAPI_INSTANCE_ID ? 'ENV_VAR' : 'FALLBACK_DEFAULT',
            token: ZAPI_TOKEN.substring(0, 6) + '***' + ZAPI_TOKEN.slice(-4),
            tokenLength: ZAPI_TOKEN.length,
            tokenSource: process.env.ZAPI_TOKEN ? 'ENV_VAR' : 'FALLBACK_DEFAULT',
            clientToken: ZAPI_CLIENT_TOKEN ? ZAPI_CLIENT_TOKEN.substring(0, 6) + '***' + ZAPI_CLIENT_TOKEN.slice(-4) : 'NOT SET',
            clientTokenLength: ZAPI_CLIENT_TOKEN.length,
            clientTokenSource: process.env.ZAPI_CLIENT_TOKEN ? 'ENV_VAR' : 'FALLBACK_DEFAULT',
            baseUrl: ZAPI_BASE_URL
        },
        tests: {}
    };

    // Test 1: Status without Client-Token
    try {
        const resp1 = await fetch(`${ZAPI_BASE_URL}/status`, { method: 'GET' });
        const text1 = await resp1.text();
        results.tests.statusWithoutClientToken = {
            httpStatus: resp1.status,
            response: text1.substring(0, 500)
        };
    } catch (e) {
        results.tests.statusWithoutClientToken = { error: e.message };
    }

    // Test 2: Status with Client-Token
    try {
        const headers2 = {};
        if (ZAPI_CLIENT_TOKEN) headers2['Client-Token'] = ZAPI_CLIENT_TOKEN;
        const resp2 = await fetch(`${ZAPI_BASE_URL}/status`, { method: 'GET', headers: headers2 });
        const text2 = await resp2.text();
        results.tests.statusWithClientToken = {
            httpStatus: resp2.status,
            headers: Object.fromEntries(Object.entries(headers2).map(([k,v]) => [k, k === 'Client-Token' ? v.substring(0,6) + '***' : v])),
            response: text2.substring(0, 500)
        };
    } catch (e) {
        results.tests.statusWithClientToken = { error: e.message };
    }

    res.json(results);
});

// ---- Z-API Custom URL Test ----
router.post('/api/admin/whatsapp/test-url', authenticateToken, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });
        
        // Extract base URL (remove /send-text or other endpoints)
        let baseUrl = url.replace(/\/(send-text|send-message-text|status|phone-exists\/\d+)\/?$/, '');
        
        const results = {};
        
        // Test status endpoint
        const statusUrl = `${baseUrl}/status`;
        const headers = {};
        if (ZAPI_CLIENT_TOKEN) headers['Client-Token'] = ZAPI_CLIENT_TOKEN;
        
        console.log(`📱 Custom URL test: ${statusUrl}`);
        console.log(`📱 Client-Token: ${ZAPI_CLIENT_TOKEN ? 'SET' : 'NOT SET'}`);
        
        try {
            const resp = await fetch(statusUrl, { method: 'GET', headers });
            const text = await resp.text();
            results.statusTest = { url: statusUrl, httpStatus: resp.status, response: text.substring(0, 500) };
        } catch (e) {
            results.statusTest = { url: statusUrl, error: e.message };
        }
        
        // Compare with our configured URL
        results.comparison = {
            yourUrl: baseUrl,
            ourUrl: ZAPI_BASE_URL,
            match: baseUrl === ZAPI_BASE_URL
        };
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ---- Send WhatsApp message via Z-API ----
router.post('/api/admin/whatsapp/send', authenticateToken, async (req, res) => {
    try {
        const { phone, message } = req.body;
        
        if (!phone || !message) {
            return res.status(400).json({ error: 'Phone and message are required' });
        }
        
        // Clean phone number - remove all non-digits
        const cleanPhone = phone.replace(/\D/g, '');
        
        if (cleanPhone.length < 10) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }
        
        // Send via Z-API send-text (dual instance fallback)
        const result = await zapiSendText(cleanPhone, message);
        
        if (result.ok && result.data.messageId) {
            try {
                await pool.query(`
                    INSERT INTO whatsapp_messages (phone, message, message_id, zaap_id, status, sent_by, created_at)
                    VALUES ($1, $2, $3, $4, 'sent', $5, NOW())
                `, [cleanPhone, message, result.data.messageId, result.data.zaapId, req.user?.email || 'admin']);
            } catch (dbError) {
                console.log('WhatsApp message log skipped (table may not exist):', dbError.message);
            }
            
            res.json({ 
                success: true, 
                messageId: result.data.messageId,
                zaapId: result.data.zaapId
            });
        } else {
            console.error('Z-API send error - all instances failed');
            res.status(500).json({ 
                error: 'Failed to send WhatsApp message', 
                details: 'Todas as instâncias Z-API falharam. Verifique se estão conectadas.'
            });
        }
        
    } catch (error) {
        console.error('Error sending WhatsApp:', error);
        res.status(500).json({ error: 'Failed to send WhatsApp message', details: error.message });
    }
});

// ---- Check Z-API instance status (dual instance) ----
router.get('/api/admin/whatsapp/status', authenticateToken, async (req, res) => {
    try {
        const status = await zapiCheckStatus();
        if (status.connected) {
            res.json(status);
        } else {
            res.status(500).json({ 
                error: 'Nenhuma instância Z-API conectada',
                details: 'Verifique as instâncias no painel Z-API'
            });
        }
    } catch (error) {
        console.error('Error checking WhatsApp status:', error);
        res.status(500).json({ error: 'Failed to check WhatsApp status', details: error.message });
    }
});

// Verify a single WhatsApp number
router.post('/api/admin/leads/:id/verify-whatsapp', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get lead's phone number
        const leadResult = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
        if (leadResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        
        const lead = leadResult.rows[0];
        let phone = lead.whatsapp || '';
        
        if (!phone) {
            return res.status(400).json({ error: 'No phone number available', verified: false });
        }
        
        // Clean phone number - remove all non-digits
        phone = phone.replace(/\D/g, '');
        
        console.log(`📱 Verifying WhatsApp: ${phone} (apenas foto de perfil)`);
        
        const profilePicture = await zapiProfilePicture(phone);
        const isRegistered = !!profilePicture;
        
        await pool.query(`
            UPDATE leads SET 
                whatsapp_verified = $1,
                whatsapp_verified_at = NOW(),
                whatsapp_profile_pic = $2,
                updated_at = NOW()
            WHERE id = $3
        `, [isRegistered, profilePicture, id]);
        
        res.json({ 
            success: true, 
            verified: isRegistered, 
            profilePicture,
            phone
        });
        
    } catch (error) {
        console.error('Error verifying WhatsApp:', error);
        res.status(500).json({ error: 'Failed to verify WhatsApp' });
    }
});

// Bulk verify multiple leads (with rate limiting)
router.post('/api/admin/leads/bulk-verify-whatsapp', authenticateToken, async (req, res) => {
    try {
        const { leadIds } = req.body;
        
        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: 'No lead IDs provided' });
        }
        
        // Limit to 20 at a time to avoid rate limiting
        const limitedIds = leadIds.slice(0, 20);
        
        // Get leads
        const leadsResult = await pool.query(
            'SELECT id, whatsapp FROM leads WHERE id = ANY($1)',
            [limitedIds]
        );
        
        const results = [];
        
        for (const lead of leadsResult.rows) {
            let phone = lead.whatsapp || '';
            if (!phone) {
                results.push({ id: lead.id, verified: false, error: 'No phone' });
                continue;
            }
            
            phone = phone.replace(/\D/g, '');
            
            try {
                const profilePicture = await zapiProfilePicture(phone);
                const isRegistered = !!profilePicture;
                
                await pool.query(`
                    UPDATE leads SET 
                        whatsapp_verified = $1,
                        whatsapp_verified_at = NOW(),
                        whatsapp_profile_pic = COALESCE($3, whatsapp_profile_pic),
                        updated_at = NOW()
                    WHERE id = $2
                `, [isRegistered, lead.id, profilePicture]);
                
                results.push({ id: lead.id, verified: isRegistered });
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (e) {
                results.push({ id: lead.id, verified: false, error: e.message });
            }
        }
        
        res.json({ 
            success: true, 
            results,
            verified: results.filter(r => r.verified).length,
            failed: results.filter(r => !r.verified).length
        });
        
    } catch (error) {
        console.error('Error bulk verifying WhatsApp:', error);
        res.status(500).json({ error: 'Failed to bulk verify WhatsApp' });
    }
});

// In-memory job tracker for verify-all
let verifyAllJob = null;

// Start verify ALL leads WhatsApp numbers
router.post('/api/admin/leads/verify-all-whatsapp', authenticateToken, async (req, res) => {
    if (verifyAllJob && verifyAllJob.status === 'running') {
        return res.status(409).json({ error: 'Job already running', job: verifyAllJob });
    }

    try {
        const leadsResult = await pool.query(
            `SELECT id, whatsapp FROM leads 
             WHERE whatsapp IS NOT NULL AND whatsapp != ''
             ORDER BY id ASC`
        );

        const totalLeads = leadsResult.rows.length;

        verifyAllJob = {
            status: 'running',
            total: totalLeads,
            processed: 0,
            verified: 0,
            invalid: 0,
            errors: 0,
            skipped: 0,
            percent: 0,
            startedAt: Date.now(),
            message: `Verificando ${totalLeads} leads...`
        };

        res.json({ success: true, job: verifyAllJob });

        // Run in background
        (async () => {
            for (const lead of leadsResult.rows) {
                let phone = lead.whatsapp || '';
                if (!phone || phone.replace(/\D/g, '').length < 10) {
                    verifyAllJob.skipped++;
                    verifyAllJob.processed++;
                    verifyAllJob.percent = Math.round((verifyAllJob.processed / totalLeads) * 100);
                    continue;
                }

                phone = phone.replace(/\D/g, '');

                try {
                    const profilePicture = await zapiProfilePicture(phone);
                    const isRegistered = !!profilePicture;

                    await pool.query(`
                        UPDATE leads SET 
                            whatsapp_verified = $1,
                            whatsapp_verified_at = NOW(),
                            whatsapp_profile_pic = COALESCE($2, whatsapp_profile_pic),
                            updated_at = NOW()
                        WHERE id = $3
                    `, [isRegistered, profilePicture, lead.id]);

                    if (isRegistered) verifyAllJob.verified++;
                    else verifyAllJob.invalid++;

                } catch (e) {
                    verifyAllJob.errors++;
                    console.log(`📱 Verify-all error for lead #${lead.id}: ${e.message}`);
                }

                verifyAllJob.processed++;
                verifyAllJob.percent = Math.round((verifyAllJob.processed / totalLeads) * 100);

                if (verifyAllJob.processed % 10 === 0) {
                    console.log(`📱 Verify-all progress: ${verifyAllJob.processed}/${totalLeads} (${verifyAllJob.percent}%) - ✓${verifyAllJob.verified} ✕${verifyAllJob.invalid} ⚠${verifyAllJob.errors}`);
                }

                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            verifyAllJob.status = 'complete';
            verifyAllJob.message = `Concluído! ${verifyAllJob.verified} válidos, ${verifyAllJob.invalid} inválidos, ${verifyAllJob.errors} erros, ${verifyAllJob.skipped} ignorados`;
            verifyAllJob.completedAt = Date.now();
            console.log(`📱 Verify-all COMPLETE: ${verifyAllJob.message}`);
        })().catch(err => {
            verifyAllJob.status = 'error';
            verifyAllJob.message = err.message;
            console.error('📱 Verify-all FAILED:', err);
        });

    } catch (error) {
        console.error('Error starting verify-all:', error);
        res.status(500).json({ error: error.message });
    }
});

// Poll verify-all job status
router.get('/api/admin/leads/verify-all-status', authenticateToken, (req, res) => {
    if (!verifyAllJob) {
        return res.json({ status: 'idle', message: 'Nenhum job em andamento' });
    }
    res.json(verifyAllJob);
});

// ==================== LEAD CRUD ====================

// Get single lead by ID (protected)
router.get('/api/admin/leads/:id(\\d+)', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching lead:', error);
        res.status(500).json({ error: 'Failed to fetch lead' });
    }
});

// Update lead status (protected)
router.put('/api/admin/leads/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        
        const result = await pool.query(
            `UPDATE leads SET status = $1, notes = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
            [status, notes, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        
        res.json({ success: true, lead: result.rows[0] });
        
    } catch (error) {
        console.error('Error updating lead:', error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

// Delete lead (protected)
router.delete('/api/admin/leads/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING id', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        
        res.json({ success: true, message: 'Lead deleted' });
        
    } catch (error) {
        console.error('Error deleting lead:', error);
        res.status(500).json({ error: 'Failed to delete lead' });
    }
});

// ==================== DATA MANAGEMENT ====================

// Clear all test data (protected) - USE WITH CAUTION
router.delete('/api/admin/clear-all-data', authenticateToken, async (req, res) => {
    try {
        const { confirm } = req.query;
        
        if (confirm !== 'yes-delete-everything') {
            return res.status(400).json({ 
                error: 'Confirmation required', 
                message: 'Add ?confirm=yes-delete-everything to confirm deletion' 
            });
        }
        
        // Delete all data from tables
        const leadsResult = await pool.query('DELETE FROM leads RETURNING id');
        const eventsResult = await pool.query('DELETE FROM funnel_events RETURNING id');
        const transactionsResult = await pool.query('DELETE FROM transactions RETURNING id');
        const refundsResult = await pool.query('DELETE FROM refund_requests RETURNING id');
        
        console.log('⚠️ ALL DATA CLEARED BY ADMIN');
        
        res.json({ 
            success: true, 
            message: 'All data cleared',
            deleted: {
                leads: leadsResult.rowCount,
                funnel_events: eventsResult.rowCount,
                transactions: transactionsResult.rowCount,
                refund_requests: refundsResult.rowCount
            }
        });
        
    } catch (error) {
        console.error('Error clearing data:', error);
        res.status(500).json({ error: 'Failed to clear data' });
    }
});

// Enrich geolocation data for existing leads (protected)
router.post('/api/admin/enrich-geolocation', authenticateToken, async (req, res) => {
    try {
        // Get all leads with IP but without country data
        const leadsToEnrich = await pool.query(
            `SELECT id, ip_address FROM leads 
             WHERE ip_address IS NOT NULL 
             AND ip_address != '' 
             AND (country IS NULL OR country = '' OR country_code IS NULL OR country_code = 'XX' OR country_code = '')
             LIMIT 50`
        );
        
        if (leadsToEnrich.rows.length === 0) {
            return res.json({ 
                success: true, 
                message: 'No leads need geolocation enrichment',
                enriched: 0,
                remaining: 0
            });
        }
        
        console.log(`Enriching geolocation for ${leadsToEnrich.rows.length} leads...`);
        
        let enrichedCount = 0;
        let errors = 0;
        
        // Process each lead (with delay to avoid rate limiting)
        for (const lead of leadsToEnrich.rows) {
            try {
                const geoData = await getCountryFromIP(lead.ip_address);
                
                if (geoData.country && geoData.country_code) {
                    await pool.query(
                        `UPDATE leads SET 
                            country = $1, 
                            country_code = $2, 
                            city = $3, 
                            updated_at = NOW() 
                         WHERE id = $4`,
                        [geoData.country, geoData.country_code, geoData.city, lead.id]
                    );
                    enrichedCount++;
                    console.log(`Enriched lead ${lead.id}: ${geoData.country} (${geoData.country_code})`);
                } else {
                    console.log(`Could not get geo data for lead ${lead.id} (IP: ${lead.ip_address})`);
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (err) {
                console.error(`Error enriching lead ${lead.id}:`, err.message);
                errors++;
            }
        }
        
        // Count remaining leads needing enrichment
        const remainingResult = await pool.query(
            `SELECT COUNT(*) as count FROM leads 
             WHERE ip_address IS NOT NULL 
             AND ip_address != '' 
             AND (country IS NULL OR country = '' OR country_code IS NULL OR country_code = 'XX' OR country_code = '')`
        );
        
        res.json({ 
            success: true, 
            message: `Enriched ${enrichedCount} leads`,
            enriched: enrichedCount,
            errors: errors,
            remaining: parseInt(remainingResult.rows[0].count)
        });
        
    } catch (error) {
        console.error('Error enriching geolocation:', error);
        res.status(500).json({ error: 'Failed to enrich geolocation data' });
    }
});

// ==================== TRANSACTIONS MANAGEMENT ====================

// Manually add a transaction (for when postback didn't arrive)
router.post('/api/admin/transactions/manual', authenticateToken, async (req, res) => {
    try {
        const { transaction_id, email, phone, name, product, value, status, funnel_language } = req.body;
        
        if (!transaction_id || !email || !product || !value) {
            return res.status(400).json({ error: 'transaction_id, email, product, and value are required' });
        }
        
        // Insert transaction
        await pool.query(`
            INSERT INTO transactions (
                transaction_id, email, phone, name, product, value, 
                monetizze_status, status, funnel_language, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, '2', $7, $8, NOW())
            ON CONFLICT (transaction_id) 
            DO UPDATE SET 
                status = $7,
                funnel_language = $8,
                updated_at = NOW()
        `, [
            transaction_id,
            email,
            phone || null,
            name || null,
            product,
            value,
            status || 'approved',
            funnel_language || 'en'
        ]);
        
        // Try to update lead with full purchase info
        if (email) {
            const purchaseValue = parseFloat(value) || 0;
            const productIdentifier = product.substring(0, 50);
            
            await pool.query(`
                UPDATE leads SET 
                    status = 'converted',
                    products_purchased = CASE 
                        WHEN products_purchased IS NULL THEN ARRAY[$2]::TEXT[]
                        WHEN NOT ($2 = ANY(products_purchased)) THEN array_append(products_purchased, $2)
                        ELSE products_purchased
                    END,
                    total_spent = COALESCE(total_spent, 0) + $3,
                    first_purchase_at = CASE 
                        WHEN first_purchase_at IS NULL THEN NOW()
                        ELSE first_purchase_at
                    END,
                    last_purchase_at = NOW(),
                    updated_at = NOW()
                WHERE LOWER(email) = LOWER($1)
            `, [email, productIdentifier, purchaseValue]);
        }
        
        console.log(`✅ Manual transaction added: ${transaction_id} - ${product} - R$${value}`);
        
        res.json({ success: true, message: 'Transaction added successfully' });
    } catch (error) {
        console.error('Error adding manual transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clean test transactions (protected - admin only)
router.delete('/api/admin/transactions/test', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            DELETE FROM transactions 
            WHERE transaction_id LIKE 'TEST%' 
               OR transaction_id LIKE '%TEST%'
               OR email LIKE '%test%@%' 
               OR email LIKE '%@test.%'
               OR product LIKE '%TEST%'
               OR product = 'DELETE'
            RETURNING transaction_id, email, product
        `);
        
        console.log(`🗑️ Deleted ${result.rowCount} test transactions`);
        
        res.json({
            success: true,
            deleted: result.rowCount,
            transactions: result.rows
        });
        
    } catch (error) {
        console.error('Error deleting test transactions:', error);
        res.status(500).json({ error: 'Failed to delete test transactions' });
    }
});

// Delete ALL transactions (for reset and resync)
router.delete('/api/admin/transactions/all', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Count before delete
        const countResult = await pool.query('SELECT COUNT(*) FROM transactions');
        const count = parseInt(countResult.rows[0].count);
        
        // Delete all
        await pool.query('DELETE FROM transactions');
        
        console.log(`🗑️ Deleted ALL ${count} transactions for resync`);
        
        res.json({
            success: true,
            deleted: count,
            message: 'All transactions deleted. Ready for resync.'
        });
        
    } catch (error) {
        console.error('Error deleting all transactions:', error);
        res.status(500).json({ error: 'Failed to delete all transactions' });
    }
});

// Migrate existing transactions to set funnel_source based on product codes
router.post('/api/admin/transactions/migrate-source', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Affiliate product codes
        const affiliateProductCodes = [
            '330254', '341443', '341444', '341448',  // English Affiliates
            '338375', '341452', '341453', '341454'   // Spanish Affiliates
        ];
        
        // Update transactions that match affiliate product codes in raw_data
        let updated = 0;
        
        // Method 1: Check raw_data for produto.codigo
        for (const code of affiliateProductCodes) {
            const result = await pool.query(`
                UPDATE transactions 
                SET funnel_source = 'affiliate'
                WHERE funnel_source IS NULL OR funnel_source = 'main'
                AND raw_data::text LIKE $1
            `, [`%"codigo":"${code}"%`]);
            updated += result.rowCount;
            
            // Also try numeric format
            const result2 = await pool.query(`
                UPDATE transactions 
                SET funnel_source = 'affiliate'
                WHERE (funnel_source IS NULL OR funnel_source = 'main')
                AND raw_data::text LIKE $1
            `, [`%"codigo":${code}%`]);
            updated += result2.rowCount;
        }
        
        // Method 2: Fix funnel_language for transactions that had 'en-aff' or 'es-aff'
        const fixEnAff = await pool.query(`
            UPDATE transactions 
            SET funnel_language = 'en', funnel_source = 'affiliate'
            WHERE funnel_language = 'en-aff'
        `);
        const fixEsAff = await pool.query(`
            UPDATE transactions 
            SET funnel_language = 'es', funnel_source = 'affiliate'
            WHERE funnel_language = 'es-aff'
        `);
        updated += fixEnAff.rowCount + fixEsAff.rowCount;
        
        // Set remaining NULL funnel_source to 'main'
        const fixNull = await pool.query(`
            UPDATE transactions 
            SET funnel_source = 'main'
            WHERE funnel_source IS NULL
        `);
        
        console.log(`🔄 Migration complete: ${updated} transactions marked as affiliate, ${fixNull.rowCount} set to main`);
        
        res.json({
            success: true,
            affiliateUpdated: updated,
            mainUpdated: fixNull.rowCount,
            message: `Migration complete. ${updated} affiliate, ${fixNull.rowCount} main.`
        });
        
    } catch (error) {
        console.error('Error migrating transaction sources:', error);
        res.status(500).json({ error: 'Failed to migrate transaction sources' });
    }
});

// ==================== RECALCULATE & DIAGNOSTICS ====================

// Recalculate lead totals from transactions
router.post('/api/admin/leads/recalculate', authenticateToken, async (req, res) => {
    try {
        // Get all approved transactions grouped by email
        const transactionsResult = await pool.query(`
            SELECT 
                LOWER(email) as email,
                array_agg(DISTINCT product) as products,
                SUM(CAST(value AS DECIMAL)) as total_spent,
                MIN(created_at) as first_purchase,
                MAX(created_at) as last_purchase,
                COUNT(*) as purchase_count
            FROM transactions 
            WHERE status = 'approved' AND email IS NOT NULL
            GROUP BY LOWER(email)
        `);
        
        let updatedCount = 0;
        let createdCount = 0;
        
        for (const trans of transactionsResult.rows) {
            const result = await pool.query(`
                UPDATE leads SET 
                    status = 'converted',
                    products_purchased = $2,
                    total_spent = $3,
                    first_purchase_at = $4,
                    last_purchase_at = $5,
                    updated_at = NOW()
                WHERE LOWER(email) = $1
                RETURNING id
            `, [
                trans.email,
                trans.products,
                trans.total_spent || 0,
                trans.first_purchase,
                trans.last_purchase
            ]);
            
            if (result.rows.length > 0) {
                updatedCount++;
            } else {
                // No matching lead - create one from transaction data
                try {
                    // Get additional info from the transaction (name, phone, language, source)
                    const txInfo = await pool.query(`
                        SELECT name, phone, funnel_language, funnel_source 
                        FROM transactions 
                        WHERE LOWER(email) = $1 AND status = 'approved'
                        ORDER BY created_at DESC LIMIT 1
                    `, [trans.email]);
                    
                    const info = txInfo.rows[0] || {};
                    
                    await pool.query(`
                        INSERT INTO leads (email, name, whatsapp, status, funnel_language, funnel_source,
                            products_purchased, total_spent, first_purchase_at, last_purchase_at,
                            created_at, updated_at)
                        VALUES (LOWER($1), $2, $3, 'converted', $4, $5,
                            $6, $7, $8, $9, $8, NOW())
                    `, [
                        trans.email,
                        info.name || '',
                        info.phone || '',
                        info.funnel_language || 'en',
                        info.funnel_source || 'main',
                        trans.products,
                        trans.total_spent || 0,
                        trans.first_purchase,
                        trans.last_purchase
                    ]);
                    createdCount++;
                } catch (insertErr) {
                    console.error(`⚠️ Error creating lead for ${trans.email}: ${insertErr.message}`);
                }
            }
        }
        
        res.json({ 
            success: true, 
            message: `Recalculated ${updatedCount} leads, created ${createdCount} new leads from ${transactionsResult.rows.length} buyer emails`,
            updated: updatedCount,
            created: createdCount,
            totalBuyers: transactionsResult.rows.length
        });
        
    } catch (error) {
        console.error('Error recalculating leads:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test geolocation API with a known IP
router.get('/api/admin/test-geolocation', authenticateToken, async (req, res) => {
    try {
        const testIP = req.query.ip || '8.8.8.8'; // Google DNS as test
        console.log('Testing geolocation with IP:', testIP);
        
        const geoData = await getCountryFromIP(testIP);
        
        res.json({
            success: true,
            test_ip: testIP,
            result: geoData,
            api_provider: 'ip-api.com (free, no key required)'
        });
    } catch (error) {
        console.error('Test geolocation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to check leads geo status
router.get('/api/admin/leads/geo-debug', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, email, ip_address, country, country_code, city 
            FROM leads 
            ORDER BY created_at DESC 
            LIMIT 20
        `);
        
        const summary = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN ip_address IS NOT NULL AND ip_address != '' THEN 1 END) as with_ip,
                COUNT(CASE WHEN country IS NOT NULL AND country != '' THEN 1 END) as with_country,
                COUNT(CASE WHEN country_code IS NOT NULL AND country_code != '' AND country_code != 'XX' THEN 1 END) as with_valid_country_code
            FROM leads
        `);
        
        res.json({
            summary: summary.rows[0],
            sample_leads: result.rows.map(l => ({
                id: l.id,
                email: l.email ? l.email.substring(0, 10) + '...' : null,
                ip: l.ip_address,
                country: l.country,
                country_code: l.country_code,
                city: l.city
            }))
        });
    } catch (error) {
        console.error('Geo debug error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export leads as CSV (protected)
router.get('/api/admin/leads/export', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
        
        // Create CSV
        const headers = ['ID', 'Name', 'Email', 'WhatsApp', 'Target Phone', 'Gender', 'Status', 'IP', 'Created At'];
        const rows = result.rows.map(lead => [
            lead.id,
            (lead.name || '').replace(/,/g, ' '),
            lead.email,
            lead.whatsapp,
            lead.target_phone || '',
            lead.target_gender || '',
            lead.status || 'new',
            lead.ip_address || '',
            lead.created_at
        ]);
        
        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=leads-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
        
    } catch (error) {
        console.error('Error exporting leads:', error);
        res.status(500).json({ error: 'Failed to export leads' });
    }
});

// ==================== ADMIN PANEL ====================

// Serve admin panel (no-cache to always get latest version)
router.get('/admin', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin.html'));
});
router.get('/admin.html', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin.html'));
});

module.exports = router;
