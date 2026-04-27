/**
 * Shared utility/helper functions
 */

// Build date filter SQL using Brazil timezone
function buildDateFilter(startDate, endDate, columnName = 'created_at') {
    if (!startDate || !endDate) return { sql: '', params: [] };
    return {
        sql: ` AND (${columnName} AT TIME ZONE 'America/Sao_Paulo')::date >= $PARAM_START::date AND (${columnName} AT TIME ZONE 'America/Sao_Paulo')::date <= $PARAM_END::date`,
        params: [startDate, endDate]
    };
}

// Parse Monetizze dates (BR format DD/MM/YYYY or ISO)
function parseMonetizzeDate(dateStr) {
    if (!dateStr) return null;
    try {
        const brDateMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
        if (brDateMatch) {
            const [, day, month, year, hour, minute, second] = brDateMatch;
            const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour}:${minute}:${second}-03:00`;
            const date = new Date(isoString);
            return isNaN(date.getTime()) ? null : date;
        }
        const isoNoTzMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
        if (isoNoTzMatch) {
            const [, year, month, day, hour, minute, second] = isoNoTzMatch;
            const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`;
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
    parseMonetizzeDate
};
