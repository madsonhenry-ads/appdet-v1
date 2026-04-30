/**
 * Shared utility/helper functions
 */

const pool = require('./database');

// Timezone cache (refreshed every 5 minutes)
let _tzCache = null;
let _tzCacheTime = 0;
const TZ_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const DEFAULT_TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';

/**
 * Get the configured timezone from app_settings (with in-memory cache).
 * Falls back to DEFAULT_TIMEZONE if DB is unavailable.
 */
async function getTimezone() {
    const now = Date.now();
    if (_tzCache && (now - _tzCacheTime) < TZ_CACHE_TTL) {
        return _tzCache;
    }
    try {
        const result = await pool.query(`SELECT value FROM app_settings WHERE key = 'timezone'`);
        _tzCache = result.rows.length > 0 ? result.rows[0].value : DEFAULT_TIMEZONE;
        _tzCacheTime = now;
        return _tzCache;
    } catch (e) {
        return _tzCache || DEFAULT_TIMEZONE;
    }
}

/**
 * Clear the timezone cache (call after updating settings)
 */
function clearTimezoneCache() {
    _tzCache = null;
    _tzCacheTime = 0;
}

/**
 * Compute the current UTC offset string (e.g. '-03:00' or '+01:00')
 * for a given IANA timezone, accounting for DST.
 */
function getUTCOffset(timezone = DEFAULT_TIMEZONE) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    if (!tzPart) return '-03:00'; // fallback

    // tzPart.value looks like "GMT-3" or "GMT+1" or "GMT"
    const match = tzPart.value.match(/GMT([+-]\d+(?:\.\d+)?)/);
    if (!match) return '-03:00'; // fallback for GMT without offset

    const offsetNum = parseFloat(match[1]);
    const sign = offsetNum >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetNum);
    const hours = Math.floor(absOffset);
    const minutes = Math.round((absOffset - hours) * 60);
    return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Build date filter SQL using configured timezone
function buildDateFilter(startDate, endDate, columnName = 'created_at', tz = DEFAULT_TIMEZONE) {
    if (!startDate || !endDate) return { sql: '', params: [] };
    return {
        sql: ` AND (${columnName} AT TIME ZONE '${tz}')::date >= $PARAM_START::date AND (${columnName} AT TIME ZONE '${tz}')::date <= $PARAM_END::date`,
        params: [startDate, endDate]
    };
}

// Parse Monetizze dates (BR format DD/MM/YYYY or ISO) with dynamic timezone offset
function parseMonetizzeDate(dateStr, tz) {
    if (!dateStr) return null;
    const offset = tz ? getUTCOffset(tz) : '-03:00';
    try {
        const brDateMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
        if (brDateMatch) {
            const [, day, month, year, hour, minute, second] = brDateMatch;
            const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour}:${minute}:${second}${offset}`;
            const date = new Date(isoString);
            return isNaN(date.getTime()) ? null : date;
        }
        const isoNoTzMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
        if (isoNoTzMatch) {
            const [, year, month, day, hour, minute, second] = isoNoTzMatch;
            const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
            const date = new Date(isoString);
            return isNaN(date.getTime()) ? null : date;
        }
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    } catch (e) {
        return null;
    }
}

module.exports = {
    buildDateFilter,
    parseMonetizzeDate,
    getTimezone,
    clearTimezoneCache,
    getUTCOffset,
    DEFAULT_TIMEZONE
};
