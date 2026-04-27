/**
 * RapidAPI whatsapp-data1: nome (leakCheckPro) e imagem de fallback quando Z-API não retorna foto.
 * Chave: RAPIDAPI_KEY (não commitar).
 *
 * Diagnóstico: logs no console; resposta JSON com _debug se WHATSAPP_CHECK_DEBUG=1 no .env.
 */

const util = require('util');
const RAPID_HOST = 'whatsapp-data1.p.rapidapi.com';
const REQUEST_TIMEOUT_MS = 25000;

function buildQueryString() {
    const qs = new URLSearchParams({
        base64: 'false',
        telegram: 'true',
        google: 'false',
        includeLeakCheckPro: 'true',
        fullAiReport: 'false',
        reverseImageSearch: 'true'
    });
    if (process.env.WHATSAPP_DATA_RAPID_FULL === '1' || process.env.WHATSAPP_DATA_RAPID_FULL === 'true') {
        qs.set('fullAiReport', 'true');
        qs.set('google', 'true');
    }
    return qs.toString();
}

function getLeakCheckPro(data) {
    if (!data || typeof data !== 'object') return null;
    return data.leakCheckPro ?? data.leak_check_pro ?? data.LeakCheckPro ?? null;
}

/** `result` pode vir como array ou um único objeto */
function leakResultRows(lc) {
    if (!lc || typeof lc !== 'object') return [];
    const r = lc.result;
    if (Array.isArray(r)) return r;
    if (r && typeof r === 'object') return [r];
    return [];
}

function pickNameFromRapidTopLevel(data) {
    if (!data || typeof data !== 'object') return null;
    const c =
        data.name ||
        data.pushName ||
        data.push_name ||
        data.verifiedName ||
        data.verified_name ||
        data.whatsappName ||
        data.profileName;
    return c && String(c).trim() ? String(c).trim() : null;
}

/** LeakCheck pode devolver `fields` como objeto, JSON string ou array de { key/name, value } */
function normalizeLeakFields(fields) {
    if (fields == null) return null;
    if (typeof fields === 'string') {
        const t = fields.trim();
        if (!t) return null;
        try {
            const p = JSON.parse(t);
            if (p && typeof p === 'object' && !Array.isArray(p)) return p;
        } catch {
            return null;
        }
        return null;
    }
    if (Array.isArray(fields)) {
        const out = {};
        for (const item of fields) {
            if (!item || typeof item !== 'object') continue;
            const k = item.name ?? item.key ?? item.field ?? item.id;
            const v = item.value ?? item.val ?? item.data;
            if (k != null && v != null && String(v).trim()) out[String(k)] = v;
        }
        return Object.keys(out).length ? out : null;
    }
    if (typeof fields === 'object') return fields;
    return null;
}

function nameFromFlatLeakRecord(flat) {
    if (!flat || typeof flat !== 'object') return null;
    const fn =
        flat.first_name ?? flat.firstName ?? flat.given_name ?? flat.givenName ?? flat.nome ?? null;
    const ln =
        flat.last_name ??
        flat.lastName ??
        flat.family_name ??
        flat.familyName ??
        flat.sobrenome ??
        null;
    const pf = fn && String(fn).trim();
    const pl = ln && String(ln).trim();
    if (pf && pl) return `${pf} ${pl}`;
    if (pf) return pf;
    if (pl) return pl;
    const single =
        flat.name ??
        flat.full_name ??
        flat.fullName ??
        flat.display_name ??
        flat.displayName ??
        null;
    return single && String(single).trim() ? String(single).trim() : null;
}

/** username do leak (ex. Telegram) — não usar se for só dígitos / o mesmo telefone */
function displayNameFromLeakUsername(row, usernameRaw) {
    if (!usernameRaw || typeof usernameRaw !== 'string') return null;
    let s = usernameRaw.trim().replace(/^@+/, '');
    if (!s) return null;
    const digitsOnly = s.replace(/\D/g, '');
    const phoneDigits = String(row.phone || '').replace(/\D/g, '');
    if (digitsOnly.length >= 8 && /^\d+$/.test(digitsOnly)) return null;
    if (phoneDigits && digitsOnly === phoneDigits) return null;
    if (/[\s]/.test(s)) return s.replace(/\s+/g, ' ').trim();
    if (/[._-]/.test(s)) return s.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (s.length >= 2 && s.length <= 64) return s;
    return null;
}

function extractDisplayNameFromLeakCheck(data) {
    const lc = getLeakCheckPro(data);
    const rows = leakResultRows(lc);
    if (rows.length === 0) return null;
    if (lc.success === false && Number(lc.found) === 0) return null;

    const row = rows[0];
    if (!row || typeof row !== 'object') return null;

    const fromRow = nameFromFlatLeakRecord(row);
    if (fromRow) return fromRow;

    const fromFields = nameFromFlatLeakRecord(normalizeLeakFields(row.fields));
    if (fromFields) return fromFields;

    const fromUser = displayNameFromLeakUsername(row, row.username);
    if (fromUser) return fromUser;

    return null;
}

function cleanDisplayName(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    let s = raw.trim();
    s = s.replace(/^[A-Z]{2,5}_/, '');
    s = s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    if (s === s.toUpperCase() && s.length > 2) {
        s = s.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
    }
    return s || null;
}

function extractDisplayNameFromRapid(data) {
    const fromLeak = extractDisplayNameFromLeakCheck(data);
    if (fromLeak) return cleanDisplayName(fromLeak);
    const fromTop = pickNameFromRapidTopLevel(data);
    return fromTop ? cleanDisplayName(fromTop) : null;
}

function pickRapidProfileImage(data) {
    const candidates = [data?.profilePic, data?.urlImage, data?.pictureHistory?.[0]?.url];
    for (const u of candidates) {
        if (u && typeof u === 'string' && u.startsWith('http')) return u;
    }
    return null;
}

function extractOsintData(data, lc) {
    const osint = {
        breachesCount: 0,
        telegramFound: false,
        telegramUsername: null,
        reverseImageMatches: 0,
        aboutHistory: [],
        location: null,
        countryCode: null,
        businessCategory: null,
        googleResultsCount: 0,
        aiReportSummary: null,
        carrier: null,
        riskLevel: null,
    };
    if (!data || typeof data !== 'object') return osint;

    const leakFound = lc?.found ?? lc?.Found ?? 0;
    osint.breachesCount = typeof leakFound === 'number' ? leakFound : parseInt(leakFound) || 0;

    if (data.telegram && typeof data.telegram === 'object' && !data.telegram.error) {
        osint.telegramFound = true;
        osint.telegramUsername = data.telegram.username || data.telegram.first_name || null;
    }

    const ris = data.reverseImageSearch;
    if (ris && typeof ris === 'object' && ris.success) {
        osint.reverseImageMatches = ris.visualMatchesCount || ris.exactMatchesCount || 0;
    }

    if (Array.isArray(data.aboutHistory) && data.aboutHistory.length > 0) {
        osint.aboutHistory = data.aboutHistory.slice(0, 5).map(h => ({
            text: h.about || '',
            date: h.aboutSetAt || h.date || null
        }));
    }

    const bp = data.businessProfile;
    if (bp && typeof bp === 'object' && bp.address) {
        osint.location = bp.address;
    }

    osint.countryCode = data.countryCode || null;

    if (bp?.categories?.[0]?.localized_display_name) {
        osint.businessCategory = bp.categories[0].localized_display_name;
    }

    if (data.google && Array.isArray(data.google.results)) {
        osint.googleResultsCount = data.google.results.length;
    }

    if (data.aiReport && typeof data.aiReport === 'object' && data.aiReport.report) {
        const clean = data.aiReport.report.replace(/\*\*/g, '');
        const summaryMatch = clean.match(/1\.\s*Summary\s*\n([\s\S]*?)(?:\n\s*2\.|$)/i);
        osint.aiReportSummary = summaryMatch ? summaryMatch[1].trim().slice(0, 300) : clean.slice(0, 300);

        const carrierMatch = clean.match(/Carrier\s*:\s*(.+)/i);
        if (carrierMatch) osint.carrier = carrierMatch[1].trim();

        const spamMatch = clean.match(/Spam\s*:\s*(.+)/i);
        const scamMatch = clean.match(/Scam\s*:\s*(.+)/i);
        if (spamMatch || scamMatch) {
            const spam = spamMatch ? spamMatch[1].trim() : 'unknown';
            const scam = scamMatch ? scamMatch[1].trim() : 'unknown';
            osint.riskLevel = (spam === 'no' && scam === 'no') ? 'low' : (spam === 'yes' || scam === 'yes') ? 'high' : 'moderate';
        }
    }

    return osint;
}

async function _fetchRapidJson(phoneDigits) {
    const key = process.env.RAPIDAPI_KEY;
    if (!key) {
        return { ok: false, noKey: true, status: null, data: null, durationMs: 0, error: 'no_rapidapi_key', snippet: '' };
    }

    const url = `https://${RAPID_HOST}/number/${encodeURIComponent(phoneDigits)}?${buildQueryString()}`;
    const t0 = Date.now();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
    try {
        const r = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': key,
                'x-rapidapi-host': RAPID_HOST,
                'Content-Type': 'application/json'
            },
            signal: ac.signal
        });
        const durationMs = Date.now() - t0;
        if (!r.ok) {
            const snippet = await r.text().catch(() => '');
            console.log(
                `\n📇 Rapid HTTP ${r.status} (${phoneDigits})\n${String(snippet).slice(0, 400)}\n`
            );
            return { ok: false, noKey: false, status: r.status, data: null, durationMs, error: `http_${r.status}`, snippet: String(snippet).slice(0, 200) };
        }
        const data = await r.json();
        return { ok: true, noKey: false, status: r.status, data, durationMs, error: null, snippet: '' };
    } catch (e) {
        const durationMs = Date.now() - t0;
        const err = e.name === 'AbortError' ? 'timeout' : e.message;
        console.log(`\n📇 Rapid erro: ${err} (${phoneDigits})\n`);
        return { ok: false, noKey: false, status: null, data: null, durationMs, error: err, snippet: '' };
    } finally {
        clearTimeout(timer);
    }
}

async function fetchWhatsappDataRapid(phoneDigits) {
    const r = await _fetchRapidJson(phoneDigits);
    return r.ok ? r.data : null;
}

/**
 * @returns {Promise<{ name: string|null, fallbackImage: string|null, diag: object }>}
 */
async function enrichWhatsappProfileFromRapid(phoneDigits) {
    const diag = {
        rapid: {
            attempted: false,
            skippedReason: null,
            durationMs: null,
            httpStatus: null,
            hadJsonBody: false,
            topLevelKeys: null,
            leakCheckProPresent: false,
            leakSuccess: null,
            leakFound: null,
            leakResultCount: 0,
            firstLeakRowKeys: null,
            nameExtracted: false,
            fallbackImageUsed: false,
            error: null,
            rapidFullMode:
                process.env.WHATSAPP_DATA_RAPID_FULL === '1' || process.env.WHATSAPP_DATA_RAPID_FULL === 'true'
        }
    };

    const fetched = await _fetchRapidJson(phoneDigits);
    diag.rapid.durationMs = fetched.durationMs;
    diag.rapid.httpStatus = fetched.status;
    diag.rapid.error = fetched.error;

    const emptyOsint = { breachesCount: 0, telegramFound: false, telegramUsername: null, reverseImageMatches: 0, aboutHistory: [], location: null, countryCode: null, businessCategory: null, googleResultsCount: 0, aiReportSummary: null, carrier: null, riskLevel: null };

    if (fetched.noKey) {
        diag.rapid.skippedReason = 'no_rapidapi_key';
        console.log(`📇 Rapid ${phoneDigits}: busca NÃO executada (sem RAPIDAPI_KEY)`);
        return { name: null, fallbackImage: null, about: null, isBusiness: false, face: null, osint: emptyOsint, diag };
    }

    diag.rapid.attempted = true;

    if (!fetched.ok || !fetched.data) {
        console.log(
            `📇 Rapid ${phoneDigits}: busca executada → falha (${diag.rapid.error || 'unknown'}) em ${diag.rapid.durationMs}ms`
        );
        return { name: null, fallbackImage: null, about: null, isBusiness: false, face: null, osint: emptyOsint, diag };
    }

    const data = fetched.data;
    diag.rapid.hadJsonBody = true;
    diag.rapid.httpStatus = fetched.status;

    if (data && typeof data === 'object') {
        diag.rapid.topLevelKeys = Object.keys(data);
        const snap = {};
        for (const k of Object.keys(data)) {
            const v = data[k];
            if (v == null) snap[k] = null;
            else if (typeof v === 'string') snap[k] = v.length > 80 ? v.slice(0, 80) + '…' : v;
            else if (typeof v === 'boolean' || typeof v === 'number') snap[k] = v;
            else if (Array.isArray(v)) snap[k] = `[Array(${v.length})]`;
            else if (typeof v === 'object') snap[k] = `{${Object.keys(v).join(',')}}`;
        }
        diag.rapid.snapshot = snap;
        if (data.google) diag.rapid.googleData = data.google;
        if (data.aiReport) diag.rapid.aiReport = data.aiReport;
        if (data.telegram) diag.rapid.telegramData = data.telegram;
        if (data.fbLeak) diag.rapid.fbLeak = data.fbLeak;
    }

    const lc = getLeakCheckPro(data);
    diag.rapid.leakCheckProPresent = !!lc;
    if (lc && typeof lc === 'object') {
        diag.rapid.leakSuccess = lc.success;
        diag.rapid.leakFound = lc.found;
        const rows = leakResultRows(lc);
        diag.rapid.leakResultCount = rows.length;
        if (rows[0] && typeof rows[0] === 'object') {
            diag.rapid.firstLeakRowKeys = Object.keys(rows[0]);
        }
    }

    const name = extractDisplayNameFromRapid(data);
    const fallbackImage = pickRapidProfileImage(data);
    diag.rapid.nameExtracted = !!name;
    diag.rapid.fallbackImageUsed = !!fallbackImage;

    const about = (data.about && typeof data.about === 'string' && data.about.trim()) ? data.about.trim() : null;
    const isBusiness = !!data.isBusiness;
    const facePerson = data.faceAnalysis?.people?.[0];
    const face = facePerson ? {
        age: facePerson.age || null,
        gender: facePerson.gender || null,
        description: data.faceAnalysis.description || null
    } : null;

    const osint = extractOsintData(data, lc);

    const rows = leakResultRows(lc);
    const row0 = rows[0] && typeof rows[0] === 'object' ? rows[0] : null;
    let row0Json = '';
    if (row0) {
        try {
            row0Json = JSON.stringify(row0, null, 2);
        } catch {
            row0Json = util.inspect(row0, { depth: 4, maxStringLength: 300 });
        }
    }
    console.log(
        `\n📇 Rapid OK ${phoneDigits}  ${diag.rapid.durationMs}ms\n` +
            `   leakCheck  rows=${diag.rapid.leakResultCount}  name=${name ? JSON.stringify(name) : 'VAZIO'}  img=${fallbackImage ? 'sim' : 'não'}\n` +
            `   about=${about ? JSON.stringify(about) : '—'}  business=${isBusiness}  face=${face ? face.gender + '/' + face.age : '—'}\n` +
            `   osint: breaches=${osint.breachesCount}  telegram=${osint.telegramFound}  reverseImg=${osint.reverseImageMatches}  location=${osint.location || '—'}\n` +
            (row0Json
                ? `   leak row[0]:\n${row0Json.split('\n').map((l) => `   ${l}`).join('\n')}\n`
                : '')
    );

    if (diag.rapid.leakCheckProPresent && diag.rapid.leakResultCount === 0) {
        console.log(
            `📇 Rapid ${phoneDigits}: leakCheckPro sem linhas (nome fica vazio).\n`
        );
    }

    return { name, fallbackImage, about, isBusiness, face, osint, diag };
}

module.exports = {
    enrichWhatsappProfileFromRapid,
    fetchWhatsappDataRapid,
    extractDisplayNameFromLeakCheck,
    extractDisplayNameFromRapid,
    pickRapidProfileImage
};
