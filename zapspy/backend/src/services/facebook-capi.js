/**
 * Facebook Conversions API (CAPI) service
 * Handles sending events to Facebook, CAPI catch-up for missing purchases,
 * and backfilling fbc/fbp data from raw_data.
 */

const crypto = require('crypto');
const pool = require('../database');
const { FB_PIXELS_BY_LANGUAGE, FB_API_VERSION } = require('../config');

// ==================== Core CAPI Functions ====================

function getPixelsForLanguage(language, customPixelIds = null, customAccessToken = null) {
    // If custom pixels are provided (from frontend), use them
    if (customPixelIds && customPixelIds.length > 0 && customAccessToken) {
        return customPixelIds.map(id => ({
            id: id,
            token: customAccessToken,
            name: `Custom Pixel ${id}`
        }));
    }
    
    // Otherwise use the configured pixels for the language
    return FB_PIXELS_BY_LANGUAGE[language] || FB_PIXELS_BY_LANGUAGE.en;
}

// Hash function for user data (required by Facebook)
function hashData(data) {
    if (!data) return null;
    return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

// Normalize phone number for Facebook (must include country code)
function normalizePhone(phone, countryCode = null) {
    if (!phone) return null;
    // Remove all non-numeric characters
    let normalized = phone.replace(/\D/g, '');
    
    // If phone doesn't start with a country code, try to add one
    // Common patterns: US/CA starts with 1, BR starts with 55, ES/MX etc.
    if (normalized.length > 0) {
        // If it's a short number (10-11 digits), it probably doesn't have country code
        if (normalized.length <= 11 && !normalized.startsWith('1') && !normalized.startsWith('55')) {
            // Try to detect based on countryCode parameter
            if (countryCode) {
                const countryPrefixes = {
                    'US': '1', 'CA': '1', 'BR': '55', 'ES': '34', 'MX': '52',
                    'AR': '54', 'CL': '56', 'CO': '57', 'PE': '51', 'VE': '58',
                    'GB': '44', 'DE': '49', 'FR': '33', 'IT': '39', 'PT': '351'
                };
                const prefix = countryPrefixes[countryCode.toUpperCase()];
                if (prefix && !normalized.startsWith(prefix)) {
                    normalized = prefix + normalized;
                }
            }
        }
    }
    
    return normalized;
}

// Normalize gender for Facebook (m or f, lowercase)
function normalizeGender(gender) {
    if (!gender) return null;
    const g = gender.toLowerCase().trim();
    if (g === 'male' || g === 'm' || g === 'masculino' || g === 'hombre') return 'm';
    if (g === 'female' || g === 'f' || g === 'feminino' || g === 'mujer') return 'f';
    return null;
}

// Send event to Facebook Conversions API
// eventId: if provided, use it for deduplication with browser pixel
// userData.externalId: visitor ID for cross-device tracking
// options.language: 'en' or 'es' to select correct pixels
// options.pixelIds: array of custom pixel IDs (from frontend)
// options.accessToken: custom access token (from frontend)
async function sendToFacebookCAPI(eventName, userData, customData = {}, eventSourceUrl = null, eventId = null, options = {}) {
    // Use provided event_time (actual purchase time) or fallback to current time
    const timestamp = options.eventTime ? Math.floor(new Date(options.eventTime).getTime() / 1000) : Math.floor(Date.now() / 1000);
    // Use provided eventId or generate one
    const finalEventId = eventId || `${eventName}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Build user_data object
    const user_data = {};
    
    // Email (required, hashed)
    if (userData.email) {
        user_data.em = [hashData(userData.email)];
    }
    
    // Phone (hashed, with country code)
    if (userData.phone) {
        const normalizedPhone = normalizePhone(userData.phone, userData.country);
        if (normalizedPhone) {
            user_data.ph = [hashData(normalizedPhone)];
        }
    }
    
    // First Name and Last Name (hashed)
    if (userData.firstName) {
        const names = userData.firstName.trim().split(' ');
        user_data.fn = [hashData(names[0].toLowerCase())];
        if (names.length > 1) {
            user_data.ln = [hashData(names.slice(1).join(' ').toLowerCase())];
        }
    }
    if (userData.lastName) {
        user_data.ln = [hashData(userData.lastName.toLowerCase())];
    }
    
    // Gender (hashed, m or f)
    if (userData.gender) {
        const normalizedGender = normalizeGender(userData.gender);
        if (normalizedGender) {
            user_data.ge = [hashData(normalizedGender)];
        }
    }
    
    // Client IP Address (NOT hashed - required for server events)
    if (userData.ip) {
        user_data.client_ip_address = userData.ip;
    }
    
    // Client User Agent (NOT hashed - required for server events)
    if (userData.userAgent) {
        user_data.client_user_agent = userData.userAgent;
    }
    
    // Facebook Click ID (NOT hashed)
    if (userData.fbc) {
        user_data.fbc = userData.fbc;
    }
    
    // Facebook Browser ID (NOT hashed)
    if (userData.fbp) {
        user_data.fbp = userData.fbp;
    }
    
    // Country code (2-letter ISO 3166-1 alpha-2, lowercase, hashed)
    if (userData.country) {
        user_data.country = [hashData(userData.country.toLowerCase())];
    }
    
    // City (lowercase, no spaces, no punctuation, hashed)
    if (userData.city) {
        user_data.ct = [hashData(userData.city.toLowerCase().replace(/[^a-z]/g, ''))];
    }
    
    // State/Province (lowercase, no spaces, no punctuation, hashed)
    if (userData.state) {
        user_data.st = [hashData(userData.state.toLowerCase().replace(/[^a-z]/g, ''))];
    }
    
    // External ID for cross-device tracking (hashed)
    if (userData.externalId) {
        user_data.external_id = [hashData(userData.externalId)];
    }
    
    // Build event payload
    const eventPayload = {
        event_name: eventName,
        event_time: timestamp,
        event_id: finalEventId,
        action_source: 'website',
        user_data: user_data
    };
    
    // Always include event_source_url (required for best match quality)
    // Default to English funnel domain (must match domain where pixel fires for attribution)
    eventPayload.event_source_url = eventSourceUrl || 'https://ingles.zappdetect.com/';
    
    // Add referrer URL if available (helps with attribution)
    if (userData.referrer) {
        eventPayload.referrer_url = userData.referrer;
    }
    
    if (Object.keys(customData).length > 0) {
        eventPayload.custom_data = customData;
    }
    
    // Get pixels for the correct language (or use custom pixels from frontend)
    const pixels = getPixelsForLanguage(options.language, options.pixelIds, options.accessToken);
    
    // Test event codes for Facebook Events Manager testing
    // EN: TEST23104, ES: TEST96875
    const testEventCodes = {
        'en': process.env.FB_TEST_CODE_EN || null,  // Set to 'TEST23104' to enable testing
        'es': process.env.FB_TEST_CODE_ES || null   // Set to 'TEST96875' to enable testing
    };
    
    // Send to all pixels (with retry for transient failures)
    const results = [];
    const maxRetries = 2;
    const retryDelayMs = 500;

    for (const pixel of pixels) {
        if (!pixel.token || pixel.token.length < 10) {
            console.error(`❌ CAPI [${pixel.name}] ${eventName}: TOKEN MISSING OR EMPTY! Set FB_PIXEL_TOKEN_${(options.language || 'en').toUpperCase()} in environment variables.`);
            results.push({ pixel: pixel.id, success: false, error: 'Access token is missing or empty. Configure FB_PIXEL_TOKEN in environment variables.' });
            continue;
        }
        
        const url = `https://graph.facebook.com/${FB_API_VERSION}/${pixel.id}/events?access_token=${pixel.token}`;
        const requestBody = {
            data: [eventPayload]
        };
        const testCode = options.testEventCode || testEventCodes[options.language];
        if (testCode) {
            requestBody.test_event_code = testCode;
            console.log(`🧪 TEST MODE: Using test_event_code ${testCode} for ${pixel.name}`);
        }

        let lastError = null;
        let lastResult = null;
        let success = false;

        for (let attempt = 0; attempt <= maxRetries && !success; attempt++) {
            try {
                if (attempt > 0) {
                    await new Promise(r => setTimeout(r, retryDelayMs));
                    console.log(`🔄 CAPI [${pixel.name}] ${eventName}: retry ${attempt}/${maxRetries}`);
                }
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
                lastResult = await response.json();

                if (response.ok) {
                    console.log(`✅ CAPI [${pixel.name}] ${eventName}: success (id: ${finalEventId}, events_received: ${lastResult.events_received || 1})`);
                    results.push({ pixel: pixel.id, success: true, result: lastResult, eventId: finalEventId });
                    success = true;
                } else {
                    lastError = lastResult;
                    const fbError = lastResult?.error || {};
                    const errorMsg = fbError.message || JSON.stringify(lastResult).substring(0, 200);
                    const errorCode = fbError.code || response.status;
                    const errorSubcode = fbError.error_subcode || '';
                    console.error(`❌ CAPI [${pixel.name}] ${eventName}: HTTP ${response.status} - code=${errorCode} subcode=${errorSubcode} - ${errorMsg}`);
                    
                    if (errorCode === 190 || errorSubcode === 463 || errorSubcode === 467) {
                        console.error(`🔑 CAPI [${pixel.name}]: ACCESS TOKEN EXPIRED OR INVALID! Regenerate at: https://business.facebook.com/events_manager2/list/dataset/${pixel.id}/settings`);
                    }
                    
                    const isRetryable = response.status >= 500 || response.status === 429;
                    if (!isRetryable || attempt === maxRetries) {
                        results.push({ pixel: pixel.id, success: false, error: lastResult, httpStatus: response.status });
                        break;
                    }
                }
            } catch (error) {
                lastError = error.message;
                if (attempt === maxRetries) {
                    console.error(`❌ CAPI [${pixel.name}] ${eventName}: exception`, error.message);
                    results.push({ pixel: pixel.id, success: false, error: error.message });
                }
            }
        }
        if (!success && results.filter(r => r.pixel === pixel.id).length === 0) {
            results.push({ pixel: pixel.id, success: false, error: lastError || lastResult || 'Max retries exceeded' });
        }
    }

    return results;
}

// ==================== CAPI CATCH-UP: Send Purchase events for approved sales missing from capi_purchase_logs ====================
// This handles the case where background sync updates a transaction to 'approved' but doesn't trigger CAPI
// Lock to prevent concurrent execution of CAPI catch-up
let capiCatchupRunning = false;
let capiCatchupLastRun = 0;
const CAPI_CATCHUP_MIN_INTERVAL = 30000; // minimum 30 seconds between runs

async function sendMissingCAPIPurchases() {
    // Prevent concurrent execution (race condition protection)
    if (capiCatchupRunning) {
        console.log('⏳ CAPI CATCH-UP: Already running, skipping this call');
        return;
    }
    
    // Prevent too-frequent runs
    const now = Date.now();
    if (now - capiCatchupLastRun < CAPI_CATCHUP_MIN_INTERVAL) {
        console.log('⏳ CAPI CATCH-UP: Last run was less than 30s ago, skipping');
        return;
    }
    
    capiCatchupRunning = true;
    capiCatchupLastRun = now;
    
    try {
        console.log('🔍 CAPI CATCH-UP: Checking for approved transactions missing Purchase CAPI events...');
        
        // Find approved transactions from the last 7 days that DON'T have a capi_purchase_logs entry
        const missingResult = await pool.query(`
            SELECT t.transaction_id, t.email, t.phone, t.name, t.product, t.value, 
                   t.funnel_language, t.funnel_source, t.raw_data, t.created_at,
                   t.fbc AS tx_fbc, t.fbp AS tx_fbp, t.visitor_id AS tx_visitor_id
            FROM transactions t
            LEFT JOIN capi_purchase_logs c ON t.transaction_id = c.transaction_id
            WHERE t.status = 'approved' 
              AND c.transaction_id IS NULL
              AND t.created_at >= NOW() - INTERVAL '7 days'
              AND t.email IS NOT NULL
            ORDER BY t.created_at DESC
        `);
        
        if (missingResult.rows.length === 0) {
            console.log('✅ CAPI CATCH-UP: No missing Purchase events found. All approved sales have CAPI logs.');
            return;
        }
        
        console.log(`📤 CAPI CATCH-UP: Found ${missingResult.rows.length} approved transactions without CAPI Purchase events. Sending now...`);
        
        const brlToUsdRate = parseFloat(process.env.CONVERSION_BRL_TO_USD || '0.18');
        let sent = 0;
        let failed = 0;
        
        for (const tx of missingResult.rows) {
            try {
                const email = tx.email;
                const transactionId = tx.transaction_id;
                const funnelLanguage = tx.funnel_language || 'en';
                const funnelSource = tx.funnel_source || 'main';
                const productName = tx.product || 'Unknown Product';
                
                // Try to extract product code from raw_data
                let productCode = null;
                try {
                    const rawData = typeof tx.raw_data === 'string' ? JSON.parse(tx.raw_data) : tx.raw_data;
                    if (rawData) {
                        productCode = rawData.produto?.codigo || rawData['produto.codigo'] || null;
                    }
                } catch (e) { /* ignore parse errors */ }
                
                // ===== LEAD MATCHING (simplified version of postback handler) =====
                let leadData = null;
                let matchMethod = 'none';
                
                // Level 1: Match by email in leads table
                if (email) {
                    const leadResult = await pool.query(
                        `SELECT ip_address, user_agent, fbc, fbp, country, country_code, city, state, name, target_gender, whatsapp, visitor_id, referrer
                         FROM leads WHERE LOWER(email) = LOWER($1) ORDER BY created_at DESC LIMIT 1`,
                        [email]
                    );
                    if (leadResult.rows.length > 0) {
                        leadData = leadResult.rows[0];
                        matchMethod = 'email';
                    }
                }
                
                // Level 2: Match by phone in leads table
                if (!leadData && tx.phone) {
                    const cleanPhone = tx.phone.replace(/\D/g, '');
                    if (cleanPhone.length >= 7) {
                        const phoneResult = await pool.query(
                            `SELECT ip_address, user_agent, fbc, fbp, country, country_code, city, state, name, target_gender, whatsapp, visitor_id, referrer
                             FROM leads WHERE REPLACE(REPLACE(REPLACE(whatsapp, '+', ''), '-', ''), ' ', '') LIKE $1 
                             ORDER BY created_at DESC LIMIT 1`,
                            [`%${cleanPhone.slice(-7)}%`]
                        );
                        if (phoneResult.rows.length > 0) {
                            leadData = phoneResult.rows[0];
                            matchMethod = 'phone';
                        }
                    }
                }
                
                // Level 3: Try funnel_events for fbc/fbp by IP match
                if (!leadData) {
                    // Try to extract buyer IP from raw_data
                    let buyerIp = null;
                    try {
                        const rawData = typeof tx.raw_data === 'string' ? JSON.parse(tx.raw_data) : tx.raw_data;
                        buyerIp = rawData?.comprador?.ip || rawData?.['comprador.ip'] || null;
                    } catch (e) { /* ignore */ }
                    
                    if (buyerIp) {
                        const eventResult = await pool.query(
                            `SELECT visitor_id, ip_address, user_agent, fbc, fbp 
                             FROM funnel_events WHERE ip_address = $1 
                             ORDER BY created_at DESC LIMIT 1`,
                            [buyerIp]
                        );
                        if (eventResult.rows.length > 0) {
                            const eventRow = eventResult.rows[0];
                            leadData = {
                                ip_address: eventRow.ip_address, user_agent: eventRow.user_agent,
                                fbc: eventRow.fbc, fbp: eventRow.fbp,
                                country_code: null, city: null, state: null, target_gender: null,
                                name: tx.name, whatsapp: tx.phone, visitor_id: eventRow.visitor_id,
                                funnel_language: funnelLanguage, referrer: null
                            };
                            matchMethod = 'ip_events';
                        }
                    }
                }
                
                // Level 4: Get fbc/fbp/vid - FIRST from transactions table columns (saved by postback), then fallback to raw_data parsing
                let rawFbc = tx.tx_fbc || null;
                let rawFbp = tx.tx_fbp || null;
                let rawVid = tx.tx_visitor_id || null;
                
                // If not in transactions columns, try raw_data JSON (postback body)
                if (!rawFbc || !rawFbp) {
                    try {
                        const rawData = typeof tx.raw_data === 'string' ? JSON.parse(tx.raw_data) : tx.raw_data;
                        if (rawData) {
                            const venda = (rawData.venda && typeof rawData.venda === 'object') ? rawData.venda : {};
                            if (!rawFbc) rawFbc = rawData.zs_fbc || venda.zs_fbc || rawData['zs_fbc'] || null;
                            if (!rawFbp) rawFbp = rawData.zs_fbp || venda.zs_fbp || rawData['zs_fbp'] || null;
                            if (!rawVid) rawVid = rawData.vid || venda.vid || rawData['vid'] || null;
                            
                            // Build fbc from fbclid if zs_fbc not available
                            if (!rawFbc) {
                                const fbclid = rawData.fbclid || venda.fbclid || null;
                                if (fbclid) {
                                    rawFbc = `fb.1.${Date.now()}.${fbclid}`;
                                }
                            }
                        }
                    } catch (e) { /* ignore parse errors */ }
                }
                
                // If no lead found but we have raw_data params, create minimal lead
                if (!leadData && (rawFbc || rawFbp)) {
                    leadData = {
                        ip_address: null, user_agent: null,
                        fbc: rawFbc, fbp: rawFbp,
                        country_code: null, city: null, state: null, target_gender: null,
                        name: tx.name, whatsapp: tx.phone, visitor_id: rawVid,
                        funnel_language: funnelLanguage, referrer: null
                    };
                    matchMethod = 'raw_data_params';
                }
                
                // ENRICHMENT: If lead found but missing fbc/fbp, try multiple sources
                if (leadData && (!leadData.fbc || !leadData.fbp)) {
                    // Try raw_data params first (most reliable for this transaction)
                    if (!leadData.fbc && rawFbc) leadData.fbc = rawFbc;
                    if (!leadData.fbp && rawFbp) leadData.fbp = rawFbp;
                    
                    // Try funnel_events by visitor_id
                    const visitorId = leadData.visitor_id || rawVid;
                    if ((!leadData.fbc || !leadData.fbp) && visitorId) {
                        try {
                            const enrichResult = await pool.query(
                                `SELECT fbc, fbp, ip_address, user_agent 
                                 FROM funnel_events WHERE visitor_id = $1 AND (fbc IS NOT NULL OR fbp IS NOT NULL)
                                 ORDER BY created_at DESC LIMIT 1`,
                                [visitorId]
                            );
                            if (enrichResult.rows.length > 0) {
                                const enrichRow = enrichResult.rows[0];
                                if (!leadData.fbc && enrichRow.fbc) leadData.fbc = enrichRow.fbc;
                                if (!leadData.fbp && enrichRow.fbp) leadData.fbp = enrichRow.fbp;
                                if (!leadData.ip_address && enrichRow.ip_address) leadData.ip_address = enrichRow.ip_address;
                                if (!leadData.user_agent && enrichRow.user_agent) leadData.user_agent = enrichRow.user_agent;
                            }
                        } catch (enrichErr) { /* non-blocking */ }
                    }
                }
                
                if (leadData) {
                    console.log(`📊 CAPI CATCH-UP: Lead matched [${matchMethod}] for ${email} (tx: ${transactionId}) - fbc=${leadData.fbc ? 'Yes' : 'No'}, fbp=${leadData.fbp ? 'Yes' : 'No'}, IP=${leadData.ip_address ? 'Yes' : 'No'}, txFbc=${tx.tx_fbc ? 'Yes' : 'No'}, txFbp=${tx.tx_fbp ? 'Yes' : 'No'}`);
                } else {
                    console.log(`📊 CAPI CATCH-UP: No lead found for ${email} (tx: ${transactionId}) - txFbc=${tx.tx_fbc ? 'Yes' : 'No'}, txFbp=${tx.tx_fbp ? 'Yes' : 'No'}, rawFbc=${rawFbc ? 'Yes' : 'No'}, rawFbp=${rawFbp ? 'Yes' : 'No'}`);
                }
                
                // Build Facebook user data
                const fbUserData = {
                    email: email,
                    phone: leadData?.whatsapp || tx.phone,
                    firstName: leadData?.name || tx.name,
                    ip: leadData?.ip_address || null,
                    userAgent: leadData?.user_agent || null,
                    fbc: leadData?.fbc || null,
                    fbp: leadData?.fbp || null,
                    country: leadData?.country_code || null,
                    city: leadData?.city || null,
                    state: leadData?.state || null,
                    gender: leadData?.target_gender || null,
                    externalId: leadData?.visitor_id || null,
                    referrer: leadData?.referrer || null
                };
                
                // Convert value to USD
                const rawValue = parseFloat(tx.value) || 0;
                let valueUSD;
                
                if (funnelSource === 'perfectpay') {
                    // PerfectPay may store values in USD (international) or BRL
                    // Check raw_data for currency info
                    let isPerfectPayBRL = true; // default to BRL
                    try {
                        const rawData = typeof tx.raw_data === 'string' ? JSON.parse(tx.raw_data) : tx.raw_data;
                        if (rawData) {
                            const currencyEnum = rawData.currency_enum || rawData.sale_currency_enum;
                            // currency_enum 1 = BRL, others may be USD
                            if (currencyEnum && currencyEnum !== 1 && currencyEnum !== '1') {
                                isPerfectPayBRL = false;
                            }
                        }
                    } catch (e) {}
                    
                    valueUSD = isPerfectPayBRL 
                        ? Math.round((rawValue * brlToUsdRate) * 100) / 100 
                        : rawValue;
                    console.log(`💱 CAPI CATCH-UP: PerfectPay value: ${rawValue} -> USD: ${valueUSD} (isBRL: ${isPerfectPayBRL})`);
                } else {
                    // Monetizze values are always in BRL
                    valueUSD = Math.round((rawValue * brlToUsdRate) * 100) / 100;
                }
                
                // Skip $0 purchases (invalid/test transactions)
                if (valueUSD <= 0) {
                    console.log(`⏭️ CAPI CATCH-UP: Skipping ${transactionId} - value is $0 or negative`);
                    continue;
                }
                
                // Build Facebook custom data
                const fbCustomData = {
                    content_name: productName,
                    content_ids: [productCode || transactionId],
                    content_type: 'product',
                    value: valueUSD,
                    currency: 'USD',
                    order_id: transactionId,
                    num_items: 1,
                    customer_segmentation: 'new_customer_to_business'
                };
                
                // Build event source URL (MUST match the domain where the pixel fires)
                let eventSourceUrl;
                if (funnelSource === 'perfectpay') {
                    eventSourceUrl = funnelLanguage === 'es' 
                        ? 'https://perfect.zappdetect.com/espanhol/' 
                        : funnelLanguage === 'pt'
                        ? 'https://perfect.zappdetect.com/portugues/'
                        : 'https://perfect.zappdetect.com/ingles/';
                } else if (funnelSource === 'affiliate') {
                    eventSourceUrl = funnelLanguage === 'es' 
                        ? 'https://afiliado.whatstalker.com/espanhol/' 
                        : 'https://afiliado.whatstalker.com/ingles/';
                } else {
                    eventSourceUrl = funnelLanguage === 'es' 
                        ? 'https://espanhol.zappdetect.com/' 
                        : funnelLanguage === 'pt'
                        ? 'https://portugues.zappdetect.com/'
                        : 'https://ingles.zappdetect.com/';
                }
                
                // Event ID (status-agnostic for dedup) - use correct prefix per source
                const eventPrefix = funnelSource === 'perfectpay' ? 'perfectpay' : 'monetizze';
                const purchaseEventId = `${eventPrefix}_${transactionId}_purchase`;
                
                // CRITICAL: Double-check that this transaction hasn't been logged while we were processing
                // This prevents race conditions when multiple catch-ups overlap
                const doubleCheck = await pool.query(
                    'SELECT 1 FROM capi_purchase_logs WHERE transaction_id = $1 LIMIT 1',
                    [transactionId]
                );
                if (doubleCheck.rows.length > 0) {
                    console.log(`⏭️ CAPI CATCH-UP: Skipping ${transactionId} - already logged (race condition prevented)`);
                    continue;
                }
                
                // Use the actual sale date from the transaction
                const capiOptions = { language: funnelLanguage, eventTime: tx.created_at || null };
                
                // SEND Purchase event
                console.log(`📤 CAPI CATCH-UP: Sending Purchase for ${email} (tx: ${transactionId}, value: $${valueUSD}, lang: ${funnelLanguage})...`);
                const purchaseResults = await sendToFacebookCAPI('Purchase', fbUserData, fbCustomData, eventSourceUrl, purchaseEventId, capiOptions);
                
                // Determine success
                const firstResult = purchaseResults[0] || {};
                const capiSuccess = firstResult.success === true;
                const fbEventsReceived = firstResult.result?.events_received || 0;
                const pixelId = firstResult.pixel || '';
                const pixelName = funnelLanguage === 'es' ? 'PIXEL SPY ESPANHOL' : '[PABLO NOVO] - [SPY INGLES]';
                
                // Attribution data
                const purchaseAttrData = {
                    hasEmail: !!email,
                    hasFbc: !!(leadData?.fbc),
                    hasFbp: !!(leadData?.fbp),
                    hasIp: !!(leadData?.ip_address),
                    hasUa: !!(leadData?.user_agent),
                    hasExternalId: !!(leadData?.visitor_id),
                    hasCountry: !!(leadData?.country_code),
                    hasPhone: !!(leadData?.whatsapp || tx.phone),
                    leadFound: !!leadData
                };
                
                console.log(`📤 CAPI CATCH-UP: Result for ${email}: ${capiSuccess ? '✅ SUCCESS' : '❌ FAILED'} (events_received: ${fbEventsReceived})`);
                
                // Save to capi_purchase_logs (ON CONFLICT prevents duplicate entries)
                try {
                    await pool.query(`
                        INSERT INTO capi_purchase_logs (
                            transaction_id, email, product, value, currency,
                            funnel_language, funnel_source, event_source_url, event_id,
                            pixel_id, pixel_name,
                            has_email, has_fbc, has_fbp, has_ip, has_user_agent,
                            has_external_id, has_country, has_phone, lead_found,
                            capi_success, capi_response, fb_events_received, match_method
                        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
                        ON CONFLICT (transaction_id) DO NOTHING
                    `, [
                        transactionId, email, productName,
                        fbCustomData.value, fbCustomData.currency,
                        funnelLanguage, funnelSource, eventSourceUrl, purchaseEventId,
                        pixelId, pixelName,
                        purchaseAttrData.hasEmail, purchaseAttrData.hasFbc, purchaseAttrData.hasFbp,
                        purchaseAttrData.hasIp, purchaseAttrData.hasUa,
                        purchaseAttrData.hasExternalId, purchaseAttrData.hasCountry,
                        purchaseAttrData.hasPhone, purchaseAttrData.leadFound,
                        capiSuccess, JSON.stringify(purchaseResults), fbEventsReceived, matchMethod
                    ]);
                } catch (logErr) {
                    console.error(`CAPI CATCH-UP: Error saving log for ${transactionId}:`, logErr.message);
                }
                
                if (capiSuccess) sent++;
                else failed++;
                
                // Small delay between CAPI calls to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (txErr) {
                console.error(`CAPI CATCH-UP: Error processing tx ${tx.transaction_id}:`, txErr.message);
                failed++;
            }
        }
        
        console.log(`✅ CAPI CATCH-UP complete: ${sent} sent, ${failed} failed, ${missingResult.rows.length} total checked`);
        
    } catch (error) {
        console.error('❌ CAPI CATCH-UP error:', error.message);
    } finally {
        capiCatchupRunning = false;
    }
}

// Backfill fbc/fbp/visitor_id from raw_data for transactions that have it in their postback body but not in the columns
async function backfillTransactionFbcFbp() {
    try {
        console.log('🔄 Backfilling fbc/fbp/visitor_id from raw_data to transactions table...');
        const result = await pool.query(`
            SELECT transaction_id, raw_data FROM transactions
            WHERE (fbc IS NULL OR fbp IS NULL OR visitor_id IS NULL)
              AND raw_data IS NOT NULL
              AND created_at >= NOW() - INTERVAL '30 days'
        `);
        
        if (result.rows.length === 0) {
            console.log('✅ Backfill: No transactions need fbc/fbp/vid update.');
            return;
        }
        
        let updated = 0;
        for (const tx of result.rows) {
            try {
                const rawData = typeof tx.raw_data === 'string' ? JSON.parse(tx.raw_data) : tx.raw_data;
                if (!rawData) continue;
                
                const venda = (rawData.venda && typeof rawData.venda === 'object') ? rawData.venda : {};
                let fbc = rawData.zs_fbc || venda.zs_fbc || rawData['zs_fbc'] || null;
                const fbp = rawData.zs_fbp || venda.zs_fbp || rawData['zs_fbp'] || null;
                const vid = rawData.vid || venda.vid || rawData['vid'] || null;
                
                // Build fbc from fbclid if not available
                if (!fbc) {
                    const fbclid = rawData.fbclid || venda.fbclid || null;
                    if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
                }
                
                if (fbc || fbp || vid) {
                    await pool.query(`
                        UPDATE transactions SET 
                            fbc = COALESCE(transactions.fbc, $2),
                            fbp = COALESCE(transactions.fbp, $3),
                            visitor_id = COALESCE(transactions.visitor_id, $4),
                            updated_at = NOW()
                        WHERE transaction_id = $1 AND (fbc IS NULL OR fbp IS NULL OR visitor_id IS NULL)
                    `, [tx.transaction_id, fbc, fbp, vid]);
                    updated++;
                }
            } catch (e) { /* skip individual errors */ }
        }
        
        console.log(`✅ Backfill complete: ${updated}/${result.rows.length} transactions updated with fbc/fbp/vid from raw_data.`);
    } catch (error) {
        console.error('❌ Backfill error:', error.message);
    }
}

module.exports = {
    hashData,
    normalizePhone,
    normalizeGender,
    getPixelsForLanguage,
    sendToFacebookCAPI,
    sendMissingCAPIPurchases,
    backfillTransactionFbcFbp
};
