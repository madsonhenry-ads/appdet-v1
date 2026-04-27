const pool = require('../database');

const ZAPI_INSTANCES = [
    {
        instance: process.env.ZAPI_INSTANCE_ID || '3F114A6FB7F43239AD81027B70318FE3',
        token: process.env.ZAPI_TOKEN || '5020FD1DCE0B8B23673BA43A',
        clientToken: process.env.ZAPI_CLIENT_TOKEN || 'Fd8be5328288e466eb014c3d6c653dd3aS'
    }
];

const deadInstances = new Map();
const DEAD_INSTANCE_TTL = 10 * 60 * 1000;

// Global rate limiter: max Z-API profile-picture calls per minute
const ZAPI_RATE_LIMIT = 10;
const ZAPI_RATE_WINDOW = 60 * 1000;
let _zapiCallTimestamps = [];

function _isRateLimited() {
    const now = Date.now();
    _zapiCallTimestamps = _zapiCallTimestamps.filter(t => now - t < ZAPI_RATE_WINDOW);
    return _zapiCallTimestamps.length >= ZAPI_RATE_LIMIT;
}

function _recordZapiCall() {
    _zapiCallTimestamps.push(Date.now());
}

async function zapiRequest(endpoint, options = {}) {
    for (const inst of ZAPI_INSTANCES) {
        const instKey = inst.instance.slice(0, 8);

        const deadUntil = deadInstances.get(inst.instance);
        if (deadUntil && Date.now() < deadUntil) {
            console.log(`Z-API instance ${instKey}... skipped (marked dead until ${new Date(deadUntil).toISOString()})`);
            continue;
        }

        try {
            const base = `https://api.z-api.io/instances/${inst.instance}/token/${inst.token}`;
            const url = `${base}/${endpoint}`;
            const headers = { 'Client-Token': inst.clientToken, ...options.headers };
            const r = await fetch(url, { ...options, headers });
            const data = await r.json();

            if (!data.error && r.ok) {
                deadInstances.delete(inst.instance);
                return { data, ok: true, instance: instKey };
            }

            console.log(`Z-API instance ${instKey}... returned error for ${endpoint}: ${JSON.stringify(data).slice(0, 200)}, trying next`);

            if (data.error === 'Instance not found' || r.status === 404 || r.status === 401) {
                deadInstances.set(inst.instance, Date.now() + DEAD_INSTANCE_TTL);
                console.log(`Z-API instance ${instKey}... marked as dead for 10 min`);
            }
        } catch (e) {
            console.log(`Z-API instance ${instKey}... failed for ${endpoint}: ${e.message}`);
            deadInstances.set(inst.instance, Date.now() + DEAD_INSTANCE_TTL);
        }
    }
    return { data: null, ok: false };
}

async function zapiCheckStatus() {
    for (const inst of ZAPI_INSTANCES) {
        try {
            const base = `https://api.z-api.io/instances/${inst.instance}/token/${inst.token}`;
            const r = await fetch(`${base}/status`, {
                headers: { 'Client-Token': inst.clientToken }
            });
            const data = await r.json();
            if (r.ok && (data.connected || data.smartphoneConnected)) {
                return { ...data, connected: true, activeInstance: inst.instance.slice(0, 8) + '...' };
            }
        } catch (e) {
            console.log(`Z-API instance ${inst.instance.slice(0,8)}... status check failed: ${e.message}`);
        }
    }
    return { connected: false };
}

async function zapiSendText(phone, message) {
    return zapiRequest('send-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message, delayMessage: 3 })
    });
}

// ==================== Profile Picture with DB-first Cache ====================

const pictureCache = new Map();
const PICTURE_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours in-memory
const DB_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;  // Only re-fetch from Z-API if DB cache is older than 24h

function _validPicUrl(url) {
    return url && url !== 'null' && url !== null && typeof url === 'string' && url.startsWith('http');
}

async function _saveToDbCache(phone, url) {
    try {
        await pool.query(`
            INSERT INTO profile_picture_cache (phone, picture_url, fetched_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (phone) DO UPDATE SET picture_url = $2, fetched_at = NOW()
        `, [phone, url]);
    } catch (e) {
        console.log(`📸 DB cache save failed for ${phone}: ${e.message}`);
    }
}

async function _getFromDbCache(phone) {
    try {
        const result = await pool.query(
            `SELECT picture_url, fetched_at FROM profile_picture_cache WHERE phone = $1`,
            [phone]
        );
        if (result.rows.length > 0) {
            return {
                url: result.rows[0].picture_url,
                fetchedAt: new Date(result.rows[0].fetched_at).getTime()
            };
        }
    } catch (e) {
        console.log(`📸 DB cache read failed for ${phone}: ${e.message}`);
    }
    return null;
}

async function zapiProfilePicture(phone) {
    // 1. Check in-memory cache first (fastest)
    const memCached = pictureCache.get(phone);
    if (memCached && Date.now() < memCached.expiresAt) {
        console.log(
            `📸 Foto perfil ${phone}  →  origem: memória (Map interno, TTL 2h)\n` +
                '   (não foi consultado PostgreSQL nem Z-API neste pedido)\n'
        );
        return memCached.url;
    }

    // 2. Check DB cache BEFORE calling Z-API (avoids unnecessary API calls)
    const dbCached = await _getFromDbCache(phone);
    if (dbCached && dbCached.url) {
        const age = Date.now() - dbCached.fetchedAt;
        // If DB cache is fresh enough, use it without calling Z-API
        if (age < DB_CACHE_MAX_AGE) {
            const ageH = (age / 3600000).toFixed(2);
            console.log(
                `📸 Foto perfil ${phone}  →  origem: PostgreSQL (tabela profile_picture_cache)\n` +
                    `   · SELECT picture_url, fetched_at — idade do registo: ${ageH} h (< 24h = válido)\n` +
                    '   (Z-API não foi chamada)\n'
            );
            pictureCache.set(phone, { url: dbCached.url, expiresAt: Date.now() + PICTURE_CACHE_TTL });
            return dbCached.url;
        }
    }

    // 3. Rate limit check — if too many calls recently, return DB cache or null
    if (_isRateLimited()) {
        console.log(`📸 Rate limited — skipping Z-API call for ${phone}`);
        if (dbCached && dbCached.url) {
            console.log(
                `📸 Foto perfil ${phone}  →  origem: PostgreSQL (fallback por rate limit Z-API)\n`
            );
            pictureCache.set(phone, { url: dbCached.url, expiresAt: Date.now() + PICTURE_CACHE_TTL });
            return dbCached.url;
        }
        return null;
    }

    // 4. Call Z-API (single attempt, no fallback)
    _recordZapiCall();
    const result = await zapiRequest(`profile-picture?phone=${phone}`);
    let url = null;
    if (result.ok && _validPicUrl(result.data?.link)) {
        url = result.data.link;
    }

    if (url) {
        pictureCache.set(phone, { url, expiresAt: Date.now() + PICTURE_CACHE_TTL });
        _saveToDbCache(phone, url);
        console.log(
            `📸 Foto perfil ${phone}  →  origem: Z-API (chamada HTTP)\n` +
                '   · gravado/atualizado em profile_picture_cache (UPSERT)\n'
        );
        return url;
    }

    // 5. Z-API failed — use stale DB cache if available
    if (dbCached && dbCached.url) {
        const ageH = ((Date.now() - dbCached.fetchedAt) / 3600000).toFixed(2);
        console.log(
            `📸 Foto perfil ${phone}  →  origem: PostgreSQL (cache antigo >24h — Z-API falhou)\n` +
                `   · idade do registo: ${ageH} h\n`
        );
        pictureCache.set(phone, { url: dbCached.url, expiresAt: Date.now() + PICTURE_CACHE_TTL });
        return dbCached.url;
    }

    console.log(`📸 Foto perfil ${phone}  →  origem: nenhuma (sem Z-API, sem cache BD)\n`);
    return null;
}

module.exports = {
    ZAPI_INSTANCES,
    zapiRequest,
    zapiCheckStatus,
    zapiSendText,
    zapiProfilePicture
};
