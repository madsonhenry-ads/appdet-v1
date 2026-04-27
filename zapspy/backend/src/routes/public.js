const express = require('express');
const util = require('util');
const router = express.Router();
const pool = require('../database');
const { authenticateToken, requireAdmin, leadLimiter, apiLimiter, invalidateCache } = require('../middleware');
const { sendToFacebookCAPI, hashData, sendMissingCAPIPurchases, backfillTransactionFbcFbp } = require('../services/facebook-capi');
const { sendMissingGoogleAdsPurchases } = require('../services/google-ads-conversion');
const { getCountryFromIP, getDetailedGeoFromIP, generateSuspiciousLocations } = require('../services/geolocation');
const { zapiProfilePicture } = require('../services/zapi');
const { enrichWhatsappProfileFromRapid } = require('../services/whatsapp-data-rapid');
const activeCampaign = require('../services/activecampaign');

const WHATSAPP_CHECK_LOG_WIDTH = 76;

function _truncateUrl(str, max) {
    if (str == null || typeof str !== 'string') return str;
    return str.length <= max ? str : `${str.slice(0, max - 1)}…`;
}

/**
 * Log legível no terminal: resumo + JSON indentado igual ao enviado ao cliente.
 */
function logWhatsAppCheckReport({
    phone,
    hasRapidKey,
    settled,
    pictureZapi,
    picture,
    name,
    rapidResult,
    responsePayload
}) {
    const sep = '─'.repeat(WHATSAPP_CHECK_LOG_WIDTH);
    const pad = '  ';
    const rdiag = rapidResult?.diag?.rapid;
    const lines = [
        '',
        sep,
        `│ WhatsAppCheck  phone=${phone}  at=${new Date().toISOString()}`,
        sep,
        `${pad}■ Ambiente`,
        `${pad}  · RAPIDAPI_KEY:  ${hasRapidKey ? 'OK' : 'AUSENTE'}`,
        `${pad}  · aguarde até ~35s no cliente (Z-API + Rapid em paralelo)`,
        sep,
        `${pad}■ Z-API (foto de perfil)`,
        `${pad}  · estado:     ${settled[0].status === 'fulfilled' ? 'fulfilled' : 'rejected'}`,
        `${pad}  · url Z-API:  ${_truncateUrl(pictureZapi || '(null)', 100)}`
    ];
    if (settled[0].status === 'rejected') {
        lines.push(`${pad}  · erro:       ${settled[0].reason?.message || settled[0].reason}`);
    }
    lines.push(`${pad}■ RapidAPI (whatsapp-data1)`);
    lines.push(`${pad}  · estado:     ${settled[1].status === 'fulfilled' ? 'fulfilled' : 'rejected'}`);
    if (rdiag) {
        lines.push(`${pad}  · http:       ${rdiag.httpStatus ?? 'n/a'}  |  ${rdiag.durationMs ?? '?'} ms`);
        lines.push(`${pad}  · erro API:   ${rdiag.error || 'nenhum'}`);
        lines.push(
            `${pad}  · leakCheck:  presente=${rdiag.leakCheckProPresent}  success=${rdiag.leakSuccess}  found=${rdiag.leakFound}  rows=${rdiag.leakResultCount}`
        );
        lines.push(`${pad}  · nome ok:    ${rdiag.nameExtracted === true}`);
        if (rdiag.firstLeakRowKeys?.length) {
            lines.push(`${pad}  · chaves[0]:  ${rdiag.firstLeakRowKeys.join(', ')}`);
        }
        if (rdiag.topLevelKeys?.length) {
            lines.push(`${pad}  · keys JSON:  ${rdiag.topLevelKeys.join(', ')}`);
        }
    }
    if (settled[1].status === 'rejected') {
        lines.push(`${pad}  · enrich err: ${rapidResult?.diag?.rapid?.error || settled[1].reason}`);
    }
    lines.push(`${pad}■ Resposta agregada (foto final + nome)`);
    lines.push(`${pad}  · foto:       ${_truncateUrl(picture || '(nenhuma)', 100)}`);
    lines.push(`${pad}  · fallback:   ${picture && !pictureZapi && rapidResult?.fallbackImage ? 'Rapid' : pictureZapi ? 'Z-API' : picture ? 'Rapid' : '—'}`);
    lines.push(`${pad}  · nome:       ${name != null && String(name).trim() ? JSON.stringify(name) : '(vazio)'}`);
    lines.push(sep);
    lines.push(`${pad}■ JSON enviado ao cliente (idem res.json):`);
    const jsonBody = JSON.stringify(responsePayload, null, 2)
        .split('\n')
        .map((l) => `${pad}${l}`)
        .join('\n');
    lines.push(jsonBody);
    lines.push(sep);
    const debugFull =
        process.env.WHATSAPP_CHECK_DEBUG === '1' || process.env.WHATSAPP_CHECK_DEBUG === 'true';
    lines.push(
        `${pad}■ Diagnóstico interno (rapid.diag)${debugFull ? '' : ' — defina WHATSAPP_CHECK_DEBUG=1 para mais profundidade'}`
    );
    try {
        const inspected = util.inspect(rapidResult?.diag ?? {}, {
            colors: true,
            depth: debugFull ? 12 : 4,
            maxArrayLength: debugFull ? 24 : 6,
            maxStringLength: debugFull ? 800 : 200,
            breakLength: 72
        });
        lines.push(
            inspected
                .split('\n')
                .map((l) => `${pad}${l}`)
                .join('\n')
        );
    } catch (e) {
        lines.push(`${pad}(inspect falhou: ${e.message})`);
    }
    lines.push(sep, '');
    console.log(lines.join('\n'));
}

// ==================== PUBLIC API ROUTES ====================

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/api/geo', apiLimiter, async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    try {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip']
            || req.connection?.remoteAddress
            || req.ip;
        const lang = req.query.lang || 'en';

        const geo = await getDetailedGeoFromIP(ip);
        if (!geo || !geo.city) {
            return res.json({ success: false, message: 'Could not determine location' });
        }

        const locations = generateSuspiciousLocations(geo.city, geo.state, lang);
        const ua = req.headers['user-agent'] || '';
        let device = 'Unknown Device';
        if (/iPhone/.test(ua)) device = ua.match(/iPhone[^;)]*/)?.[0] || 'iPhone';
        else if (/iPad/.test(ua)) device = 'iPad';
        else if (/Android/.test(ua)) {
            const m = ua.match(/Android[^;]*;\s*([^)]+)\)/);
            device = m ? m[1].trim() : 'Android Device';
        } else if (/Mac OS X/.test(ua)) device = 'Mac';
        else if (/Windows/.test(ua)) device = 'Windows PC';
        else if (/Linux/.test(ua)) device = 'Linux PC';

        let browser = 'Unknown Browser';
        if (/CriOS|Chrome/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
        else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
        else if (/Firefox|FxiOS/.test(ua)) browser = 'Firefox';
        else if (/Edg/.test(ua)) browser = 'Edge';
        else if (/OPR|Opera/.test(ua)) browser = 'Opera';

        res.json({
            success: true,
            city: geo.city,
            state: geo.state,
            country: geo.country,
            country_code: geo.country_code,
            latitude: geo.latitude,
            longitude: geo.longitude,
            device,
            browser,
            locations
        });
    } catch (error) {
        console.error('Geo endpoint error:', error.message);
        res.json({ success: false, message: 'Error fetching geolocation' });
    }
});

router.get('/api/whatsapp-check/:phone', apiLimiter, async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    try {
        const phone = req.params.phone.replace(/\D/g, '');
        if (!phone || phone.length < 8) {
            return res.json({ registered: true, picture: null, name: null });
        }

        const hasRapidKey = Boolean(process.env.RAPIDAPI_KEY);

        const settled = await Promise.allSettled([
            zapiProfilePicture(phone),
            enrichWhatsappProfileFromRapid(phone)
        ]);

        const pictureZapi = settled[0].status === 'fulfilled' ? settled[0].value : null;

        const emptyOsint = { breachesCount: 0, telegramFound: false, telegramUsername: null, reverseImageMatches: 0, aboutHistory: [], location: null, countryCode: null, businessCategory: null, googleResultsCount: 0, aiReportSummary: null, carrier: null, riskLevel: null };
        const rapidResult =
            settled[1].status === 'fulfilled'
                ? settled[1].value
                : {
                      name: null,
                      fallbackImage: null,
                      about: null,
                      isBusiness: false,
                      face: null,
                      osint: emptyOsint,
                      diag: {
                          rapid: {
                              attempted: true,
                              skippedReason: 'enrich_rejected',
                              error: String(settled[1].reason?.message || settled[1].reason),
                              leakResultCount: 0,
                              nameExtracted: false
                          }
                      }
                  };

        const picture = pictureZapi || rapidResult.fallbackImage || null;
        const name = rapidResult.name || null;

        const responsePayload = {
            registered: true, picture, name,
            about: rapidResult.about || null,
            isBusiness: rapidResult.isBusiness || false,
            face: rapidResult.face || null,
            osint: rapidResult.osint || emptyOsint
        };
        if (process.env.WHATSAPP_CHECK_DEBUG === '1' || process.env.WHATSAPP_CHECK_DEBUG === 'true' || req.query.debug === '1') {
            responsePayload._debug = rapidResult.diag;
            responsePayload._rapidFull = process.env.WHATSAPP_DATA_RAPID_FULL || 'not_set';
        }

        logWhatsAppCheckReport({
            phone,
            hasRapidKey,
            settled,
            pictureZapi,
            picture,
            name,
            rapidResult,
            responsePayload
        });

        const checkIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
        const rdiag = rapidResult?.diag?.rapid;
        const pictureSource = picture ? (pictureZapi ? 'zapi' : 'rapid') : 'none';
        const rapidAttempted = rdiag?.attempted || false;
        const rapidFoundImg = !!rapidResult?.fallbackImage;
        const rapidErr = rdiag?.error || null;
        const rapidDur = rdiag?.durationMs || null;
        pool.query(
            `INSERT INTO whatsapp_check_logs (phone, has_picture, picture_url, ip_address, picture_source, zapi_found, rapid_attempted, rapid_found, rapid_error, rapid_duration_ms) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [phone, !!picture, picture || null, checkIp, pictureSource, !!pictureZapi, rapidAttempted, rapidFoundImg, rapidErr, rapidDur]
        ).catch(() => {});

        res.json(responsePayload);
    } catch (e) {
        console.log(`📱 WhatsApp check error:`, e.message);
        res.json({ registered: true, picture: null, name: null });
    }
});

router.get('/api/capi/status', authenticateToken, async (req, res) => {
    try {
        // Get recent transaction counts
        const last24h = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded
            FROM transactions 
            WHERE created_at > NOW() - INTERVAL '24 hours'
        `);
        
        // Get recent postback logs count
        const postbackLogs = await pool.query(`
            SELECT COUNT(*) as count 
            FROM postback_logs 
            WHERE created_at > NOW() - INTERVAL '24 hours'
        `);
        
        // Get last 5 transactions (limited info)
        const recentTx = await pool.query(`
            SELECT 
                status, 
                funnel_language,
                created_at,
                CASE WHEN CAST(value AS NUMERIC) > 0 THEN 'has_value' ELSE 'no_value' END as value_status
            FROM transactions 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            last24h: {
                totalTransactions: parseInt(last24h.rows[0]?.total || 0),
                approved: parseInt(last24h.rows[0]?.approved || 0),
                pending: parseInt(last24h.rows[0]?.pending || 0),
                refunded: parseInt(last24h.rows[0]?.refunded || 0)
            },
            postbacksReceived24h: parseInt(postbackLogs.rows[0]?.count || 0),
            recentTransactions: recentTx.rows,
            capiEndpoint: '/api/capi/event',
            postbackEndpoint: '/api/postback/monetizze',
            perfectpayWebhookEndpoint: '/api/postback/perfectpay'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/health/db', authenticateToken, (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied. Admin only.' });
    next();
}, async (req, res) => {
    try {
        const leadsCount = await pool.query('SELECT COUNT(*) FROM leads');
        const transactionsCount = await pool.query('SELECT COUNT(*) FROM transactions');
        const eventsCount = await pool.query('SELECT COUNT(*) FROM funnel_events');
        
        res.json({
            status: 'ok',
            database: 'connected',
            counts: {
                leads: parseInt(leadsCount.rows[0].count),
                transactions: parseInt(transactionsCount.rows[0].count),
                funnel_events: parseInt(eventsCount.rows[0].count)
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Root route - serves HTML with Facebook domain verification meta tag
router.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html><head>
<meta name="facebook-domain-verification" content="88bg7nb3af9s66oo1b7oekmo287t2i" />
<meta name="facebook-domain-verification" content="mmgxqvywkcn38obhqg1g5j1cj3g7d8" />
<title>Whats Spy</title>
</head><body>
<h1>Whats Spy API</h1>
<p>Status: running</p>
<p><a href="/admin.html">Admin Panel</a></p>
</body></html>`);
});

// Capture lead (from frontend form)
router.post('/api/leads', leadLimiter, async (req, res) => {
    try {
        const {
            name,
            email,
            whatsapp,
            targetPhone,
            targetGender,
            city: frontendCity,              // City from frontend geo detection
            country_code: frontendCountryCode, // Country code from frontend
            state: frontendState,            // State/province from frontend geo detection
            pageUrl,                         // Actual page URL for eventSourceUrl
            referrer,
            userAgent,
            fbc,  // Facebook click ID (from URL param or cookie)
            fbp,  // Facebook browser ID (from cookie)
            funnelLanguage,  // 'en' or 'es' - funnel language for pixel selection
            visitorId,  // Funnel visitor ID for journey tracking
            funnelSource,  // 'main' or 'affiliate' - source of the lead
            gclid,  // Google Ads click ID for conversion attribution
            // UTM parameters for campaign tracking
            utm_source,
            utm_medium,
            utm_campaign,
            utm_content,
            utm_term,
            // A/B test tracking
            ab_test_id,
            ab_variant
        } = req.body;
        
        // Validation
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        // Get IP address
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
        const ua = userAgent || req.headers['user-agent'];
        
        // Determine language (default to 'en' for backward compatibility)
        const language = funnelLanguage || 'en';
        
        // Determine source (default to 'main' for backward compatibility)
        const source = funnelSource || 'main';
        
        // Get country from IP (non-blocking), but prefer frontend-provided values
        const ipGeoData = await getCountryFromIP(ipAddress);
        const geoData = {
            country: ipGeoData.country,
            country_code: frontendCountryCode || ipGeoData.country_code,
            city: frontendCity || ipGeoData.city,
            state: frontendState || ipGeoData.state
        };
        
        // Check if lead already exists (by email or whatsapp)
        const existingLead = await pool.queryRetry(
            `SELECT id, email, whatsapp, visit_count FROM leads WHERE LOWER(email) = LOWER($1)${whatsapp ? ' OR whatsapp = $2' : ''} LIMIT 1`,
            whatsapp ? [email, whatsapp] : [email]
        );
        
        let result;
        let isNewLead = false;
        
        if (existingLead.rows.length > 0) {
            // Update existing lead with new visit info
            const currentVisitCount = existingLead.rows[0].visit_count || 1;
            result = await pool.queryRetry(
                `UPDATE leads SET 
                    name = COALESCE($1, name),
                    target_phone = COALESCE($2, target_phone),
                    target_gender = COALESCE($3, target_gender),
                    ip_address = $4,
                    referrer = $5,
                    user_agent = $6,
                    visit_count = $7,
                    country = COALESCE($8, country),
                    country_code = COALESCE($9, country_code),
                    city = COALESCE($10, city),
                    visitor_id = COALESCE($11, visitor_id),
                    funnel_source = COALESCE($12, funnel_source),
                    utm_source = COALESCE($14, utm_source),
                    utm_medium = COALESCE($15, utm_medium),
                    utm_campaign = COALESCE($16, utm_campaign),
                    utm_content = COALESCE($17, utm_content),
                    utm_term = COALESCE($18, utm_term),
                    fbc = COALESCE($19, fbc),
                    fbp = COALESCE($20, fbp),
                    state = COALESCE($21, state),
                    ab_test_id = COALESCE($22, ab_test_id),
                    ab_variant = COALESCE($23, ab_variant),
                    gclid = COALESCE($24, gclid),
                    last_visit_at = NOW(),
                    updated_at = NOW()
                WHERE id = $13
                RETURNING id, created_at`,
                [name || null, targetPhone || null, targetGender || null, ipAddress, referrer || null, ua || null, currentVisitCount + 1, geoData.country, geoData.country_code, geoData.city, visitorId || null, source, existingLead.rows[0].id, utm_source || null, utm_medium || null, utm_campaign || null, utm_content || null, utm_term || null, fbc || null, fbp || null, geoData.state || null, ab_test_id || null, ab_variant || null, gclid || null]
            );
            console.log(`Returning lead [${language.toUpperCase()}/${source}]: ${name || 'No name'} - ${email} - ${geoData.country || 'Unknown'} (visit #${currentVisitCount + 1})`);
        } else {
            // Insert new lead
            result = await pool.queryRetry(
                `INSERT INTO leads (name, email, whatsapp, target_phone, target_gender, ip_address, referrer, user_agent, funnel_language, funnel_source, visit_count, country, country_code, city, state, visitor_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbc, fbp, ab_test_id, ab_variant, gclid, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW())
                 RETURNING id, created_at`,
                [name || null, email, whatsapp, targetPhone || null, targetGender || null, ipAddress, referrer || null, ua || null, language, source, geoData.country, geoData.country_code, geoData.city, geoData.state || null, visitorId || null, utm_source || null, utm_medium || null, utm_campaign || null, utm_content || null, utm_term || null, fbc || null, fbp || null, ab_test_id || null, ab_variant || null, gclid || null]
            );
            isNewLead = true;
            console.log(`New lead captured [${language.toUpperCase()}/${source}]: ${name || 'No name'} - ${email} - ${whatsapp} - ${geoData.country || 'Unknown'}${utm_source ? ` [UTM: ${utm_source}]` : ''}`);
        }
        
        // NOTE: Lead CAPI event is already sent by the frontend (FacebookCAPI.trackEvent('Lead'))
        // with proper eventID for deduplication. Sending another here with null eventID would cause duplicates.
        // The /api/leads endpoint only stores the lead data now.
        console.log(`📊 Lead stored. CAPI Lead event handled by frontend with deduplication.`);
        
        // Invalidate relevant caches
        invalidateCache('trends');
        invalidateCache('traffic-sources');
        
        // Auto-verify removed to protect WhatsApp from bans (too many Z-API calls)
        
        // ==================== ACTIVECAMPAIGN: Lead Captured ====================
        // Send lead to ActiveCampaign (async, non-blocking)
        if (isNewLead) {
            setImmediate(async () => {
                try {
                    await activeCampaign.processEvent('lead_captured', language, {
                        email,
                        name: name || '',
                        phone: whatsapp || '',
                        targetPhone: targetPhone || '',
                        whatsapp: whatsapp || ''
                    });
                } catch (acError) {
                    console.error('ActiveCampaign lead_captured error (non-blocking):', acError.message);
                }
            });
        }

        res.status(201).json({
            success: true,
            message: 'Lead captured successfully',
            id: result.rows[0].id,
            language: language
        });
        
    } catch (error) {
        console.error('Error capturing lead:', error);
        res.status(500).json({ error: 'Failed to capture lead' });
    }
});

// ==================== FACEBOOK CAPI ENDPOINT ====================

// Test CAPI events - use this endpoint to verify events in Facebook Events Manager
// Test codes: EN = TEST23104, ES = TEST96875
router.post('/api/capi/test', async (req, res) => {
    try {
        const { language, eventName } = req.body;
        
        // Test event codes from Facebook Events Manager
        const testCodes = {
            'en': 'TEST23104',
            'es': 'TEST96875'
        };
        
        const lang = language || 'en';
        const testCode = testCodes[lang];
        const event = eventName || 'PageView';
        
        if (!testCode) {
            return res.status(400).json({ error: 'Invalid language. Use "en" or "es"' });
        }
        
        // Get IP and User Agent from request
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
        const userAgent = req.headers['user-agent'];
        
        // Build test user data
        const userData = {
            email: 'test@example.com',
            phone: '+5511999999999',
            firstName: 'Test User',
            ip: ipAddress,
            userAgent,
            externalId: 'test_visitor_' + Date.now()
        };
        
        // Build test custom data
        const customData = {
            value: lang === 'es' ? 27.00 : 37.00,
            currency: 'USD',
            content_name: 'Test Event',
            content_category: 'test'
        };
        
        // Send with test_event_code
        const results = await sendToFacebookCAPI(
            event, 
            userData, 
            customData, 
            `https://${lang === 'es' ? 'espanhol' : 'ingles'}.zappdetect.com/landing.html`,
            `test_${Date.now()}`,
            { 
                language: lang,
                testEventCode: testCode  // This enables test mode
            }
        );
        
        res.json({ 
            success: true, 
            message: `Test event ${event} sent to ${lang.toUpperCase()} pixel`,
            testCode: testCode,
            language: lang,
            results,
            instructions: 'Check Facebook Events Manager > "Eventos de teste" tab to see this event'
        });
        
    } catch (error) {
        console.error('CAPI test error:', error);
        res.status(500).json({ error: 'Failed to send test event', details: error.message });
    }
});

// Send event to Facebook CAPI (from frontend)
// Also available at /api/t/e to bypass ad blockers
const capiHandler = async (req, res) => {
    try {
        const {
            eventName,
            eventId,           // For deduplication with browser pixel
            externalId,        // Visitor ID for cross-device tracking
            email,
            phone,
            firstName,
            lastName,
            country,           // Country code (2-letter ISO) for better match quality
            city,              // City name for better match quality
            state,             // State/province for better match quality
            gender,            // Gender (m/f) for better match quality
            value,
            currency,
            contentName,
            contentIds,
            contentType,
            contentCategory,
            numItems,
            fbc,
            fbp,
            eventSourceUrl,
            // Language and custom pixel support for multi-language funnels
            funnelLanguage,    // 'en' or 'es'
            pixelIds,          // Array of custom pixel IDs (from frontend)
            accessToken        // Custom access token (from frontend)
        } = req.body;
        
        if (!eventName) {
            return res.status(400).json({ error: 'eventName is required' });
        }
        
        // Get IP and User Agent from request
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
        const userAgent = req.headers['user-agent'];
        
        // Build user data (including geo data for better match quality)
        const userData = {
            email,
            phone,
            firstName,
            lastName,
            country,           // Country code for CAPI matching
            city,              // City for CAPI matching
            state,             // State/province for CAPI matching
            gender,            // Gender for CAPI matching
            externalId,        // For cross-device tracking
            ip: ipAddress,
            userAgent,
            fbc,
            fbp
        };
        
        // Build custom data
        const customData = {};
        if (value !== undefined) customData.value = parseFloat(value);
        if (currency) customData.currency = currency;
        if (contentName) customData.content_name = contentName;
        if (contentIds) customData.content_ids = Array.isArray(contentIds) ? contentIds : [contentIds];
        if (contentType) customData.content_type = contentType;
        if (contentCategory) customData.content_category = contentCategory;
        if (numItems) customData.num_items = parseInt(numItems);
        
        // Options for pixel selection
        const options = {
            language: funnelLanguage || 'en',
            pixelIds: pixelIds,
            accessToken: accessToken
        };
        
        // Send to Facebook CAPI with eventId for deduplication
        const results = await sendToFacebookCAPI(eventName, userData, customData, eventSourceUrl, eventId, options);
        
        // Log to capi_event_logs (fire-and-forget)
        const fbSuccess = results && results.length > 0 && results.some(r => r.success);
        const fbReceived = results ? results.reduce((sum, r) => sum + (r.events_received || 0), 0) : 0;
        pool.query(
            `INSERT INTO capi_event_logs (event_name, event_id, content_name, funnel_language, ip_address, user_agent, fb_success, fb_events_received, fbc, fbp, visitor_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [eventName, eventId || null, contentName || null, funnelLanguage || 'en', ipAddress, (userAgent || '').substring(0, 500), fbSuccess, fbReceived, fbc || null, fbp || null, externalId || null]
        ).catch(() => {});

        res.json({ 
            success: true, 
            message: `Event ${eventName} sent to CAPI`,
            eventId: eventId || results[0]?.eventId,
            language: options.language,
            results 
        });
        
    } catch (error) {
        console.error('CAPI endpoint error:', error);
        res.status(500).json({ error: 'Failed to send event' });
    }
};

router.post('/api/capi/event', capiHandler);
router.post('/api/t/e', capiHandler);

// ==================== FUNNEL TRACKING API ====================

// Track funnel event (public - no auth required)
router.post('/api/track', async (req, res) => {
    try {
        const {
            visitorId,
            event,
            page,
            targetPhone,
            targetGender,
            funnelLanguage,  // 'en' or 'es'
            funnelSource,    // 'main' or 'affiliate'
            fbc,             // Facebook Click ID (for CAPI attribution)
            fbp,             // Facebook Browser ID (for CAPI attribution)
            ab_test_id,      // A/B test ID (from URL splitter)
            ab_variant,      // A/B variant (A or B)
            metadata
        } = req.body;
        
        if (!visitorId || !event) {
            return res.status(400).json({ error: 'visitorId and event are required' });
        }
        
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
        const userAgent = req.headers['user-agent'] || null;
        const language = funnelLanguage || 'en';
        const source = funnelSource || 'main';
        
        // Add language and source to metadata
        const enrichedMetadata = {
            ...(metadata || {}),
            funnelLanguage: language,
            funnelSource: source
        };
        
        await pool.queryRetry(
            `INSERT INTO funnel_events (visitor_id, event, page, target_phone, target_gender, ip_address, user_agent, fbc, fbp, ab_test_id, ab_variant, metadata, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
            [visitorId, event, page || null, targetPhone || null, targetGender || null, ipAddress, userAgent, fbc || null, fbp || null, ab_test_id || null, ab_variant || null, JSON.stringify(enrichedMetadata)]
        );
        
        res.json({ success: true, language });
        
    } catch (error) {
        console.error('Error tracking event:', error);
        res.status(500).json({ error: 'Failed to track event' });
    }
});

router.post('/api/admin/capi-catchup', authenticateToken, requireAdmin, async (req, res) => {
    try {
        console.log('🔄 Manual CAPI + Google Ads catch-up triggered by admin...');
        await sendMissingCAPIPurchases();
        await sendMissingGoogleAdsPurchases();
        res.json({ success: true, message: 'CAPI + Google Ads catch-up executado. Verifique os logs de Purchase.' });
    } catch (error) {
        console.error('CAPI catch-up error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/api/enrich-purchase', async (req, res) => {
    try {
        const { email, fbc, fbp, gclid, visitorId, ip, userAgent } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, error: 'email required' });
        }
        
        if (!fbc && !fbp && !gclid && !visitorId) {
            return res.status(200).json({ success: true, message: 'no enrichment data' });
        }
        
        console.log(`📊 ENRICH-PURCHASE: ${email} - fbc=${fbc ? 'Yes' : 'No'}, fbp=${fbp ? 'Yes' : 'No'}, gclid=${gclid ? 'Yes' : 'No'}, vid=${visitorId || 'none'}`);
        
        // Update ALL recent transactions for this email that are missing fbc/fbp/gclid
        const result = await pool.query(`
            UPDATE transactions SET
                fbc = COALESCE(transactions.fbc, $2),
                fbp = COALESCE(transactions.fbp, $3),
                visitor_id = COALESCE(transactions.visitor_id, $4),
                gclid = COALESCE(transactions.gclid, $5),
                updated_at = NOW()
            WHERE LOWER(email) = LOWER($1)
              AND created_at >= NOW() - INTERVAL '24 hours'
              AND (fbc IS NULL OR fbp IS NULL OR visitor_id IS NULL OR gclid IS NULL)
        `, [email, fbc || null, fbp || null, visitorId || null, gclid || null]);
        
        const updated = result.rowCount || 0;
        console.log(`📊 ENRICH-PURCHASE: Updated ${updated} transactions for ${email}`);
        
        // Also update the lead record with fbc/fbp/gclid if missing
        if (fbc || fbp || gclid) {
            try {
                await pool.query(`
                    UPDATE leads SET
                        fbc = COALESCE(leads.fbc, $2),
                        fbp = COALESCE(leads.fbp, $3),
                        visitor_id = COALESCE(leads.visitor_id, $4),
                        ip_address = COALESCE(leads.ip_address, $5),
                        user_agent = COALESCE(leads.user_agent, $6),
                        gclid = COALESCE(leads.gclid, $7),
                        updated_at = NOW()
                    WHERE LOWER(email) = LOWER($1)
                      AND (fbc IS NULL OR fbp IS NULL OR gclid IS NULL)
                `, [email, fbc || null, fbp || null, visitorId || null, ip || null, userAgent || null, gclid || null]);
            } catch (leadErr) { /* non-blocking */ }
        }
        
        // TRIGGER CAPI: Check for transactions that need CAPI Purchase events
        if (fbc || fbp) {
            let triggerCatchup = false;
            
            // Case 1: Approved transactions without ANY capi_purchase_logs
            // (Postback used delayed send, and we arrived before it fired - this is the common/happy path)
            const missingCapi = await pool.query(`
                SELECT t.transaction_id FROM transactions t
                LEFT JOIN capi_purchase_logs c ON t.transaction_id = c.transaction_id
                WHERE LOWER(t.email) = LOWER($1) AND t.status = 'approved' AND c.transaction_id IS NULL
                  AND t.created_at >= NOW() - INTERVAL '7 days'
            `, [email]);
            
            if (missingCapi.rows.length > 0) {
                console.log(`🔥 ENRICH-PURCHASE: Found ${missingCapi.rows.length} approved transactions for ${email} missing CAPI - triggering immediate catch-up...`);
                triggerCatchup = true;
            }
            
            // Case 2: CAPI was already sent but WITHOUT fbc
            // Previously we deleted logs and re-sent, but this causes DUPLICATE events in Facebook Ads Manager
            // Now we just log it - the event was already sent and Facebook has it
            if (fbc) {
                try {
                    const staleCapiLogs = await pool.query(`
                        SELECT c.id, c.transaction_id FROM capi_purchase_logs c
                        JOIN transactions t ON c.transaction_id = t.transaction_id
                        WHERE LOWER(t.email) = LOWER($1) AND c.has_fbc = false
                          AND t.created_at >= NOW() - INTERVAL '7 days'
                    `, [email]);
                    
                    if (staleCapiLogs.rows.length > 0) {
                        // Just update the logs with the new fbc/fbp data, DO NOT delete and re-send
                        for (const staleLog of staleCapiLogs.rows) {
                            await pool.query(`UPDATE capi_purchase_logs SET has_fbc = true, has_fbp = true WHERE id = $1`, [staleLog.id]);
                        }
                        console.log(`📝 ENRICH-PURCHASE: Updated ${staleCapiLogs.rows.length} CAPI logs with fbc/fbp for ${email} (no re-send to avoid duplication)`);
                        // DO NOT trigger catch-up - event already sent
                    }
                } catch (staleErr) {
                    console.error('ENRICH-PURCHASE stale logs error:', staleErr.message);
                }
            }
            
            if (triggerCatchup) {
                sendMissingCAPIPurchases().catch(err => console.error('CAPI catch-up error:', err.message));
                sendMissingGoogleAdsPurchases().catch(err => console.error('Google Ads catch-up error:', err.message));
            }
        }
        
        res.json({ success: true, updated, message: `${updated} transactions enriched` });
    } catch (error) {
        console.error('ENRICH-PURCHASE error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Clear failed CAPI logs so they can be resent
router.post('/api/admin/capi-clear-resend', authenticateToken, requireAdmin, async (req, res) => {
    try {
        console.log('🗑️ Admin requested: clear failed CAPI logs for resend...');
        
        // Delete ALL failed logs (capi_success = false) so catch-up can resend them
        const failedResult = await pool.query(
            `DELETE FROM capi_purchase_logs WHERE capi_success = false`
        );
        const deletedFailed = failedResult.rowCount || 0;
        
        // Also delete logs without fbc (legacy behavior)
        const noFbcResult = await pool.query(
            `DELETE FROM capi_purchase_logs WHERE has_fbc = false`
        );
        const deletedNoFbc = noFbcResult.rowCount || 0;
        
        const totalDeleted = deletedFailed + deletedNoFbc;
        console.log(`🗑️ Deleted ${deletedFailed} failed + ${deletedNoFbc} without FBC CAPI logs. Running backfill + catch-up...`);
        
        // First backfill fbc/fbp from raw_data into transactions columns
        await backfillTransactionFbcFbp();

        // Then run catch-up to resend them with correct fbc/fbp
        await sendMissingCAPIPurchases();
        await sendMissingGoogleAdsPurchases();
        
        res.json({ success: true, message: `${totalDeleted} eventos limpos e reenviados.`, deleted: totalDeleted, deletedFailed, deletedNoFbc });
    } catch (error) {
        console.error('CAPI clear-resend error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== REFUND REQUESTS API ====================

// Submit refund request (public)
router.post('/api/refund', async (req, res) => {
    try {
        const {
            fullName,
            email,
            phone,
            countryCode,
            purchaseDate,
            product,
            reason,
            details,
            protocol,
            language,
            visitorId
        } = req.body;

        // Validation
        if (!email || !fullName || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
        const userAgent = req.headers['user-agent'] || null;

        // ==================== CROSS-REFERENCE DATA ====================
        // Try to find this person in our leads and transactions to enrich the refund data
        // Language priority: 1. explicit from form, 2. cross-reference
        let detectedLanguage = (language === 'en' || language === 'es' || language === 'pt') ? language : null;
        let detectedValue = null;
        let matchedTransactionId = null;
        
        try {
            // 1. FIRST: Try to find by visitorId (most reliable method)
            if (visitorId) {
                console.log(`🔗 Refund cross-ref: Searching by visitorId: ${visitorId}`);
                
                // Check transactions by visitorId
                const txByVisitorResult = await pool.query(`
                    SELECT transaction_id, value, funnel_language, product, status, email
                    FROM transactions 
                    WHERE visitor_id = $1 AND status = 'approved'
                    ORDER BY created_at DESC 
                    LIMIT 1
                `, [visitorId]);
                
                if (txByVisitorResult.rows.length > 0) {
                    const tx = txByVisitorResult.rows[0];
                    if (!detectedLanguage) detectedLanguage = tx.funnel_language || null;
                    detectedValue = tx.value || null;
                    matchedTransactionId = tx.transaction_id || null;
                    console.log(`🔗 Refund cross-ref: Found transaction by visitorId! -> lang: ${detectedLanguage}, value: R$${detectedValue}, txId: ${matchedTransactionId}`);
                }
                
                // Also check leads by visitorId if no transaction found
                if (!detectedLanguage) {
                    const leadByVisitorResult = await pool.query(`
                        SELECT funnel_language
                        FROM leads 
                        WHERE visitor_id = $1
                        ORDER BY created_at DESC 
                        LIMIT 1
                    `, [visitorId]);
                    
                    if (leadByVisitorResult.rows.length > 0) {
                        detectedLanguage = leadByVisitorResult.rows[0].funnel_language || null;
                        console.log(`🔗 Refund cross-ref: Found lead by visitorId -> lang: ${detectedLanguage}`);
                    }
                }
                
                // Check funnel_events by visitorId
                if (!detectedLanguage || !detectedValue) {
                    const eventByVisitorResult = await pool.query(`
                        SELECT metadata->>'funnelLanguage' as funnel_language
                        FROM funnel_events 
                        WHERE visitor_id = $1
                        AND metadata->>'funnelLanguage' IS NOT NULL
                        ORDER BY created_at DESC 
                        LIMIT 1
                    `, [visitorId]);
                    
                    if (eventByVisitorResult.rows.length > 0 && !detectedLanguage) {
                        detectedLanguage = eventByVisitorResult.rows[0].funnel_language || null;
                        console.log(`🔗 Refund cross-ref: Found funnel event by visitorId -> lang: ${detectedLanguage}`);
                    }
                }
            }
            
            // 2. FALLBACK: If not found by visitorId, try by email
            if (!matchedTransactionId) {
                console.log(`🔗 Refund cross-ref: Fallback to email search: ${email}`);
                
                const txResult = await pool.query(`
                    SELECT transaction_id, value, funnel_language, product, status 
                    FROM transactions 
                    WHERE LOWER(email) = LOWER($1) AND status = 'approved'
                    ORDER BY created_at DESC 
                    LIMIT 1
                `, [email]);
                
                if (txResult.rows.length > 0) {
                    const tx = txResult.rows[0];
                    detectedLanguage = detectedLanguage || tx.funnel_language || null;
                    detectedValue = detectedValue || tx.value || null;
                    matchedTransactionId = matchedTransactionId || tx.transaction_id || null;
                    console.log(`🔗 Refund cross-ref: Found transaction by email -> lang: ${detectedLanguage}, value: R$${detectedValue}, txId: ${matchedTransactionId}`);
                }
            }
            
            // 3. If still no language, check leads by email
            if (!detectedLanguage) {
                const leadResult = await pool.query(`
                    SELECT l.id, l.funnel_language
                    FROM leads l
                    WHERE LOWER(l.email) = LOWER($1)
                    ORDER BY l.created_at DESC 
                    LIMIT 1
                `, [email]);
                
                if (leadResult.rows.length > 0) {
                    detectedLanguage = leadResult.rows[0].funnel_language || null;
                    console.log(`🔗 Refund cross-ref: Found lead by email -> lang: ${detectedLanguage}`);
                }
            }
            
            // 4. If still no language, check funnel_events by email
            if (!detectedLanguage) {
                const eventResult = await pool.query(`
                    SELECT metadata->>'funnelLanguage' as funnel_language
                    FROM funnel_events 
                    WHERE LOWER(metadata->>'email') = LOWER($1)
                    AND metadata->>'funnelLanguage' IS NOT NULL
                    ORDER BY created_at DESC 
                    LIMIT 1
                `, [email]);
                
                if (eventResult.rows.length > 0) {
                    detectedLanguage = eventResult.rows[0].funnel_language || null;
                    console.log(`🔗 Refund cross-ref: Found funnel event by email -> lang: ${detectedLanguage}`);
                }
            }
            
            console.log(`🔗 Refund cross-ref final: visitorId=${visitorId || 'none'}, email=${email}, lang=${detectedLanguage || 'unknown'}, value=${detectedValue || 'unknown'}, txId=${matchedTransactionId || 'none'}`);
            
        } catch (crossRefError) {
            console.error('⚠️ Cross-reference error (non-blocking):', crossRefError.message);
        }

        // Check for existing refund request from same email (prevent duplicates)
        const existingRefund = await pool.query(`
            SELECT id, protocol, status, created_at FROM refund_requests 
            WHERE LOWER(email) = LOWER($1) 
              AND (source IS NULL OR source = 'form')
            ORDER BY created_at DESC LIMIT 1
        `, [email]);
        
        if (existingRefund.rows.length > 0) {
            const existing = existingRefund.rows[0];
            console.log(`⚠️ Duplicate refund request blocked: ${email} already has ${existing.protocol} (status: ${existing.status})`);
            
            // Return the existing protocol instead of creating a duplicate
            return res.status(200).json({
                success: true,
                message: 'Refund request already exists',
                protocol: existing.protocol,
                existing: true
            });
        }

        // Store refund request with enriched data
        await pool.query(`
            INSERT INTO refund_requests (
                protocol, full_name, email, phone, country_code,
                purchase_date, product, reason, details,
                ip_address, user_agent, status, source, refund_type,
                funnel_language, value, transaction_id, visitor_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', 'form', 'refund',
                $12, $13, $14, $15, NOW())
        `, [
            protocol,
            fullName,
            email,
            phone,
            countryCode,
            purchaseDate,
            product,
            reason,
            details,
            ipAddress,
            userAgent,
            detectedLanguage,
            detectedValue,
            matchedTransactionId,
            visitorId || null
        ]);

        console.log(`📥 Refund request received: ${protocol} - ${email} - ${product} (lang: ${detectedLanguage || 'unknown'})`);

        res.status(201).json({
            success: true,
            message: 'Refund request submitted successfully',
            protocol
        });

    } catch (error) {
        console.error('Error submitting refund:', error);
        res.status(500).json({ error: 'Failed to submit refund request' });
    }
});

// ==================== SOCIAL SCAN (OSINT Trace - Social Media Scanner) ====================

router.post('/api/social-scan', apiLimiter, async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ error: 'Phone number required' });
        }

        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
        
        if (!RAPIDAPI_KEY) {
            console.log('Social scan: RAPIDAPI_KEY not configured');
            return res.status(200).json({ success: false, fallback: true });
        }

        const phoneE164 = '+' + cleanPhone;
        console.log('Social scan: checking', phoneE164);

        const response = await fetch('https://social-media-scanner1.p.rapidapi.com/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'social-media-scanner1.p.rapidapi.com'
            },
            body: JSON.stringify({
                input: phoneE164,
                programs: ['facebook', 'instagram']
            })
        });

        console.log('Social scan response:', response.status, response.statusText);

        if (response.status !== 200) {
            const text = await response.text();
            console.log('Social scan error response:', text.substring(0, 300));
            return res.status(200).json({ success: false, fallback: true });
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await response.text();
            console.log('Social scan: non-JSON response:', text.substring(0, 300));
            return res.status(200).json({ success: false, fallback: true });
        }

        const data = await response.json();
        console.log('Social scan raw response:', JSON.stringify(data));

        if (data.detail || data.error) {
            console.log('Social scan API error:', data.detail || data.error);
            return res.status(200).json({ success: false, fallback: true });
        }

        const platformMap = { x: 'twitter' };
        const foundPlatforms = [];
        const allPlatforms = {};

        for (const [platform, info] of Object.entries(data)) {
            if (typeof info === 'object' && info !== null && 'live' in info) {
                const name = platformMap[platform] || platform;
                allPlatforms[name] = { found: info.live === true };
                if (info.live === true) {
                    foundPlatforms.push(name);
                }
            }
        }

        console.log('Social scan OK:', foundPlatforms.length, 'platforms found:', foundPlatforms.join(', '));

        res.json({
            success: true,
            platforms: allPlatforms,
            found: foundPlatforms,
            foundCount: foundPlatforms.length,
            carrier: null,
            location: null,
            os: null
        });

    } catch (error) {
        console.error('Social scan error:', error.message);
        res.status(200).json({ success: false, fallback: true });
    }
});

// ==================== A/B TESTING PUBLIC API ====================

// Get variant for a visitor (called by frontend ab-testing.js)
router.get('/api/ab/variant', async (req, res) => {
    try {
        const { funnel, visitor_id } = req.query;
        
        if (!funnel || !visitor_id) {
            return res.json({ variant: null, test_id: null, config: null });
        }
        
        const activeTest = await pool.query(
            `SELECT id, name, funnel, variant_a_name, variant_a_param, variant_b_name, variant_b_param,
                    traffic_split, test_type, config_a, config_b, url_a, url_b
             FROM ab_tests 
             WHERE funnel = $1 AND status = 'running' 
             ORDER BY created_at DESC LIMIT 1`,
            [funnel]
        );
        
        if (activeTest.rows.length === 0) {
            return res.json({ variant: null, test_id: null, config: null });
        }
        
        const test = activeTest.rows[0];
        const testId = test.id;
        
        const existingVisitor = await pool.query(
            `SELECT variant FROM ab_test_visitors WHERE test_id = $1 AND visitor_id = $2`,
            [testId, visitor_id]
        );
        
        let variant;
        if (existingVisitor.rows.length > 0) {
            variant = existingVisitor.rows[0].variant;
        } else {
            const random = Math.random() * 100;
            variant = random < Number(test.traffic_split) ? 'A' : 'B';
            
            const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
            const userAgent = req.headers['user-agent'] || '';
            
            pool.query(
                `INSERT INTO ab_test_visitors (test_id, visitor_id, variant, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (test_id, visitor_id) DO NOTHING`,
                [testId, visitor_id, variant, ipAddress, userAgent]
            ).catch(err => console.error('AB visitor insert error:', err.message));
        }
        
        const config = variant === 'A' ? (test.config_a || {}) : (test.config_b || {});
        const param = variant === 'A' ? test.variant_a_param : test.variant_b_param;
        
        res.json({
            variant,
            test_id: testId,
            param,
            test_type: test.test_type || 'page',
            config,
            test_name: test.name
        });
        
    } catch (error) {
        console.error('AB variant error:', error);
        res.json({ variant: null, test_id: null, config: null });
    }
});

// Track A/B test conversion (called by frontend ab-testing.js)
router.post('/api/ab/convert', async (req, res) => {
    try {
        const { test_id, visitor_id, event_type, value, metadata } = req.body;
        
        if (!test_id || !visitor_id || !event_type) {
            return res.status(400).json({ error: 'test_id, visitor_id and event_type are required' });
        }
        
        const visitorResult = await pool.query(
            `SELECT variant FROM ab_test_visitors WHERE test_id = $1 AND visitor_id = $2`,
            [test_id, visitor_id]
        );
        
        const variant = visitorResult.rows.length > 0
            ? visitorResult.rows[0].variant
            : (req.body.variant || 'A');
        
        await pool.query(
            `INSERT INTO ab_test_conversions (test_id, visitor_id, variant, event_type, value, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [test_id, visitor_id, variant, event_type, value || 0, JSON.stringify(metadata || {})]
        );
        
        res.json({ success: true, variant, event_type });
        
    } catch (error) {
        console.error('AB conversion error:', error);
        res.status(500).json({ error: 'Failed to track conversion' });
    }
});

// Public endpoint: Get active Google Ads Conversion IDs for a language (supports multiple accounts)
router.get('/api/gads-config/:language', async (req, res) => {
    try {
        const lang = req.params.language;
        if (!['en', 'es', 'pt'].includes(lang)) {
            return res.json({ active: false, configs: [] });
        }
        const result = await pool.query(
            `SELECT conversion_id, conversion_label FROM gads_config WHERE language = $1 AND is_active = true ORDER BY id`,
            [lang]
        );
        if (result.rows.length === 0) {
            return res.json({ active: false, configs: [] });
        }
        res.json({
            active: true,
            configs: result.rows,
            conversion_id: result.rows[0].conversion_id,
            conversion_label: result.rows[0].conversion_label
        });
    } catch (err) {
        console.error('Error fetching gads config:', err.message);
        res.json({ active: false, configs: [] });
    }
});

module.exports = router;
