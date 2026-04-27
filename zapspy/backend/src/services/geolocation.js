/**
 * IP Geolocation service
 * - getCountryFromIP: lightweight lookup via ip-api.com (free, used for lead capture)
 * - getDetailedGeoFromIP: rich lookup via RapidAPI IP Geolocation36 (paid, used for CTA personalization)
 *   API: ip-geo-geolocation36.p.rapidapi.com  /lookup/{ip}
 */
const http = require('http');
const https = require('https');

const geoCache = new Map();
const GEO_CACHE_TTL = 1800000; // 30 min

function cleanIPAddress(ip) {
    if (!ip) return null;
    if (ip.startsWith('::ffff:')) return ip.substring(7);
    return ip;
}

function isPrivateIP(ip) {
    return !ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.');
}

async function getCountryFromIP(ip) {
    return new Promise((resolve) => {
        try {
            if (isPrivateIP(ip)) {
                return resolve({ country: null, country_code: null, city: null });
            }
            const cleanIP = cleanIPAddress(ip);
            const url = `http://ip-api.com/json/${cleanIP}?fields=status,country,countryCode,city,regionName`;
            
            http.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.status === 'success') {
                            resolve({
                                country: json.country || null,
                                country_code: json.countryCode || null,
                                city: json.city || null,
                                state: json.regionName || null
                            });
                        } else {
                            resolve({ country: null, country_code: null, city: null, state: null });
                        }
                    } catch (e) {
                        resolve({ country: null, country_code: null, city: null, state: null });
                    }
                });
            }).on('error', () => {
                resolve({ country: null, country_code: null, city: null, state: null });
            });
        } catch (e) {
            resolve({ country: null, country_code: null, city: null, state: null });
        }
    });
}

async function getDetailedGeoFromIP(ip) {
    const cleanIP = cleanIPAddress(ip);
    if (isPrivateIP(cleanIP)) return null;

    const cacheKey = cleanIP;
    const cached = geoCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts < GEO_CACHE_TTL)) return cached.data;

    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
        console.log('Geolocation: RAPIDAPI_KEY not set, falling back to ip-api');
        const basic = await getCountryFromIP(ip);
        return basic.city ? { ...basic, latitude: null, longitude: null } : null;
    }

    return new Promise((resolve) => {
        try {
            const options = {
                method: 'GET',
                hostname: 'ip-geo-geolocation36.p.rapidapi.com',
                port: null,
                path: `/lookup/${cleanIP}`,
                headers: {
                    'x-rapidapi-key': rapidApiKey,
                    'x-rapidapi-host': 'ip-geo-geolocation36.p.rapidapi.com',
                    'content-type': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.error || json.message) {
                            console.log('Geolocation36 API error:', json.error || json.message);
                            resolve(null);
                            return;
                        }
                        const result = {
                            country: json.country || json.country_name || null,
                            country_code: json.country_code || json.countryCode || null,
                            city: json.city || null,
                            state: json.region || json.regionName || json.state || null,
                            latitude: json.latitude || json.lat || null,
                            longitude: json.longitude || json.lon || null,
                            timezone: json.timezone || json.time_zone || null,
                            isp: json.isp || json.org || null
                        };
                        geoCache.set(cacheKey, { data: result, ts: Date.now() });
                        resolve(result);
                    } catch (e) {
                        console.log('Geolocation36 parse error:', e.message);
                        resolve(null);
                    }
                });
            });

            req.on('error', (e) => {
                console.log('Geolocation36 request error:', e.message);
                resolve(null);
            });

            req.setTimeout(5000, () => { req.destroy(); resolve(null); });
            req.end();
        } catch (e) {
            console.log('Geolocation36 error:', e.message);
            resolve(null);
        }
    });
}

function generateSuspiciousLocations(city, state, lang) {
    if (!city) return [];

    const hotelPrefixes = {
        en: ['Grand', 'Royal', 'Sunset', 'Paradise', 'Golden', 'Silver', 'Blue', 'Crystal', 'Imperial', 'Crown'],
        es: ['Gran', 'Real', 'Sol', 'Paraíso', 'Dorado', 'Plaza', 'Jardín', 'Imperial', 'Corona', 'Vista'],
        pt: ['Grand', 'Real', 'Sol', 'Paraíso', 'Dourado', 'Plaza', 'Jardim', 'Imperial', 'Coroa', 'Vista']
    };
    const hotelSuffixes = {
        en: ['Hotel', 'Inn', 'Suites', 'Lodge', 'Resort', 'Plaza Hotel', 'Boutique Hotel'],
        es: ['Hotel', 'Posada', 'Suites', 'Hotel Boutique', 'Resort', 'Hospedaje'],
        pt: ['Hotel', 'Pousada', 'Suítes', 'Hotel Boutique', 'Resort', 'Hospedagem']
    };
    const motelNames = {
        en: ['Motel', 'Motor Inn', 'Roadside Inn', 'Express Motel'],
        es: ['Motel', 'Auto Hotel', 'Hotel Express'],
        pt: ['Motel', 'Auto Hotel', 'Hotel Express']
    };
    const restaurantPrefixes = {
        en: ['The', 'Little', 'Old', 'Downtown', 'Harbor', 'River', 'Lake'],
        es: ['El', 'La', 'Don', 'Casa', 'Puerto', 'Río', 'Lago'],
        pt: ['O', 'A', 'Dom', 'Casa', 'Porto', 'Rio', 'Lago']
    };
    const restaurantSuffixes = {
        en: ['Bistro', 'Grill', 'Kitchen', 'Tavern', 'Lounge', 'Bar & Grill'],
        es: ['Bistró', 'Parrilla', 'Cocina', 'Taberna', 'Lounge', 'Bar'],
        pt: ['Bistrô', 'Grill', 'Cozinha', 'Taberna', 'Lounge', 'Bar']
    };

    const l = lang || 'en';
    const hp = hotelPrefixes[l] || hotelPrefixes.en;
    const hs = hotelSuffixes[l] || hotelSuffixes.en;
    const mn = motelNames[l] || motelNames.en;
    const rp = restaurantPrefixes[l] || restaurantPrefixes.en;
    const rs = restaurantSuffixes[l] || restaurantSuffixes.en;

    const seed = city.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const pick = (arr, offset) => arr[(seed + offset) % arr.length];

    const locations = [
        { type: 'hotel', name: `${pick(hp, 0)} ${city} ${pick(hs, 1)}`, visits: Math.floor((seed % 5) + 2), lastSeen: { en: 'Last seen 2 days ago', es: 'Visto hace 2 días', pt: 'Visto há 2 dias' }[l] },
        { type: 'motel', name: `${city} ${pick(mn, 2)}`, visits: Math.floor((seed % 3) + 1), lastSeen: { en: 'Last seen 5 days ago', es: 'Visto hace 5 días', pt: 'Visto há 5 dias' }[l] },
        { type: 'hotel', name: `${pick(hp, 3)} ${pick(hs, 4)}`, visits: Math.floor((seed % 4) + 1), lastSeen: { en: 'Last seen 1 week ago', es: 'Visto hace 1 semana', pt: 'Visto há 1 semana' }[l] },
        { type: 'restaurant', name: `${pick(rp, 5)} ${pick(rs, 6)}`, visits: Math.floor((seed % 6) + 3), lastSeen: { en: 'Last seen yesterday', es: 'Visto ayer', pt: 'Visto ontem' }[l] },
        { type: 'motel', name: `${pick(hp, 7)} ${pick(mn, 0)}`, visits: Math.floor((seed % 2) + 1), lastSeen: { en: 'Last seen 3 days ago', es: 'Visto hace 3 días', pt: 'Visto há 3 dias' }[l] },
        { type: 'restaurant', name: `${pick(rp, 1)} ${city} ${pick(rs, 2)}`, visits: Math.floor((seed % 7) + 2), lastSeen: { en: 'Last seen today', es: 'Visto hoy', pt: 'Visto hoje' }[l] },
    ];

    return locations;
}

module.exports = { getCountryFromIP, getDetailedGeoFromIP, generateSuspiciousLocations };
