/**
 * Application configuration constants
 */

const FB_PIXELS_BY_LANGUAGE = {
    en: [
        {
            id: '1123687999653173',
            token: process.env.FB_PIXEL_TOKEN_EN || 'EAAIZBhZBUm41EBQGJiqnIgPUnsW3NZCRIZBtHBEnhrkWm8D8dIrfjDZCqZCfKnG6DHX1IeP6w6ktrEZAzQKzMyGknADSuwWZByNqeRrObpDdGTKiCO2MXWuZC1IqIOPTCVxFDlES2s05aOOVPHK40eAPhhyyd9SgMcQl6aFTym48DHIOvOtZBmHRn5LenXRwgKo3oi4AZDZD',
            name: 'ZAPSPY EN - Pixel 1'
        },
        {
            id: '1533299911750042',
            token: process.env.FB_PIXEL_TOKEN_EN_2 || 'EAAtKah1ZCsC4BRZA1AH5AZCKgf0tJFf6IZB2JnyOHZB1ZBLdfbyXnZBxTh7jsT6bREdXuZCCSEIWewigViQZBZAnyKvIMI9f4BZAQNbkyBmVkuoJPe8ts741TxoezHuYBqxg985ZAxgeYiS7Ssd28jOlFmpBXxR3WKK8m2qIaZCF2Va1Ikqk8a4ZC5J4xh3jtPBU5klrWcuwZDZD',
            name: 'ZAPSPY EN - Pixel 2'
        }
    ],
    es: [
        {
            id: '534495082571XXX',
            token: process.env.FB_PIXEL_TOKEN_ES || 'XXXLZCphpZCmcIBQh5zHSNNj666RUi8XybMe3ZBRE31J9czSE04LBY4nZC9PBNG8SFNL4yCJf6zb9V88JkjNz55nTaIZC2wKSW22OhohIBY0IyYPYXTBFQTBVWUUIYDHhgZBf1CDVye724ekcSA6UbwSqJQPK8XYLEkvUfoJtXq7ktPv7qMOjloAx3jXdjUdJM3TgZDZD',
            name: 'PIXEL SPY ESPANHOL'
        }
    ],
    pt: [
        {
            id: '820651673268XXX',
            token: process.env.FB_PIXEL_TOKEN_PT || 'XXXLZCphpZCmcIBQ8cg9hswdI4uIXKLSil7qKGG3lY7tpz40BKqA0JYNay9qKon7SpOEFS7UxmvtizBaSzSiXZBNfXRHGFp0LW5rO4rhiYfS5C9UvoZAWDrW4A8RgwQOxFr011oCtMcyvRIwIUGci1yZAtd4iFaG7UUQh9pfBEbt129yMT4KUNRN9EsHmj7fEZAiAZDZD',
            name: 'PIXEL SPY PORTUGUES'
        }
    ],
    fr: [
        {
            id: '1152754042657XXX',
            token: process.env.FB_PIXEL_TOKEN_FR || 'XXXLZCphpZCmcIBRNf6zlLh4NEttMLWjZBLlIXVvyG7EEYNj0KUZCrlkcgbYLkfwiGfT4ZC9hcpftADrUTZC03Ghzz5bra0B16ZCxdfDs4NfSgL1gFFcWqQP7MUbx8RyUEb8Yq4mwKLExoWAnIiait6ZBb3LH2ZAZBfYnBDw1eUk8olUaLczZBC15t2OAjifiZC4Vi9zlYAZDZD',
            name: 'PIXEL SPY FRANCES'
        }
    ]
};

const FB_PIXELS = FB_PIXELS_BY_LANGUAGE.en;
const FB_API_VERSION = 'v21.0';

const ALLOWED_ORIGINS = [
    'https://en.appdetect.site',
    'https://es.appdetect.site',
    'https://ingles.appdetect.site',

    'https://aft.appdetect.site',
    'https://lz.appdetect.site',
    'https://zapspy-backend-production.up.railway.app',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5500'
];

if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    ALLOWED_ORIGINS.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
}
if (process.env.RAILWAY_STATIC_URL) {
    ALLOWED_ORIGINS.push(process.env.RAILWAY_STATIC_URL.startsWith('http') 
        ? process.env.RAILWAY_STATIC_URL 
        : `https://${process.env.RAILWAY_STATIC_URL}`);
}

const UPSELL_SQL = {
    up1: `(t.product ILIKE '%WT%' OR t.product ILIKE '%PPA253N2%' OR t.product ILIKE '%PPPBDG0I%' OR t.product ILIKE '%Recuperación Total%' OR t.product ILIKE '%PPPBEIE1%')`,

    up2: `(t.product ILIKE '%TND%' OR t.product ILIKE '%PPA253N3%' OR t.product ILIKE '%PPPBDG0J%' OR t.product ILIKE '%WT - ES%' OR t.product ILIKE '%PPPBDFO4%')`,

    up3: `(t.product ILIKE '%X AI - 3%' OR t.product ILIKE '%PPA253N4%' OR t.product ILIKE '%PPPBEIDH%' OR t.product ILIKE '%TND ES%' OR t.product ILIKE '%PPPBD9MQ%')`,

    up4: `(t.product ILIKE '%X AI - 4%' OR t.product ILIKE '%PPA253N5%' OR t.product ILIKE '%PPPBEIDL%' OR t.product ILIKE '%Manto Invisible%' OR t.product ILIKE '%PPPBEIE3%')`,

    up5: `(t.product ILIKE '%X AI - 5%' OR t.product ILIKE '%PPA253N6%' OR t.product ILIKE '%PPPBEIDM%' OR t.product ILIKE '%Sala en Vivo y Cámara%' OR t.product ILIKE '%PPPBEIE4%')`,

    up6: `(t.product ILIKE '%X AI - 6%' OR t.product ILIKE '%PPA253N7%' OR t.product ILIKE '%PPPBEIDN%' OR t.product ILIKE '%Multi-Dispositivo%' OR t.product ILIKE '%PPPBEIE8%')`,

    up7: `(t.product ILIKE '%X AI - 7%' OR t.product ILIKE '%PPA253N8%' OR t.product ILIKE '%PPPBEIDP%' OR t.product ILIKE '%Analista de Comportamiento%' OR t.product ILIKE '%PPPBEIE9%')`,

    front: `NOT (
        t.product ILIKE '%WT%' OR t.product ILIKE '%PPA253N2%' OR t.product ILIKE '%PPPBDG0I%' OR t.product ILIKE '%Recuperación Total%' OR t.product ILIKE '%PPPBEIE1%' OR
        t.product ILIKE '%TND%' OR t.product ILIKE '%PPA253N3%' OR t.product ILIKE '%PPPBDG0J%' OR t.product ILIKE '%WT - ES%' OR t.product ILIKE '%PPPBDFO4%' OR
        t.product ILIKE '%X AI - 3%' OR t.product ILIKE '%PPA253N4%' OR t.product ILIKE '%PPPBEIDH%' OR t.product ILIKE '%TND ES%' OR t.product ILIKE '%PPPBD9MQ%' OR
        t.product ILIKE '%X AI - 4%' OR t.product ILIKE '%PPA253N5%' OR t.product ILIKE '%PPPBEIDL%' OR t.product ILIKE '%Manto Invisible%' OR t.product ILIKE '%PPPBEIE3%' OR
        t.product ILIKE '%X AI - 5%' OR t.product ILIKE '%PPA253N6%' OR t.product ILIKE '%PPPBEIDM%' OR t.product ILIKE '%Sala en Vivo y Cámara%' OR t.product ILIKE '%PPPBEIE4%' OR
        t.product ILIKE '%X AI - 6%' OR t.product ILIKE '%PPA253N7%' OR t.product ILIKE '%PPPBEIDN%' OR t.product ILIKE '%Multi-Dispositivo%' OR t.product ILIKE '%PPPBEIE8%' OR
        t.product ILIKE '%X AI - 7%' OR t.product ILIKE '%PPA253N8%' OR t.product ILIKE '%PPPBEIDP%' OR t.product ILIKE '%Analista de Comportamiento%' OR t.product ILIKE '%PPPBEIE9%'
    )`
};

const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID || '';
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || '';
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || '';
const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}`;

// ActiveCampaign Configuration
const AC_API_URL = process.env.AC_API_URL || 'https://draculatemer11258320.api-us1.com';
const AC_API_KEY = process.env.AC_API_KEY || '9437b06992638da05d3f1003f974a936eeddb5fdea800ad335ea1ce9bddff34b3f90d402';

// Supabase Auth (for auto-provisioning member area users on purchase)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const VALID_PRODUCT_CODES = [
    // PerfectPay English
    'PPA253N1', 'PPA253N2', 'PPA253N3', 'PPA253N4', 'PPA253N5', 'PPA253N6', 'PPA253N7', 'PPA253N8'
];

module.exports = {
    FB_PIXELS_BY_LANGUAGE,
    FB_PIXELS,
    FB_API_VERSION,
    ALLOWED_ORIGINS,
    UPSELL_SQL,
    ZAPI_INSTANCE,
    ZAPI_TOKEN,
    ZAPI_CLIENT_TOKEN,
    ZAPI_BASE_URL,
    VALID_PRODUCT_CODES,
    AC_API_URL,
    AC_API_KEY,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
};
