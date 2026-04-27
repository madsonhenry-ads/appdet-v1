const express = require('express');
const router = express.Router();
const pool = require('../database');
const { authenticateToken } = require('../middleware');
const { zapiSendText } = require('../services/zapi');

// ==================== RECOVERY CENTER API ====================

// Helper function to calculate recovery score
function calculateRecoveryScore(lead, segment) {
    let score = 0;
    const now = new Date();
    
    // 1. Time Score (30%) - More recent = higher score
    const eventTime = new Date(lead.last_event_at || lead.created_at);
    const hoursAgo = (now - eventTime) / (1000 * 60 * 60);
    let timeScore = 0;
    if (hoursAgo <= 1) timeScore = 30;
    else if (hoursAgo <= 6) timeScore = 27;
    else if (hoursAgo <= 24) timeScore = 24;
    else if (hoursAgo <= 48) timeScore = 20;
    else if (hoursAgo <= 72) timeScore = 15;
    else if (hoursAgo <= 168) timeScore = 10; // 7 days
    else timeScore = 5;
    
    // 2. Engagement Score (25%) - Based on funnel events
    const eventCount = parseInt(lead.event_count || 0);
    let engagementScore = Math.min(25, eventCount * 3);
    
    // 3. Value Score (20%) - Based on potential value
    const value = parseFloat(lead.potential_value || 47);
    let valueScore = 0;
    if (value >= 200) valueScore = 20;
    else if (value >= 100) valueScore = 17;
    else if (value >= 50) valueScore = 14;
    else if (value >= 30) valueScore = 10;
    else valueScore = 7;
    
    // 4. History Score (15%) - Has previous purchases
    const hasPurchase = lead.has_purchase === true || lead.has_purchase === 't';
    let historyScore = hasPurchase ? 15 : 5;
    
    // 5. Attempts Score (10%) - Fewer attempts = higher score
    const attempts = parseInt(lead.contact_attempts || 0);
    let attemptsScore = Math.max(0, 10 - (attempts * 2));
    
    score = timeScore + engagementScore + valueScore + historyScore + attemptsScore;
    
    return {
        total: Math.min(100, Math.round(score)),
        breakdown: {
            time: timeScore,
            engagement: engagementScore,
            value: valueScore,
            history: historyScore,
            attempts: attemptsScore
        }
    };
}

// Helper function for time ago formatting
function getTimeAgo(date) {
    if (!date) return 'N/A';
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem atrás`;
    return `${Math.floor(diffDays / 30)}m atrás`;
}

// Seed default recovery funnels if none exist
async function seedRecoveryFunnels() {
    try {
        // Ensure tables exist before seeding
        await pool.query(`CREATE TABLE IF NOT EXISTS recovery_funnels (
            id SERIAL PRIMARY KEY, segment VARCHAR(50) NOT NULL, name VARCHAR(100) NOT NULL,
            is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query(`CREATE TABLE IF NOT EXISTS recovery_funnel_steps (
            id SERIAL PRIMARY KEY, funnel_id INTEGER REFERENCES recovery_funnels(id) ON DELETE CASCADE,
            step_number INTEGER NOT NULL, delay_hours INTEGER DEFAULT 24,
            template_en TEXT NOT NULL, template_es TEXT NOT NULL,
            channel VARCHAR(20) DEFAULT 'whatsapp', created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query(`CREATE TABLE IF NOT EXISTS recovery_lead_progress (
            id SERIAL PRIMARY KEY, lead_email VARCHAR(255) NOT NULL,
            funnel_id INTEGER REFERENCES recovery_funnels(id) ON DELETE CASCADE,
            current_step INTEGER DEFAULT 0, status VARCHAR(20) DEFAULT 'active',
            next_contact_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(lead_email, funnel_id)
        )`);
        
        const existing = await pool.query('SELECT COUNT(*) as count FROM recovery_funnels');
        if (parseInt(existing.rows[0].count) > 0) return;
        
        const funnelSeeds = [
            {
                segment: 'lost_visitors',
                name: 'Lost Visitors Recovery',
                steps: [
                    { step: 1, delay: 0, en: "Hey {name}! 👋 I noticed you were checking out X AI Monitor earlier. Curious about what it does? It uses AI to monitor conversations and reveal what's really going on. Want me to show you how it works? 🔥", es: "¡Hola {name}! 👋 Vi que estabas mirando X AI Monitor. ¿Curioso por saber qué hace? Usa IA para monitorear conversaciones y revelar lo que realmente pasa. ¿Quieres que te muestre cómo funciona? 🔥" },
                    { step: 2, delay: 24, en: "Hi {name}! Just a quick follow-up — X AI Monitor has already helped thousands of people uncover hidden truths. Today only, you can try it for a special price. Want the link? 💰", es: "¡Hola {name}! Solo un seguimiento rápido — X AI Monitor ya ha ayudado a miles de personas a descubrir verdades ocultas. Solo por hoy, puedes probarlo a un precio especial. ¿Quieres el link? 💰" },
                    { step: 3, delay: 48, en: "Last chance, {name}! 🚨 We're closing registration for X AI Monitor soon. Don't miss your chance to discover the truth. This is your final opportunity at this price!", es: "¡Última oportunidad, {name}! 🚨 Estamos cerrando las inscripciones de X AI Monitor pronto. No pierdas tu chance de descubrir la verdad. ¡Esta es tu última oportunidad a este precio!" }
                ]
            },
            {
                segment: 'checkout_abandoned',
                name: 'Checkout Abandoned Recovery',
                steps: [
                    { step: 1, delay: 0, en: "Hey {name}! 👋 I noticed you were about to get X AI Monitor but didn't complete your purchase. Is there anything I can help with? Just wanted to let you know we have LIMITED spots available! 🔥", es: "¡Hola {name}! 👋 Vi que estabas por comprar X AI Monitor pero no completaste. ¿Hay algo en que pueda ayudarte? Solo quería avisarte que tenemos CUPOS LIMITADOS! 🔥" },
                    { step: 2, delay: 24, en: "Hi {name}! 🎁 I have a special offer just for you: Get 50% OFF on X AI Monitor for the next 24 hours! Use this exclusive link: [LINK]. Don't let this opportunity slip away!", es: "¡Hola {name}! 🎁 Tengo una oferta especial solo para ti: ¡50% DE DESCUENTO en X AI Monitor por las próximas 24 horas! Usa este link exclusivo: [LINK]. ¡No dejes escapar esta oportunidad!" },
                    { step: 3, delay: 48, en: "Hey {name}! 👋 Just checking in — is there anything stopping you from trying X AI Monitor? Any questions about how it works? I'm here to help! 😊", es: "¡Hola {name}! 👋 Solo quería saber — ¿hay algo que te impida probar X AI Monitor? ¿Alguna pregunta sobre cómo funciona? ¡Estoy aquí para ayudar! 😊" },
                    { step: 4, delay: 72, en: "Final notice, {name}! ⏰ Your exclusive discount for X AI Monitor expires TODAY. After this, it goes back to full price. This is your last chance — grab it now!", es: "¡Último aviso, {name}! ⏰ Tu descuento exclusivo de X AI Monitor expira HOY. Después de esto, vuelve al precio completo. Esta es tu última oportunidad — ¡aprovéchala ahora!" }
                ]
            },
            {
                segment: 'payment_failed',
                name: 'Payment Failed Recovery',
                steps: [
                    { step: 1, delay: 0, en: "Hi {name}! I noticed there was an issue with your payment for {product}. Sometimes this happens due to bank limits. Would you like to try again with a different card or payment method? I can help! 💳", es: "¡Hola {name}! Vi que hubo un problema con tu pago de {product}. A veces esto pasa por límites del banco. ¿Te gustaría intentar con otra tarjeta o método de pago? ¡Puedo ayudarte! 💳" },
                    { step: 2, delay: 24, en: "Hey {name}! Your payment for {product} didn't go through. No worries! We have alternative payment options (PayPal, different cards). Would you like me to send you a new payment link? 🔄", es: "¡Hola {name}! Tu pago de {product} no se procesó. ¡No te preocupes! Tenemos opciones de pago alternativas (PayPal, otras tarjetas). ¿Te gustaría que te envíe otro link de pago? 🔄" },
                    { step: 3, delay: 48, en: "Hi {name}! Just following up on your payment for {product}. I really don't want you to miss out! As a goodwill gesture, I can offer you a 20% discount if you complete your purchase today. Want the link? 🎁", es: "¡Hola {name}! Solo dando seguimiento a tu pago de {product}. ¡Realmente no quiero que te lo pierdas! Como gesto de buena voluntad, puedo ofrecerte un 20% de descuento si completas tu compra hoy. ¿Quieres el link? 🎁" }
                ]
            },
            {
                segment: 'refund_requests',
                name: 'Refund Prevention',
                steps: [
                    { step: 1, delay: 0, en: "Hi {name}! I received your refund request. Before we proceed, I'd love to understand what happened. Was there something that didn't meet your expectations? Maybe I can help solve it! 🤝", es: "¡Hola {name}! Recibí tu solicitud de reembolso. Antes de proceder, me gustaría entender qué pasó. ¿Hubo algo que no cumplió tus expectativas? ¡Tal vez pueda ayudar a resolverlo! 🤝" },
                    { step: 2, delay: 24, en: "Hey {name}! Many customers had similar concerns about {product} but after a quick tutorial, they loved the results! Would you give me 5 minutes to show you how to get the best out of it? I have some exclusive tips! 🎯", es: "¡Hola {name}! Muchos clientes tenían dudas similares sobre {product} pero después de un tutorial rápido, ¡amaron los resultados! ¿Me darías 5 minutos para mostrarte cómo aprovecharlo al máximo? ¡Tengo tips exclusivos! 🎯" },
                    { step: 3, delay: 48, en: "Hi {name}! I understand if {product} isn't for you. But before you go, would you consider a partial refund + VIP support access? I want to make sure you get real value from your investment. What do you think? 💬", es: "¡Hola {name}! Entiendo si {product} no es para ti. Pero antes de irte, ¿considerarías un reembolso parcial + acceso a soporte VIP? Quiero asegurarme de que obtengas valor real de tu inversión. ¿Qué te parece? 💬" }
                ]
            },
            {
                segment: 'upsell_declined',
                name: 'Upsell Recovery',
                steps: [
                    { step: 1, delay: 0, en: "Hi {name}! Congrats on your purchase! 🎉 I noticed you didn't add {product} to your order. Did you know it can unlock advanced features? I have a special 30% discount just for you!", es: "¡Hola {name}! ¡Felicidades por tu compra! 🎉 Vi que no agregaste {product} a tu pedido. ¿Sabías que puede desbloquear funciones avanzadas? ¡Tengo un descuento especial del 30% solo para ti!" },
                    { step: 2, delay: 48, en: "Hey {name}! Quick question: Would you be interested in adding {product} to your X AI Monitor for a special bundle price? It's way more powerful together! 🚀 Only a few spots left at this price.", es: "¡Hola {name}! Pregunta rápida: ¿Te interesaría agregar {product} a tu X AI Monitor por un precio especial de combo? ¡Es mucho más poderoso junto! 🚀 Solo quedan pocos cupos a este precio." },
                    { step: 3, delay: 96, en: "Last chance, {name}! The exclusive bundle deal for {product} expires soon. After this, it goes back to full price ($67). Grab it now at 30% OFF: [LINK] ⏰", es: "¡Última oportunidad, {name}! La oferta exclusiva de combo de {product} expira pronto. Después, vuelve al precio completo ($67). Aprovéchalo ahora con 30% DE DESCUENTO: [LINK] ⏰" }
                ]
            }
        ];
        
        for (const funnel of funnelSeeds) {
            const funnelResult = await pool.query(
                'INSERT INTO recovery_funnels (segment, name) VALUES ($1, $2) RETURNING id',
                [funnel.segment, funnel.name]
            );
            const funnelId = funnelResult.rows[0].id;
            
            for (const step of funnel.steps) {
                await pool.query(
                    'INSERT INTO recovery_funnel_steps (funnel_id, step_number, delay_hours, template_en, template_es) VALUES ($1, $2, $3, $4, $5)',
                    [funnelId, step.step, step.delay, step.en, step.es]
                );
            }
        }
        
        console.log('Recovery funnels seeded successfully');
    } catch (error) {
        console.error('Error seeding recovery funnels:', error);
    }
}

// Get recovery segments summary
router.get('/api/admin/recovery/segments', authenticateToken, async (req, res) => {
    try {
        const { language, startDate, endDate } = req.query;
        
        const allowedLanguages = ['en', 'es', 'pt', 'pt-BR'];
        const safeLanguage = (language && allowedLanguages.includes(language)) ? language : null;
        
        function buildParams(baseParams, addLang, langPrefix, addDate, datePrefix) {
            const params = [];
            let langFilter = '';
            let dateFilter = '';
            let idx = 1;
            if (addLang && safeLanguage) {
                langFilter = `AND ${langPrefix}funnel_language = $${idx}`;
                params.push(safeLanguage);
                idx++;
            }
            if (addDate && startDate && endDate) {
                dateFilter = `AND ${datePrefix}created_at >= $${idx} AND ${datePrefix}created_at <= $${idx + 1}`;
                params.push(startDate, endDate + ' 23:59:59');
                idx += 2;
            }
            return { params, langFilter, dateFilter, nextIdx: idx };
        }
        
        // 1. Lost Visitors
        const lv = buildParams([], true, 'l.', true, 'fe.');
        const lostVisitors = await pool.query(`
            SELECT COUNT(DISTINCT fe.visitor_id) as count
            FROM funnel_events fe
            LEFT JOIN leads l ON fe.visitor_id = l.visitor_id
            WHERE fe.event IN ('page_view', 'landing_visit', 'phone_submitted', 'cta_clicked')
            ${lv.langFilter}
            AND NOT EXISTS (
                SELECT 1 FROM funnel_events fe2
                WHERE fe2.visitor_id = fe.visitor_id
                AND fe2.event = 'checkout_clicked'
            )
            AND NOT EXISTS (
                SELECT 1 FROM transactions t
                WHERE LOWER(t.email) = LOWER(COALESCE(l.email, ''))
                AND t.status = 'approved'
            )
            AND NOT EXISTS (
                SELECT 1 FROM recovery_contacts rc
                WHERE LOWER(rc.lead_email) = LOWER(COALESCE(l.email, ''))
                AND rc.lead_email != ''
            )
            ${lv.dateFilter}
        `, lv.params);
        
        // 2. Checkout Abandoned
        const ca = buildParams([], true, 'l.', true, 'fe.');
        const checkoutAbandoned = await pool.query(`
            SELECT COUNT(DISTINCT fe.visitor_id) as count
            FROM funnel_events fe
            LEFT JOIN leads l ON fe.visitor_id = l.visitor_id
            WHERE fe.event = 'checkout_clicked'
            ${ca.langFilter}
            AND NOT EXISTS (
                SELECT 1 FROM transactions t 
                WHERE LOWER(t.email) = LOWER(COALESCE(l.email, ''))
                AND t.status = 'approved'
            )
            AND NOT EXISTS (
                SELECT 1 FROM recovery_contacts rc
                WHERE LOWER(rc.lead_email) = LOWER(COALESCE(l.email, ''))
                AND rc.lead_email != ''
            )
            ${ca.dateFilter}
        `, ca.params);
        
        // 3. Payment Failed
        const pf = buildParams([], true, 't.', true, '');
        const paymentFailed = await pool.query(`
            SELECT COUNT(*) as count, COALESCE(SUM(value_brl), 0) as total_value
            FROM (
                SELECT DISTINCT ON (LOWER(t.email)) t.email,
                    CASE 
                        WHEN t.funnel_source = 'perfectpay' THEN CAST(t.value AS DECIMAL) * ${1 / parseFloat(process.env.CONVERSION_BRL_TO_USD || '0.18')}
                        ELSE CAST(t.value AS DECIMAL)
                    END as value_brl
                FROM transactions t
                WHERE t.status IN ('cancelled', 'refused')
                AND t.email IS NOT NULL AND t.email != ''
                ${pf.langFilter}
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%vault%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%360%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%tracker%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%instant%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%recuperaci%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%visi_n%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%sin espera%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%priority%'
                AND NOT EXISTS (
                    SELECT 1 FROM transactions t2 
                    WHERE LOWER(t2.email) = LOWER(t.email) AND t2.status = 'approved'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM recovery_contacts rc
                    WHERE LOWER(rc.lead_email) = LOWER(t.email)
                )
                ${pf.dateFilter}
                ORDER BY LOWER(t.email), t.created_at DESC
            ) sub
        `, pf.params);
        
        // 4. Refund Requests
        const rr = buildParams([], true, '', true, '');
        const refundRequests = await pool.query(`
            SELECT COUNT(*) as count, COALESCE(SUM(CAST(value AS DECIMAL)), 0) as total_value
            FROM refund_requests
            WHERE status IN ('pending', 'handling', 'processing')
            ${rr.langFilter}
            ${rr.dateFilter}
        `, rr.params);
        
        // 5. Upsell Declined
        const ud = buildParams([], true, 'l.', true, 'fe.');
        const upsellDeclined = await pool.query(`
            SELECT COUNT(DISTINCT fe.visitor_id) as count
            FROM funnel_events fe
            INNER JOIN leads l ON fe.visitor_id = l.visitor_id
            WHERE fe.event LIKE '%_declined'
            ${ud.langFilter}
            AND EXISTS (
                SELECT 1 FROM transactions t 
                WHERE LOWER(t.email) = LOWER(l.email)
                AND t.status = 'approved'
            )
            ${ud.dateFilter}
        `, ud.params);
        
        // USD to BRL rate from env (inverse of BRL_TO_USD)
        const USD_TO_BRL = 1 / parseFloat(process.env.CONVERSION_BRL_TO_USD || '0.18');
        
        // Correct front product prices in USD (EN=$37, ES=$27)
        const frontPriceEN = 37 * USD_TO_BRL;
        const frontPriceES = 27 * USD_TO_BRL;
        const frontPrice = language === 'es' ? frontPriceES : language === 'en' ? frontPriceEN : ((frontPriceEN + frontPriceES) / 2);
        
        // Average upsell price in USD (~$47 average across upsells)
        const upsellPrice = 47 * USD_TO_BRL;
        
        const lostCount = parseInt(lostVisitors.rows[0]?.count || 0);
        const checkoutCount = parseInt(checkoutAbandoned.rows[0]?.count || 0);
        const paymentCount = parseInt(paymentFailed.rows[0]?.count || 0);
        const refundCount = parseInt(refundRequests.rows[0]?.count || 0);
        const upsellCount = parseInt(upsellDeclined.rows[0]?.count || 0);
        
        // payment_failed: values already calculated in BRL in the query (Monetizze=BRL, PerfectPay=USD*rate)
        const paymentValue = parseFloat(paymentFailed.rows[0]?.total_value || 0);
        // refund_requests: values stored in BRL from Monetizze transactions - no conversion needed
        const refundValue = parseFloat(refundRequests.rows[0]?.total_value || 0);
        
        res.json({
            segments: {
                lost_visitors: {
                    count: lostCount,
                    potential_value: lostCount * frontPrice,
                    label: 'Lost Visitors',
                    label_es: 'Visitantes Perdidos',
                    icon: '👻',
                    color: '#a855f7'
                },
                checkout_abandoned: {
                    count: checkoutCount,
                    potential_value: checkoutCount * frontPrice,
                    label: 'Checkout Abandoned',
                    label_es: 'Checkout Abandonado',
                    icon: '🛒',
                    color: '#f59e0b'
                },
                payment_failed: {
                    count: paymentCount,
                    potential_value: paymentValue,
                    label: 'Payment Failed',
                    label_es: 'Pagamentos Recusados',
                    icon: '💳',
                    color: '#ef4444'
                },
                refund_requests: {
                    count: refundCount,
                    potential_value: refundValue,
                    label: 'Refund Requests',
                    label_es: 'Pedidos Reembolso',
                    icon: '💸',
                    color: '#f97316'
                },
                upsell_declined: {
                    count: upsellCount,
                    potential_value: upsellCount * upsellPrice,
                    label: 'Upsell Declined',
                    label_es: 'Recusas Upsell',
                    icon: '📦',
                    color: '#3b82f6'
                }
            },
            totals: {
                count: lostCount + checkoutCount + paymentCount + refundCount + upsellCount,
                potential_value: (lostCount * frontPrice) + (checkoutCount * frontPrice) + paymentValue + refundValue + (upsellCount * upsellPrice)
            }
        });
        
    } catch (error) {
        console.error('Error fetching recovery segments:', error);
        res.status(500).json({ error: 'Failed to fetch recovery segments' });
    }
});

// Get leads for a specific recovery segment
router.get('/api/admin/recovery/:segment', authenticateToken, async (req, res, next) => {
    // Skip known named routes so they can be handled by their specific handlers
    const reservedRoutes = ['segments', 'funnels', 'templates', 'stats', 'funnel', 'contact', 'dispatch-log', 'dispatch-resend'];
    if (reservedRoutes.includes(req.params.segment)) {
        return next();
    }
    
    try {
        const { segment } = req.params;
        const { language, startDate, endDate, minScore, contactStatus, sortBy, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let leads = [];
        let totalCount = 0;
        
        const allowedLanguages = ['en', 'es', 'pt', 'pt-BR'];
        const safeLanguage = (language && allowedLanguages.includes(language)) ? language : null;
        
        // Ensure recovery_contacts table exists before queries
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recovery_contacts (
                id SERIAL PRIMARY KEY,
                lead_email VARCHAR(255) NOT NULL,
                segment VARCHAR(50) NOT NULL,
                template_used VARCHAR(100),
                channel VARCHAR(20) DEFAULT 'whatsapp',
                message TEXT,
                status VARCHAR(20) DEFAULT 'sent',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        function buildSegmentFilters(langCol, dateCol) {
            const params = [];
            let langFilter = '';
            let dateFilter = '';
            let idx = 1;
            if (safeLanguage) {
                langFilter = `AND ${langCol} = $${idx}`;
                params.push(safeLanguage);
                idx++;
            }
            if (startDate && endDate) {
                dateFilter = `AND ${dateCol} >= $${idx} AND ${dateCol} <= $${idx + 1}`;
                params.push(startDate, endDate + ' 23:59:59');
                idx += 2;
            }
            return { params, langFilter, dateFilter, nextIdx: idx };
        }
        
        if (segment === 'lost_visitors') {
            const f = buildSegmentFilters('l.funnel_language', 'fe.created_at');
            const limitIdx = f.nextIdx;
            const offsetIdx = f.nextIdx + 1;
            const result = await pool.query(`
                SELECT DISTINCT ON (COALESCE(l.email, fe.visitor_id))
                    COALESCE(l.id, 0) as id,
                    COALESCE(l.email, '') as email,
                    COALESCE(l.name, 'Visitor') as name,
                    COALESCE(l.whatsapp, '') as phone,
                    COALESCE(l.country, '') as country,
                    COALESCE(l.country_code, '') as country_code,
                    l.funnel_language as language,
                    fe.created_at as last_event_at,
                    fe.event,
                    (CASE WHEN l.funnel_language = 'es' THEN 27.00 ELSE 37.00 END * ${1 / parseFloat(process.env.CONVERSION_BRL_TO_USD || '0.18')}) as potential_value,
                    CASE WHEN l.funnel_language = 'es' THEN 'Detector de Infidelidad' ELSE 'X AI Monitor' END as product,
                    (SELECT COUNT(*) FROM funnel_events fe3 WHERE fe3.visitor_id = fe.visitor_id) as event_count,
                    false as has_purchase,
                    0 as contact_attempts,
                    NULL as last_contact
                FROM funnel_events fe
                LEFT JOIN leads l ON fe.visitor_id = l.visitor_id
                WHERE fe.event IN ('page_view', 'landing_visit', 'phone_submitted', 'cta_clicked')
                ${f.langFilter}
                AND NOT EXISTS (
                    SELECT 1 FROM funnel_events fe2
                    WHERE fe2.visitor_id = fe.visitor_id
                    AND fe2.event = 'checkout_clicked'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM transactions t
                    WHERE LOWER(t.email) = LOWER(COALESCE(l.email, ''))
                    AND t.status = 'approved'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM recovery_contacts rc
                    WHERE LOWER(rc.lead_email) = LOWER(COALESCE(l.email, ''))
                    AND rc.lead_email != ''
                )
                ${f.dateFilter}
                ORDER BY COALESCE(l.email, fe.visitor_id), fe.created_at DESC
                LIMIT $${limitIdx} OFFSET $${offsetIdx}
            `, [...f.params, parseInt(limit), offset]);
            
            leads = result.rows;
            
            const countResult = await pool.query(`
                SELECT COUNT(DISTINCT COALESCE(l.email, fe.visitor_id)) as count
                FROM funnel_events fe
                LEFT JOIN leads l ON fe.visitor_id = l.visitor_id
                WHERE fe.event IN ('page_view', 'landing_visit', 'phone_submitted', 'cta_clicked')
                ${f.langFilter}
                AND NOT EXISTS (
                    SELECT 1 FROM funnel_events fe2
                    WHERE fe2.visitor_id = fe.visitor_id
                    AND fe2.event = 'checkout_clicked'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM transactions t
                    WHERE LOWER(t.email) = LOWER(COALESCE(l.email, ''))
                    AND t.status = 'approved'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM recovery_contacts rc
                    WHERE LOWER(rc.lead_email) = LOWER(COALESCE(l.email, ''))
                    AND rc.lead_email != ''
                )
                ${f.dateFilter}
            `, f.params);
            totalCount = parseInt(countResult.rows[0]?.count || 0);
            
        } else if (segment === 'checkout_abandoned') {
            const f = buildSegmentFilters('l.funnel_language', 'fe.created_at');
            const limitIdx = f.nextIdx;
            const offsetIdx = f.nextIdx + 1;
            const result = await pool.query(`
                SELECT DISTINCT ON (COALESCE(l.email, fe.visitor_id))
                    COALESCE(l.id, 0) as id,
                    COALESCE(l.email, '') as email,
                    COALESCE(l.name, 'Visitor') as name,
                    COALESCE(l.whatsapp, '') as phone,
                    COALESCE(l.country, '') as country,
                    COALESCE(l.country_code, '') as country_code,
                    l.funnel_language as language,
                    fe.created_at as last_event_at,
                    'checkout_clicked' as event,
                    (CASE WHEN l.funnel_language = 'es' THEN 27.00 ELSE 37.00 END * ${1 / parseFloat(process.env.CONVERSION_BRL_TO_USD || '0.18')}) as potential_value,
                    CASE WHEN l.funnel_language = 'es' THEN 'Detector de Infidelidad' ELSE 'X AI Monitor' END as product,
                    1 as event_count,
                    false as has_purchase,
                    0 as contact_attempts,
                    NULL as last_contact
                FROM funnel_events fe
                LEFT JOIN leads l ON fe.visitor_id = l.visitor_id
                WHERE fe.event = 'checkout_clicked'
                ${f.langFilter}
                AND NOT EXISTS (
                    SELECT 1 FROM transactions t 
                    WHERE LOWER(t.email) = LOWER(COALESCE(l.email, ''))
                    AND t.status = 'approved'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM recovery_contacts rc
                    WHERE LOWER(rc.lead_email) = LOWER(COALESCE(l.email, ''))
                    AND rc.lead_email != ''
                )
                ${f.dateFilter}
                ORDER BY COALESCE(l.email, fe.visitor_id), fe.created_at DESC
                LIMIT $${limitIdx} OFFSET $${offsetIdx}
            `, [...f.params, parseInt(limit), offset]);
            
            leads = result.rows;
            
            const countResult = await pool.query(`
                SELECT COUNT(DISTINCT COALESCE(l.email, fe.visitor_id)) as count
                FROM funnel_events fe
                LEFT JOIN leads l ON fe.visitor_id = l.visitor_id
                WHERE fe.event = 'checkout_clicked'
                ${f.langFilter}
                AND NOT EXISTS (
                    SELECT 1 FROM transactions t 
                    WHERE LOWER(t.email) = LOWER(COALESCE(l.email, ''))
                    AND t.status = 'approved'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM recovery_contacts rc
                    WHERE LOWER(rc.lead_email) = LOWER(COALESCE(l.email, ''))
                    AND rc.lead_email != ''
                )
                ${f.dateFilter}
            `, f.params);
            totalCount = parseInt(countResult.rows[0]?.count || 0);
            
        } else if (segment === 'payment_failed') {
            const usdToBrlRate = 1 / parseFloat(process.env.CONVERSION_BRL_TO_USD || '0.18');
            const f = buildSegmentFilters('t.funnel_language', 't.created_at');
            const result = await pool.query(`
                SELECT DISTINCT ON (LOWER(t.email))
                    t.id,
                    t.email,
                    t.name,
                    COALESCE(l.whatsapp, t.phone, '') as phone,
                    COALESCE(l.country, '') as country,
                    COALESCE(l.country_code, '') as country_code,
                    t.funnel_language as language,
                    t.created_at as last_event_at,
                    t.status as event,
                    CASE 
                        WHEN t.funnel_source = 'perfectpay' THEN CAST(t.value AS DECIMAL) * ${usdToBrlRate}
                        ELSE CAST(t.value AS DECIMAL)
                    END as potential_value,
                    t.product,
                    (SELECT COUNT(*) FROM transactions t2 WHERE LOWER(t2.email) = LOWER(t.email) AND t2.status IN ('cancelled', 'refused')) as event_count,
                    false as has_purchase,
                    0 as contact_attempts,
                    NULL as last_contact
                FROM transactions t
                LEFT JOIN leads l ON LOWER(t.email) = LOWER(l.email)
                WHERE t.status IN ('cancelled', 'refused')
                AND t.email IS NOT NULL AND t.email != ''
                ${f.langFilter}
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%vault%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%360%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%tracker%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%instant%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%recuperaci%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%visi_n%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%sin espera%'
                AND LOWER(COALESCE(t.product, '')) NOT LIKE '%priority%'
                AND NOT EXISTS (
                    SELECT 1 FROM transactions t3
                    WHERE LOWER(t3.email) = LOWER(t.email) AND t3.status = 'approved'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM recovery_contacts rc
                    WHERE LOWER(rc.lead_email) = LOWER(t.email)
                )
                ${f.dateFilter}
                ORDER BY LOWER(t.email), t.created_at DESC
            `, f.params);
            
            totalCount = result.rows.length;
            leads = result.rows.slice(offset, offset + parseInt(limit));
            
        } else if (segment === 'refund_requests') {
            const f = buildSegmentFilters('r.funnel_language', 'r.created_at');
            const limitIdx = f.nextIdx;
            const offsetIdx = f.nextIdx + 1;
            const result = await pool.query(`
                SELECT 
                    r.id,
                    r.email,
                    r.full_name as name,
                    r.phone,
                    '' as country,
                    '' as country_code,
                    r.funnel_language as language,
                    r.created_at as last_event_at,
                    r.reason as event,
                    CAST(r.value AS DECIMAL) as potential_value,
                    r.product,
                    1 as event_count,
                    true as has_purchase,
                    0 as contact_attempts,
                    NULL as last_contact,
                    r.status as refund_status,
                    r.protocol
                FROM refund_requests r
                WHERE r.status IN ('pending', 'handling', 'processing')
                ${f.langFilter}
                ${f.dateFilter}
                ORDER BY r.created_at DESC
                LIMIT $${limitIdx} OFFSET $${offsetIdx}
            `, [...f.params, parseInt(limit), offset]);
            
            leads = result.rows;
            
            const fc = buildSegmentFilters('funnel_language', 'created_at');
            const countResult = await pool.query(`
                SELECT COUNT(*) as count FROM refund_requests
                WHERE status IN ('pending', 'handling', 'processing')
                ${fc.langFilter}
                ${fc.dateFilter}
            `, fc.params);
            totalCount = parseInt(countResult.rows[0]?.count || 0);
            
        } else if (segment === 'upsell_declined') {
            const f = buildSegmentFilters('l.funnel_language', 'fe.created_at');
            const limitIdx = f.nextIdx;
            const offsetIdx = f.nextIdx + 1;
            const result = await pool.query(`
                SELECT DISTINCT ON (l.email)
                    l.id,
                    l.email,
                    l.name,
                    COALESCE(l.whatsapp, '') as phone,
                    COALESCE(l.country, '') as country,
                    COALESCE(l.country_code, '') as country_code,
                    l.funnel_language as language,
                    fe.created_at as last_event_at,
                    fe.event,
                    (47.00 * ${1 / parseFloat(process.env.CONVERSION_BRL_TO_USD || '0.18')}) as potential_value,
                    CASE 
                        WHEN fe.event LIKE 'upsell_1%' THEN 'Message Vault'
                        WHEN fe.event LIKE 'upsell_2%' THEN '360 Tracker'
                        WHEN fe.event LIKE 'upsell_3%' THEN 'VIP Priority'
                        ELSE 'Upsell'
                    END as product,
                    1 as event_count,
                    true as has_purchase,
                    0 as contact_attempts,
                    NULL as last_contact
                FROM funnel_events fe
                INNER JOIN leads l ON fe.visitor_id = l.visitor_id
                WHERE fe.event LIKE '%_declined'
                ${f.langFilter}
                AND EXISTS (
                    SELECT 1 FROM transactions t 
                    WHERE LOWER(t.email) = LOWER(l.email)
                    AND t.status = 'approved'
                )
                ${f.dateFilter}
                ORDER BY l.email, fe.created_at DESC
                LIMIT $${limitIdx} OFFSET $${offsetIdx}
            `, [...f.params, parseInt(limit), offset]);
            
            leads = result.rows;
            
            const countResult = await pool.query(`
                SELECT COUNT(DISTINCT l.email) as count
                FROM funnel_events fe
                INNER JOIN leads l ON fe.visitor_id = l.visitor_id
                WHERE fe.event LIKE '%_declined'
                ${f.langFilter}
                AND EXISTS (
                    SELECT 1 FROM transactions t 
                    WHERE LOWER(t.email) = LOWER(l.email)
                    AND t.status = 'approved'
                )
                ${f.dateFilter}
            `, f.params);
            totalCount = parseInt(countResult.rows[0]?.count || 0);
            
        } else {
            return res.status(400).json({ error: 'Invalid segment' });
        }
        
        // Calculate scores for each lead
        const leadsWithScores = leads.map(lead => {
            const scoreData = calculateRecoveryScore(lead, segment);
            return {
                ...lead,
                score: scoreData.total,
                score_breakdown: scoreData.breakdown,
                time_ago: getTimeAgo(lead.last_event_at)
            };
        });
        
        // Filter by minimum score if specified
        let filteredLeads = leadsWithScores;
        if (minScore) {
            filteredLeads = leadsWithScores.filter(l => l.score >= parseInt(minScore));
        }
        
        // Filter by contact status if specified
        if (contactStatus === 'not_contacted') {
            filteredLeads = filteredLeads.filter(l => l.contact_attempts === 0);
        } else if (contactStatus === 'contacted') {
            filteredLeads = filteredLeads.filter(l => l.contact_attempts > 0);
        }
        
        // Sort leads
        if (sortBy === 'score') {
            filteredLeads.sort((a, b) => b.score - a.score);
        } else if (sortBy === 'value') {
            filteredLeads.sort((a, b) => b.potential_value - a.potential_value);
        }
        // Default is already sorted by time (most recent first)
        
        res.json({
            segment: segment,
            leads: filteredLeads,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                totalPages: Math.ceil(totalCount / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Error fetching recovery segment leads:', error);
        res.status(500).json({ error: 'Failed to fetch recovery leads' });
    }
});

// Register a recovery contact attempt
router.post('/api/admin/recovery/contact', authenticateToken, async (req, res) => {
    try {
        const { email, segment, template, channel, message } = req.body;
        
        if (!email || !segment) {
            return res.status(400).json({ error: 'Email and segment are required' });
        }
        
        const result = await pool.query(`
            INSERT INTO recovery_contacts (lead_email, segment, template_used, channel, message, status, created_at)
            VALUES ($1, $2, $3, $4, $5, 'sent', NOW())
            RETURNING *
        `, [email, segment, template || null, channel || 'whatsapp', message || null]);
        
        res.json({
            success: true,
            contact: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error registering recovery contact:', error);
        res.status(500).json({ error: 'Failed to register contact' });
    }
});

// Update recovery contact status (responded, converted)
router.put('/api/admin/recovery/contact/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!['sent', 'responded', 'converted'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const result = await pool.query(`
            UPDATE recovery_contacts SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *
        `, [status, id]);
        
        res.json({ success: true, contact: result.rows[0] });
        
    } catch (error) {
        console.error('Error updating recovery contact:', error);
        res.status(500).json({ error: 'Failed to update contact' });
    }
});

// ==================== RECOVERY FUNNEL SYSTEM ====================

// Get all recovery funnels with steps
router.get('/api/admin/recovery/funnels', authenticateToken, async (req, res) => {
    try {
        await seedRecoveryFunnels();
        
        const funnels = await pool.query(`
            SELECT f.*, 
                   json_agg(json_build_object(
                       'id', s.id, 'step_number', s.step_number, 'delay_hours', s.delay_hours,
                       'template_en', s.template_en, 'template_es', s.template_es, 'channel', s.channel
                   ) ORDER BY s.step_number) as steps
            FROM recovery_funnels f
            LEFT JOIN recovery_funnel_steps s ON f.id = s.funnel_id
            GROUP BY f.id
            ORDER BY f.id
        `);
        
        res.json({ funnels: funnels.rows });
    } catch (error) {
        console.error('Error fetching recovery funnels:', error);
        res.status(500).json({ error: 'Failed to fetch funnels' });
    }
});

// Get funnel progress for a specific lead
router.get('/api/admin/recovery/funnel/progress/:email', authenticateToken, async (req, res) => {
    try {
        const { email } = req.params;
        
        const progress = await pool.query(`
            SELECT p.*, f.name as funnel_name, f.segment,
                   (SELECT COUNT(*) FROM recovery_funnel_steps WHERE funnel_id = f.id) as total_steps,
                   (SELECT json_agg(json_build_object(
                       'id', s.id, 'step_number', s.step_number, 'delay_hours', s.delay_hours,
                       'template_en', s.template_en, 'template_es', s.template_es
                   ) ORDER BY s.step_number) FROM recovery_funnel_steps s WHERE s.funnel_id = f.id) as steps
            FROM recovery_lead_progress p
            JOIN recovery_funnels f ON p.funnel_id = f.id
            WHERE p.lead_email = $1
            ORDER BY p.updated_at DESC
        `, [email]);
        
        // Also get contact history
        const contacts = await pool.query(`
            SELECT * FROM recovery_contacts
            WHERE lead_email = $1
            ORDER BY created_at DESC
        `, [email]);
        
        res.json({
            progress: progress.rows,
            contacts: contacts.rows
        });
    } catch (error) {
        console.error('Error fetching lead progress:', error);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});

// Advance lead to next funnel step (1-click dispatch)
router.post('/api/admin/recovery/funnel/advance', authenticateToken, async (req, res) => {
    try {
        const { email, segment, name, phone, product, language, customMessage } = req.body;
        
        if (!email || !segment) {
            return res.status(400).json({ error: 'Email e segmento são obrigatórios' });
        }
        
        // Ensure funnels are seeded
        await seedRecoveryFunnels();
        
        // Get the funnel for this segment
        const funnelResult = await pool.query(
            'SELECT * FROM recovery_funnels WHERE segment = $1 AND is_active = true LIMIT 1',
            [segment]
        );
        
        if (funnelResult.rows.length === 0) {
            return res.status(404).json({ error: 'Nenhum funil ativo para este segmento' });
        }
        
        const funnel = funnelResult.rows[0];
        
        // Get or create lead progress
        let progressResult = await pool.query(
            'SELECT * FROM recovery_lead_progress WHERE lead_email = $1 AND funnel_id = $2',
            [email, funnel.id]
        );
        
        let currentStep = 0;
        if (progressResult.rows.length > 0) {
            currentStep = progressResult.rows[0].current_step;
        }
        
        const nextStep = currentStep + 1;
        
        // Get the next step template
        const stepResult = await pool.query(
            'SELECT * FROM recovery_funnel_steps WHERE funnel_id = $1 AND step_number = $2',
            [funnel.id, nextStep]
        );
        
        if (stepResult.rows.length === 0) {
            return res.status(400).json({ error: 'Lead já completou todos os passos do funil', completed: true });
        }
        
        const step = stepResult.rows[0];
        const totalSteps = await pool.query('SELECT COUNT(*) as count FROM recovery_funnel_steps WHERE funnel_id = $1', [funnel.id]);
        
        // Use custom message if provided, otherwise get from template
        const lang = language || 'en';
        let message;
        if (customMessage && customMessage.trim()) {
            message = customMessage.trim();
        } else {
            message = lang === 'es' ? step.template_es : step.template_en;
            message = message.replace(/\{name\}/g, name || 'there');
            message = message.replace(/\{product\}/g, product || 'X AI Monitor');
        }
        
        // Update or insert progress
        const delayHours = parseInt(step.delay_hours) || 24;
        if (progressResult.rows.length > 0) {
            await pool.query(
                `UPDATE recovery_lead_progress SET current_step = $1, updated_at = NOW(), next_contact_at = NOW() + interval '1 hour' * $2 WHERE lead_email = $3 AND funnel_id = $4`,
                [nextStep, delayHours, email, funnel.id]
            );
        } else {
            await pool.query(
                `INSERT INTO recovery_lead_progress (lead_email, funnel_id, current_step, status, next_contact_at) VALUES ($1, $2, $3, 'active', NOW() + interval '1 hour' * $4)`,
                [email, funnel.id, nextStep, delayHours]
            );
        }
        
        // Send message automatically via Z-API
        const cleanPhone = (phone || '').replace(/\D/g, '');
        let sendResult = { sent: false, error: null };
        
        if (cleanPhone && cleanPhone.length >= 10) {
            try {
                const result = await zapiSendText(cleanPhone, message);
                
                if (result.ok && result.data.messageId) {
                    sendResult = { sent: true, messageId: result.data.messageId, zaapId: result.data.zaapId };
                    console.log(`✅ Recovery message sent to ${cleanPhone} (Step ${nextStep}) - ID: ${result.data.messageId}`);
                    
                    try {
                        await pool.query(`
                            INSERT INTO whatsapp_messages (phone, message, message_id, zaap_id, status, sent_by, created_at)
                            VALUES ($1, $2, $3, $4, 'sent', 'recovery_funnel', NOW())
                        `, [cleanPhone, message, result.data.messageId, result.data.zaapId]);
                    } catch (dbErr) {
                        console.log('WhatsApp message log skipped:', dbErr.message);
                    }
                } else {
                    sendResult = { sent: false, error: 'Todas as instâncias Z-API falharam' };
                    console.error(`❌ Z-API send error for ${cleanPhone}: all instances failed`);
                }
            } catch (zapiErr) {
                sendResult = { sent: false, error: zapiErr.message };
                console.error(`❌ Z-API connection error for ${cleanPhone}:`, zapiErr.message);
            }
        } else {
            sendResult = { sent: false, error: 'Número de telefone inválido ou ausente' };
        }
        
        const contactStatus = sendResult.sent ? 'sent' : 'failed';
        await pool.query(
            `INSERT INTO recovery_contacts (lead_email, segment, template_used, channel, message, status) VALUES ($1, $2, $3, $4, $5, $6)`,
            [email, segment, `step_${nextStep}`, step.channel || 'whatsapp', message, contactStatus]
        );
        
        res.json({
            success: sendResult.sent,
            step: nextStep,
            total_steps: parseInt(totalSteps.rows[0].count),
            message: message,
            sent_via_zapi: sendResult.sent,
            messageId: sendResult.messageId || null,
            send_error: sendResult.error || null,
            completed: nextStep >= parseInt(totalSteps.rows[0].count)
        });
        
    } catch (error) {
        console.error('Error advancing funnel step:', error);
        res.status(500).json({ error: 'Falha ao avançar passo do funil: ' + error.message });
    }
});

// Bulk advance multiple leads
router.post('/api/admin/recovery/funnel/bulk-advance', authenticateToken, async (req, res) => {
    try {
        const { leads, segment } = req.body;
        
        if (!leads || !Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ error: 'Lista de leads é obrigatória' });
        }
        
        await seedRecoveryFunnels();
        
        const results = [];
        for (const lead of leads) {
            try {
                const funnelResult = await pool.query(
                    'SELECT * FROM recovery_funnels WHERE segment = $1 AND is_active = true LIMIT 1',
                    [segment]
                );
                
                if (funnelResult.rows.length === 0) continue;
                const funnel = funnelResult.rows[0];
                
                let progressResult = await pool.query(
                    'SELECT * FROM recovery_lead_progress WHERE lead_email = $1 AND funnel_id = $2',
                    [lead.email, funnel.id]
                );
                
                let currentStep = progressResult.rows.length > 0 ? progressResult.rows[0].current_step : 0;
                const nextStep = currentStep + 1;
                
                const stepResult = await pool.query(
                    'SELECT * FROM recovery_funnel_steps WHERE funnel_id = $1 AND step_number = $2',
                    [funnel.id, nextStep]
                );
                
                if (stepResult.rows.length === 0) {
                    results.push({ email: lead.email, status: 'completed' });
                    continue;
                }
                
                const step = stepResult.rows[0];
                const lang = lead.language || 'en';
                let message = lang === 'es' ? step.template_es : step.template_en;
                message = message.replace(/\{name\}/g, lead.name || 'there');
                message = message.replace(/\{product\}/g, lead.product || 'X AI Monitor');
                
                if (progressResult.rows.length > 0) {
                    await pool.query(
                        'UPDATE recovery_lead_progress SET current_step = $1, updated_at = NOW() WHERE lead_email = $2 AND funnel_id = $3',
                        [nextStep, lead.email, funnel.id]
                    );
                } else {
                    await pool.query(
                        'INSERT INTO recovery_lead_progress (lead_email, funnel_id, current_step, status) VALUES ($1, $2, $3, \'active\')',
                        [lead.email, funnel.id, nextStep]
                    );
                }
                
                // Send via Z-API automatically
                const cleanPhone = (lead.phone || '').replace(/\D/g, '');
                let sent = false;
                
                if (cleanPhone && cleanPhone.length >= 10) {
                    try {
                        const result = await zapiSendText(cleanPhone, message);
                        sent = result.ok && !!result.data?.messageId;
                        
                        if (sent) {
                            console.log(`✅ Bulk recovery sent to ${cleanPhone} (Step ${nextStep})`);
                            try {
                                await pool.query(`
                                    INSERT INTO whatsapp_messages (phone, message, message_id, zaap_id, status, sent_by, created_at)
                                    VALUES ($1, $2, $3, $4, 'sent', 'recovery_bulk', NOW())
                                `, [cleanPhone, message, result.data.messageId, result.data.zaapId]);
                            } catch (dbErr) { /* ignore */ }
                        }
                    } catch (zapiErr) {
                        console.error(`❌ Bulk Z-API error for ${cleanPhone}:`, zapiErr.message);
                    }
                    
                    // Rate limit: 1s between sends
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                const contactStatus = sent ? 'sent' : 'failed';
                await pool.query(
                    `INSERT INTO recovery_contacts (lead_email, segment, template_used, channel, message, status) VALUES ($1, $2, $3, 'whatsapp', $4, $5)`,
                    [lead.email, segment, `step_${nextStep}`, message, contactStatus]
                );
                
                results.push({
                    email: lead.email,
                    status: sent ? 'advanced' : 'send_failed',
                    step: nextStep,
                    sent_via_zapi: sent
                });
            } catch (err) {
                results.push({ email: lead.email, status: 'error', error: err.message });
            }
        }
        
        const sentCount = results.filter(r => r.sent_via_zapi).length;
        const failedCount = results.filter(r => r.status === 'send_failed').length;
        res.json({ success: true, results, sent: sentCount, failed: failedCount });
    } catch (error) {
        console.error('Error bulk advancing:', error);
        res.status(500).json({ error: 'Falha no disparo em massa' });
    }
});

// Resend a dispatch message via Z-API
router.post('/api/admin/recovery/dispatch-resend', authenticateToken, async (req, res) => {
    try {
        const { dispatch_id } = req.body;
        if (!dispatch_id) return res.status(400).json({ error: 'dispatch_id é obrigatório' });
        
        // Get original dispatch
        const dispatchResult = await pool.query(
            `SELECT rc.*, l.whatsapp as lead_phone, l.name as lead_name
             FROM recovery_contacts rc
             LEFT JOIN leads l ON LOWER(rc.lead_email) = LOWER(l.email)
             WHERE rc.id = $1`,
            [dispatch_id]
        );
        
        if (dispatchResult.rows.length === 0) {
            return res.status(404).json({ error: 'Disparo não encontrado' });
        }
        
        const dispatch = dispatchResult.rows[0];
        const phone = (dispatch.lead_phone || '').replace(/\D/g, '');
        
        if (!phone || phone.length < 10) {
            return res.status(400).json({ error: 'Número de telefone inválido' });
        }
        
        if (!dispatch.message) {
            return res.status(400).json({ error: 'Mensagem original não encontrada' });
        }
        
        // Send via Z-API (dual instance fallback)
        const result = await zapiSendText(phone, dispatch.message);
        const sent = result.ok && !!result.data?.messageId;
        
        if (sent) {
            await pool.query(
                `INSERT INTO recovery_contacts (lead_email, segment, template_used, channel, message, status)
                 VALUES ($1, $2, $3, 'whatsapp', $4, 'sent')`,
                [dispatch.lead_email, dispatch.segment, (dispatch.template_used || '') + '_resend', dispatch.message]
            );
            
            try {
                await pool.query(`
                    INSERT INTO whatsapp_messages (phone, message, message_id, zaap_id, status, sent_by, created_at)
                    VALUES ($1, $2, $3, $4, 'sent', 'recovery_resend', NOW())
                `, [phone, dispatch.message, result.data.messageId, result.data.zaapId]);
            } catch (dbErr) { /* ignore */ }
            
            console.log(`🔄 Resend to ${phone} - ID: ${result.data.messageId}`);
            res.json({ success: true, messageId: result.data.messageId });
        } else {
            console.error(`❌ Resend failed for ${phone}: all instances failed`);
            res.status(500).json({ error: 'Falha ao reenviar - todas instâncias Z-API falharam' });
        }
    } catch (error) {
        console.error('Error resending dispatch:', error);
        res.status(500).json({ error: 'Falha ao reenviar: ' + error.message });
    }
});

// Mark lead as recovered
router.post('/api/admin/recovery/funnel/mark-recovered', authenticateToken, async (req, res) => {
    try {
        const { email, segment } = req.body;
        
        // Update all progress entries for this lead
        await pool.query(
            'UPDATE recovery_lead_progress SET status = \'converted\', updated_at = NOW() WHERE lead_email = $1',
            [email]
        );
        
        // Update contact status
        await pool.query(
            'UPDATE recovery_contacts SET status = \'converted\', updated_at = NOW() WHERE lead_email = $1 AND segment = $2',
            [email, segment]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking as recovered:', error);
        res.status(500).json({ error: 'Failed to mark as recovered' });
    }
});

// Get recovery dispatch log (message history)
router.get('/api/admin/recovery/dispatch-log', authenticateToken, async (req, res) => {
    try {
        // Ensure table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recovery_contacts (
                id SERIAL PRIMARY KEY, lead_email VARCHAR(255) NOT NULL, segment VARCHAR(50) NOT NULL,
                template_used VARCHAR(100), channel VARCHAR(20) DEFAULT 'whatsapp', message TEXT,
                status VARCHAR(20) DEFAULT 'sent', created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        const { segment, status, page = 1, limit = 25, search } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (segment) {
            whereClause += ` AND rc.segment = $${paramIndex}`;
            params.push(segment);
            paramIndex++;
        }
        
        if (status) {
            whereClause += ` AND rc.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        
        if (search) {
            whereClause += ` AND (rc.lead_email ILIKE $${paramIndex} OR rc.message ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        
        // Get total count
        const countResult = await pool.query(
            `SELECT COUNT(*) as total FROM recovery_contacts rc ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].total);
        
        // Get stats summary
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_dispatches,
                COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
                COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
                COUNT(*) FILTER (WHERE status = 'converted') as converted_count,
                COUNT(DISTINCT lead_email) as unique_leads,
                COUNT(*) FILTER (WHERE created_at >= NOW() - interval '24 hours') as last_24h,
                COUNT(*) FILTER (WHERE created_at >= NOW() - interval '7 days') as last_7d
            FROM recovery_contacts
        `);
        
        // Get dispatches with lead info + funnel progress
        const dispatchParams = [...params, parseInt(limit), offset];
        const dispatches = await pool.query(`
            SELECT 
                rc.id, rc.lead_email, rc.segment, rc.template_used, rc.channel, 
                rc.message, rc.status, rc.created_at,
                l.name as lead_name, l.whatsapp as lead_phone, l.funnel_language as lead_language,
                l.whatsapp_verified, l.whatsapp_profile_pic,
                COALESCE(p.current_step, 0) as funnel_current_step,
                COALESCE(p.status, 'active') as funnel_status,
                (SELECT COUNT(*) FROM recovery_funnel_steps s 
                 JOIN recovery_funnels f2 ON s.funnel_id = f2.id 
                 WHERE f2.segment = rc.segment AND f2.is_active = true) as funnel_total_steps,
                (SELECT COUNT(*) FROM recovery_contacts rc2 
                 WHERE LOWER(rc2.lead_email) = LOWER(rc.lead_email)) as total_contacts_for_lead
            FROM recovery_contacts rc
            LEFT JOIN leads l ON LOWER(rc.lead_email) = LOWER(l.email)
            LEFT JOIN recovery_funnels f ON f.segment = rc.segment AND f.is_active = true
            LEFT JOIN recovery_lead_progress p ON LOWER(p.lead_email) = LOWER(rc.lead_email) AND p.funnel_id = f.id
            ${whereClause}
            ORDER BY rc.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, dispatchParams);
        
        console.log(`📋 Dispatch log: ${dispatches.rows.length} results, total: ${total}`);
        
        res.json({
            dispatches: dispatches.rows,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            total_pages: Math.ceil(total / parseInt(limit)),
            stats: statsResult.rows[0]
        });
        
    } catch (error) {
        console.error('Error fetching dispatch log:', error);
        res.status(500).json({ error: 'Falha ao carregar histórico de disparos: ' + error.message });
    }
});

// Get recovery templates (legacy + funnel-based)
router.get('/api/admin/recovery/templates', authenticateToken, async (req, res) => {
    try {
        const templates = {
            lost_visitors: [
                {
                    id: 'curiosity',
                    name: 'Curiosity Hook',
                    icon: '👻',
                    message_en: "Hey {name}! 👋 I noticed you were checking out X AI Monitor earlier. Curious about what it does? It uses AI to monitor conversations and reveal what's really going on. Want me to show you how it works? 🔥\n\nCheck it out: https://go.centerpag.com/PPU38CQAEMS",
                    message_es: "¡Hola {name}! 👋 Vi que estabas mirando X AI Monitor. ¿Curioso por saber qué hace? Usa IA para monitorear conversaciones y revelar lo que realmente pasa. ¿Quieres que te muestre cómo funciona? 🔥\n\nMíralo aquí: https://go.centerpag.com/PPU38CQAEMS"
                },
                {
                    id: 'social_proof',
                    name: 'Social Proof',
                    icon: '⭐',
                    message_en: "Hi {name}! Just wanted to share: X AI Monitor has already helped 10,000+ people uncover hidden truths. Today only, you can try it at a special price! 💰\n\n👉 https://go.centerpag.com/PPU38CQAEMS",
                    message_es: "¡Hola {name}! Solo quería compartir: X AI Monitor ya ha ayudado a más de 10,000 personas a descubrir verdades ocultas. ¡Solo por hoy, puedes probarlo a un precio especial! 💰\n\n👉 https://go.centerpag.com/PPU38CQAEMS"
                }
            ],
            checkout_abandoned: [
                {
                    id: 'urgency',
                    name: 'Urgency',
                    icon: '⏰',
                    message_en: "Hey {name}! 👋 I noticed you were checking out X AI Monitor but didn't complete your purchase. Just wanted to let you know we have LIMITED spots available. Don't miss out on discovering what's happening behind the scenes! 🔥\n\nComplete your purchase here: https://go.centerpag.com/PPU38CQAEMS",
                    message_es: "¡Hola {name}! 👋 Vi que estabas por comprar X AI Monitor pero no completaste. Solo quería avisarte que tenemos CUPOS LIMITADOS. ¡No te pierdas la oportunidad de descubrir qué está pasando! 🔥\n\nCompleta tu compra aquí: https://go.centerpag.com/PPU38CQAEMS"
                },
                {
                    id: 'discount',
                    name: 'Special Discount',
                    icon: '💰',
                    message_en: "Hi {name}! 🎁 I have a special offer just for you: Get 50% OFF on X AI Monitor for the next 24 hours! Use this exclusive link: https://go.centerpag.com/PPU38CQAEMS\n\nDon't let this opportunity slip away!",
                    message_es: "¡Hola {name}! 🎁 Tengo una oferta especial solo para ti: ¡50% DE DESCUENTO en X AI Monitor por las próximas 24 horas! Usa este link exclusivo: https://go.centerpag.com/PPU38CQAEMS\n\n¡No dejes escapar esta oportunidad!"
                },
                {
                    id: 'support',
                    name: 'Support',
                    icon: '🤝',
                    message_en: "Hey {name}! 👋 I noticed you were interested in X AI Monitor. Is there anything I can help you with? Any questions about how it works? I'm here to help! 😊\n\nYou can complete your purchase anytime here: https://go.centerpag.com/PPU38CQAEMS",
                    message_es: "¡Hola {name}! 👋 Vi que te interesó X AI Monitor. ¿Hay algo en lo que pueda ayudarte? ¿Alguna pregunta sobre cómo funciona? ¡Estoy aquí para ayudar! 😊\n\nPuedes completar tu compra en cualquier momento aquí: https://go.centerpag.com/PPU38CQAEMS"
                },
                {
                    id: 'direct_checkout',
                    name: 'Direct Checkout Link',
                    icon: '🛒',
                    message_en: "Hey {name}! 👋 You were so close to unlocking X AI Monitor! I saved your spot. Click below to complete your purchase in just 2 minutes:\n\n👉 https://go.centerpag.com/PPU38CQAEMS\n\nSecure payment with credit card, Google Pay or Apple Pay. Don't miss out! 🔥",
                    message_es: "¡Hola {name}! 👋 ¡Estabas tan cerca de desbloquear X AI Monitor! Guardé tu lugar. Haz clic abajo para completar tu compra en solo 2 minutos:\n\n👉 https://go.centerpag.com/PPU38CQAEMS\n\nPago seguro con tarjeta de crédito, Google Pay o Apple Pay. ¡No te lo pierdas! 🔥"
                }
            ],
            payment_failed: [
                {
                    id: 'retry',
                    name: 'Tentar Novamente',
                    icon: '🔄',
                    message_en: "Hi {name}! I noticed there was an issue with your payment for {product}. Sometimes this happens due to bank limits. Would you like to try again with a different card or payment method? I can help! 💳\n\nTry again here: https://go.centerpag.com/PPU38CQAEMS",
                    message_es: "¡Hola {name}! Vi que hubo un problema con tu pago de {product}. A veces esto pasa por límites del banco. ¿Te gustaría intentar con otra tarjeta o método de pago? ¡Puedo ayudarte! 💳\n\nIntenta de nuevo aquí: https://go.centerpag.com/PPU38CQAEMS",
                    message_pt: "Oi {name}! Vi que houve um problema com seu pagamento do {product}. Às vezes isso acontece por limites do banco. Quer tentar com outro cartão ou forma de pagamento? Posso ajudar! 💳\n\nTente novamente aqui: https://go.centerpag.com/PPU38CQAEMS"
                },
                {
                    id: 'alternative',
                    name: 'Pagamento Alternativo',
                    icon: '💳',
                    message_en: "Hey {name}! Your payment for {product} didn't go through. No worries! We have other payment options available. Use this secure link to try again:\n\n👉 https://go.centerpag.com/PPU38CQAEMS\n\nCredit card, Google Pay and Apple Pay accepted!",
                    message_es: "¡Hola {name}! Tu pago de {product} no se procesó. ¡No te preocupes! Tenemos otras opciones de pago disponibles. Usa este link seguro para intentar de nuevo:\n\n👉 https://go.centerpag.com/PPU38CQAEMS\n\n¡Aceptamos tarjeta de crédito, Google Pay y Apple Pay!",
                    message_pt: "Oi {name}! Seu pagamento do {product} não foi processado. Sem problemas! Temos outras opções de pagamento disponíveis. Use este link seguro para tentar novamente:\n\n👉 https://go.centerpag.com/PPU38CQAEMS\n\nAceitamos cartão de crédito, Google Pay e Apple Pay!"
                }
            ],
            refund_requests: [
                {
                    id: 'understand',
                    name: 'Entender Motivo',
                    icon: '💬',
                    message_en: "Hi {name}! I received your refund request. Before we proceed, I'd love to understand what happened. Was there something that didn't meet your expectations? Maybe I can help solve it! 🤝",
                    message_es: "¡Hola {name}! Recibí tu solicitud de reembolso. Antes de proceder, me gustaría entender qué pasó. ¿Hubo algo que no cumplió tus expectativas? ¡Tal vez pueda ayudar a resolverlo! 🤝",
                    message_pt: "Oi {name}! Recebi seu pedido de reembolso. Antes de prosseguir, gostaria de entender o que aconteceu. Teve algo que não atendeu suas expectativas? Talvez eu possa ajudar a resolver! 🤝"
                },
                {
                    id: 'offer_help',
                    name: 'Oferecer Ajuda',
                    icon: '🎯',
                    message_en: "Hey {name}! I saw you requested a refund for {product}. Many customers had similar concerns but after a quick tutorial, they loved the results! Would you give me 5 minutes to show you how to get the best out of it?",
                    message_es: "¡Hola {name}! Vi que pediste reembolso de {product}. ¡Muchos clientes tenían dudas similares pero después de un tutorial rápido, amaron los resultados! ¿Me darías 5 minutos para mostrarte cómo aprovecharlo al máximo?",
                    message_pt: "Oi {name}! Vi que você pediu reembolso do {product}. Muitos clientes tinham dúvidas parecidas mas depois de um tutorial rápido, amaram os resultados! Me dá 5 minutinhos pra te mostrar como aproveitar ao máximo?"
                }
            ],
            upsell_declined: [
                {
                    id: 'benefit',
                    name: 'Benefício Extra',
                    icon: '🎁',
                    message_en: "Hi {name}! Congrats on your purchase! 🎉 I noticed you didn't add {product} to your order. Did you know it can help you [BENEFIT]? I have a special 30% discount just for you!",
                    message_es: "¡Hola {name}! ¡Felicidades por tu compra! 🎉 Vi que no agregaste {product} a tu pedido. ¿Sabías que puede ayudarte a [BENEFICIO]? ¡Tengo un descuento especial del 30% solo para ti!",
                    message_pt: "Oi {name}! Parabéns pela compra! 🎉 Vi que você não adicionou o {product} no seu pedido. Sabia que ele pode te ajudar a [BENEFÍCIO]? Tenho um desconto especial de 30% só pra você!"
                },
                {
                    id: 'bundle',
                    name: 'Oferta Combo',
                    icon: '📦',
                    message_en: "Hey {name}! Quick question: Would you be interested in adding {product} to your X AI Monitor for a special bundle price? It's way more powerful together! 🚀",
                    message_es: "¡Hola {name}! Pregunta rápida: ¿Te interesaría agregar {product} a tu X AI Monitor por un precio especial de combo? ¡Es mucho más poderoso junto! 🚀",
                    message_pt: "Oi {name}! Pergunta rápida: Você teria interesse em adicionar o {product} ao seu X AI Monitor por um preço especial de combo? É muito mais poderoso junto! 🚀"
                }
            ]
        };
        
        res.json({ templates });
        
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// Get recovery stats summary (enhanced with funnel data)
router.get('/api/admin/recovery/stats', authenticateToken, async (req, res) => {
    try {
        // Get recovery rate (last 30 days)
        const recoveryStats = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'converted') as converted,
                COUNT(*) as total
            FROM recovery_contacts
            WHERE created_at >= NOW() - INTERVAL '30 days'
        `);
        
        const converted = parseInt(recoveryStats.rows[0]?.converted || 0);
        const total = parseInt(recoveryStats.rows[0]?.total || 0);
        const recoveryRate = total > 0 ? Math.round((converted / total) * 100) : 0;
        
        // Get best hour for contact
        const bestHour = await pool.query(`
            SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
            FROM recovery_contacts
            WHERE status = 'converted'
            GROUP BY hour
            ORDER BY count DESC
            LIMIT 1
        `);
        
        const bestContactHour = bestHour.rows[0]?.hour ? `${bestHour.rows[0].hour}:00` : '10:00';
        
        // Get funnel progress stats
        let funnelStats = { active: 0, completed: 0, converted: 0 };
        try {
            const funnelProgress = await pool.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'active') as active,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed_funnels,
                    COUNT(*) FILTER (WHERE status = 'converted') as converted_funnels
                FROM recovery_lead_progress
            `);
            funnelStats = {
                active: parseInt(funnelProgress.rows[0]?.active || 0),
                completed: parseInt(funnelProgress.rows[0]?.completed_funnels || 0),
                converted: parseInt(funnelProgress.rows[0]?.converted_funnels || 0)
            };
        } catch(e) { /* table may not exist yet */ }
        
        // Get contacts by segment
        let segmentStats = {};
        try {
            const bySegment = await pool.query(`
                SELECT segment, 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'converted') as converted
                FROM recovery_contacts
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY segment
            `);
            bySegment.rows.forEach(row => {
                segmentStats[row.segment] = {
                    total: parseInt(row.total),
                    converted: parseInt(row.converted),
                    rate: parseInt(row.total) > 0 ? Math.round((parseInt(row.converted) / parseInt(row.total)) * 100) : 0
                };
            });
        } catch(e) { /* ignore */ }
        
        res.json({
            recovery_rate: recoveryRate,
            total_contacts: total,
            total_converted: converted,
            best_contact_hour: bestContactHour,
            funnel_stats: funnelStats,
            segment_stats: segmentStats
        });
        
    } catch (error) {
        console.error('Error fetching recovery stats:', error);
        res.status(500).json({ error: 'Failed to fetch recovery stats' });
    }
});

module.exports = router;
