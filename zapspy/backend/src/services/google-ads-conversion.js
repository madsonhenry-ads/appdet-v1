/**
 * Google Ads Conversion Tracking service
 * Sends Purchase conversion events server-side when postbacks arrive.
 * Supports MULTIPLE conversion IDs per language (multiple Google Ads accounts).
 * Config is stored in the database and manageable via the admin panel.
 */

const pool = require('../database');

let configCache = {};
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000;

let catchupRunning = false;
let catchupLastRun = 0;
const CATCHUP_MIN_INTERVAL = 30000;

async function getConfigsForLanguage(language) {
    const now = Date.now();
    if (now - configCacheTime < CONFIG_CACHE_TTL && configCache[language] !== undefined) {
        return configCache[language];
    }

    try {
        const allResult = await pool.query(
            `SELECT language, conversion_id, conversion_label, is_active FROM gads_config WHERE is_active = true`
        );
        configCache = {};
        for (const row of allResult.rows) {
            if (!configCache[row.language]) configCache[row.language] = [];
            configCache[row.language].push(row);
        }
        configCacheTime = now;

        return configCache[language] || [];
    } catch (err) {
        console.error('Google Ads: Error loading config:', err.message);
        return [];
    }
}

function invalidateConfigCache() {
    configCacheTime = 0;
    configCache = {};
}

async function sendToSingleConfig(config, transactionData) {
    const { transaction_id, email, value, currency, funnel_language, gclid } = transactionData;
    const language = funnel_language || 'en';
    const { conversion_id, conversion_label } = config;
    const numericId = conversion_id.replace('AW-', '').replace('aw-', '');

    try {
        const url = new URL(`https://www.googleadservices.com/pagead/conversion/${numericId}/`);
        url.searchParams.set('label', conversion_label);
        url.searchParams.set('value', String(value || 0));
        url.searchParams.set('currency', currency || 'USD');
        url.searchParams.set('transaction_id', transaction_id);
        url.searchParams.set('remarketing_only', '0');

        if (gclid) {
            url.searchParams.set('gclid', gclid);
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'User-Agent': 'WhatSpy-Server/1.0' }
        });

        const success = response.ok;

        try {
            await pool.query(`
                INSERT INTO gads_purchase_logs 
                    (transaction_id, conversion_id, conversion_label, email, value, currency, funnel_language, success, error_message, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                ON CONFLICT (transaction_id, conversion_id) DO NOTHING
            `, [
                transaction_id, conversion_id, conversion_label,
                email, value, currency || 'USD', language,
                success, success ? null : `HTTP ${response.status}`
            ]);
        } catch (logErr) {
            console.error('Google Ads: Error logging conversion:', logErr.message);
        }

        if (success) {
            console.log(`✅ Google Ads: Purchase sent for ${transaction_id} (${conversion_id}/${conversion_label}) value=${value} ${currency}`);
        } else {
            console.error(`❌ Google Ads: Purchase failed for ${transaction_id} (${conversion_id}) - HTTP ${response.status}`);
        }

        return success;
    } catch (err) {
        console.error(`❌ Google Ads: Network error for ${transaction_id} (${conversion_id}):`, err.message);

        try {
            await pool.query(`
                INSERT INTO gads_purchase_logs 
                    (transaction_id, conversion_id, conversion_label, email, value, currency, funnel_language, success, error_message, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, NOW())
                ON CONFLICT (transaction_id, conversion_id) DO NOTHING
            `, [transaction_id, conversion_id, conversion_label, email, value, currency || 'USD', language, err.message]);
        } catch (logErr) { /* ignore */ }

        return false;
    }
}

/**
 * Send a Purchase conversion to ALL active Google Ads accounts for the language.
 */
async function sendGoogleAdsConversion(transactionData) {
    const language = transactionData.funnel_language || 'en';
    const configs = await getConfigsForLanguage(language);

    if (configs.length === 0) {
        return { sent: false, reason: 'no_active_config', count: 0 };
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const config of configs) {
        const success = await sendToSingleConfig(config, transactionData);
        if (success) sentCount++;
        else failedCount++;
    }

    return {
        sent: sentCount > 0,
        count: sentCount,
        failed: failedCount,
        total: configs.length
    };
}

/**
 * Catch-up: find approved transactions missing Google Ads logs
 * for any active conversion config and send them.
 */
async function sendMissingGoogleAdsPurchases() {
    if (catchupRunning) {
        console.log('⏳ Google Ads CATCH-UP: Already running, skipping');
        return;
    }

    const now = Date.now();
    if (now - catchupLastRun < CATCHUP_MIN_INTERVAL) {
        console.log('⏳ Google Ads CATCH-UP: Last run < 30s ago, skipping');
        return;
    }

    catchupRunning = true;
    catchupLastRun = now;

    try {
        const activeConfigs = await pool.query(
            `SELECT id, language, conversion_id, conversion_label FROM gads_config WHERE is_active = true`
        );
        if (activeConfigs.rows.length === 0) return;

        const activeLanguages = [...new Set(activeConfigs.rows.map(r => r.language))];

        const txResult = await pool.query(`
            SELECT t.transaction_id, t.email, t.value, t.funnel_language, t.funnel_source, t.created_at,
                   COALESCE(t.gclid, l.gclid) AS gclid
            FROM transactions t
            LEFT JOIN leads l ON LOWER(t.email) = LOWER(l.email)
            WHERE t.status = 'approved'
              AND t.created_at >= NOW() - INTERVAL '7 days'
              AND t.email IS NOT NULL
              AND t.funnel_language = ANY($1)
            ORDER BY t.created_at DESC
        `, [activeLanguages]);

        if (txResult.rows.length === 0) return;

        const brlToUsdRate = parseFloat(process.env.CONVERSION_BRL_TO_USD || '0.18');
        let sent = 0;
        let failed = 0;

        for (const tx of txResult.rows) {
            const lang = tx.funnel_language || 'en';
            const configsForLang = activeConfigs.rows.filter(c => c.language === lang);

            for (const config of configsForLang) {
                const alreadySent = await pool.query(
                    `SELECT 1 FROM gads_purchase_logs WHERE transaction_id = $1 AND conversion_id = $2 LIMIT 1`,
                    [tx.transaction_id, config.conversion_id]
                );
                if (alreadySent.rows.length > 0) continue;

                const valueRaw = parseFloat(tx.value) || 0;
                const isPerfectPay = tx.transaction_id?.startsWith('PP_');
                const isBRL = !isPerfectPay;
                const valueUSD = isBRL ? Math.round((valueRaw * brlToUsdRate) * 100) / 100 : valueRaw;

                const success = await sendToSingleConfig(config, {
                    transaction_id: tx.transaction_id,
                    email: tx.email,
                    value: valueUSD,
                    currency: 'USD',
                    funnel_language: lang,
                    gclid: tx.gclid || null
                });

                if (success) sent++;
                else failed++;
            }
        }

        if (sent > 0 || failed > 0) {
            console.log(`✅ Google Ads CATCH-UP: ${sent} sent, ${failed} failed`);
        }
    } catch (err) {
        console.error('❌ Google Ads CATCH-UP error:', err.message);
    } finally {
        catchupRunning = false;
    }
}

module.exports = {
    getConfigsForLanguage,
    sendGoogleAdsConversion,
    sendMissingGoogleAdsPurchases,
    invalidateConfigCache
};
