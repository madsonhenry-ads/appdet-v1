/**
 * Email Tracking Admin API Routes
 * 
 * Provides endpoints for the admin panel to view email tracking metrics:
 * - GET /api/admin/tracking/metrics — Detailed metrics by category/language/email
 * - GET /api/admin/tracking/summary — Summary totals (opens, clicks, rates)
 * - GET /api/admin/tracking/events — Recent tracking events
 * - GET /api/admin/tracking/daily — Daily metrics for charts
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware');
const trackingService = require('../services/email-tracking');

// GET /api/admin/tracking/metrics — Detailed metrics by category/language/emailNum
router.get('/api/admin/tracking/metrics', authenticateToken, async (req, res) => {
  try {
    const { category, language, dateFrom, dateTo } = req.query;
    const metrics = await trackingService.getMetrics({ category, language, dateFrom, dateTo });
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error getting tracking metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/tracking/summary — Summary metrics (aggregated totals)
router.get('/api/admin/tracking/summary', authenticateToken, async (req, res) => {
  try {
    const rows = await trackingService.getSummaryMetrics();
    // Aggregate all rows into a single summary object
    const totals = rows.reduce((acc, row) => {
      acc.total_sent += row.total_sent || 0;
      acc.unique_opens += row.unique_opens || 0;
      acc.unique_clicks += row.unique_clicks || 0;
      acc.unique_contacts += row.unique_contacts || 0;
      acc.contacts_opened += row.contacts_opened || 0;
      acc.contacts_clicked += row.contacts_clicked || 0;
      acc.unique_delivered += row.unique_delivered || 0;
      acc.unique_bounced += row.unique_bounced || 0;
      acc.unique_unsubscribed += row.unique_unsubscribed || 0;
      acc.unique_complaints += row.unique_complaints || 0;
      return acc;
    }, { total_sent: 0, unique_opens: 0, unique_clicks: 0, unique_contacts: 0, contacts_opened: 0, contacts_clicked: 0, unique_delivered: 0, unique_bounced: 0, unique_unsubscribed: 0, unique_complaints: 0 });

    totals.open_rate = totals.total_sent > 0 ? (totals.unique_opens / totals.total_sent * 100).toFixed(1) : '0.0';
    totals.click_rate = totals.total_sent > 0 ? (totals.unique_clicks / totals.total_sent * 100).toFixed(1) : '0.0';
    totals.delivered_rate = totals.total_sent > 0 ? (totals.unique_delivered / totals.total_sent * 100).toFixed(1) : '0.0';
    totals.bounce_rate = totals.total_sent > 0 ? (totals.unique_bounced / totals.total_sent * 100).toFixed(1) : '0.0';
    totals.unsubscribe_rate = totals.total_sent > 0 ? (totals.unique_unsubscribed / totals.total_sent * 100).toFixed(1) : '0.0';

    res.json({ success: true, data: totals, breakdown: rows });
  } catch (error) {
    console.error('Error getting tracking summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/tracking/events — Recent events
router.get('/api/admin/tracking/events', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const events = await trackingService.getRecentEvents(limit);
    res.json({ success: true, data: events });
  } catch (error) {
    console.error('Error getting tracking events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/tracking/daily — Daily metrics for charts
router.get('/api/admin/tracking/daily', authenticateToken, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const daily = await trackingService.getDailyMetrics(days);
    res.json({ success: true, data: daily });
  } catch (error) {
    console.error('Error getting daily metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== RECOVERY SALES METRICS ====================

// GET /api/admin/tracking/recovery-sales — Get recovery email sales from PerfectPay + Monetizze
router.get('/api/admin/tracking/recovery-sales', authenticateToken, async (req, res) => {
  try {
    const pool = require('../database');
    
    // ===== METHOD 1: Direct UTM match in transactions.raw_data =====
    // PerfectPay: raw_data->'metadata'->>'utm_source' = 'activecampaign'
    // Monetizze: raw_data->'venda'->>'utm_source' = 'ActiveCampaign'
    const utmQuery = await pool.queryRetry(`
      SELECT 
        t.transaction_id,
        t.email,
        t.name,
        t.value,
        t.status,
        t.funnel_language,
        t.funnel_source,
        t.created_at,
        -- PerfectPay UTMs
        COALESCE(
          t.raw_data->'metadata'->>'utm_source',
          t.raw_data->'venda'->>'utm_source'
        ) as utm_source,
        COALESCE(
          t.raw_data->'metadata'->>'utm_medium',
          t.raw_data->'venda'->>'utm_medium'
        ) as utm_medium,
        COALESCE(
          t.raw_data->'metadata'->>'utm_campaign',
          t.raw_data->'venda'->>'utm_campaign'
        ) as utm_campaign,
        COALESCE(
          t.raw_data->'metadata'->>'utm_content',
          t.raw_data->'venda'->>'utm_content'
        ) as utm_content,
        COALESCE(
          t.raw_data->'metadata'->>'utm_term',
          t.raw_data->'venda'->>'utm_term'
        ) as utm_term
      FROM transactions t
      WHERE (
        -- PerfectPay recovery emails
        (LOWER(t.raw_data->'metadata'->>'utm_source') IN ('activecampaign', 'brevo')
         AND LOWER(t.raw_data->'metadata'->>'utm_medium') = 'email')
        OR
        (LOWER(t.raw_data->'metadata'->>'utm_term') = 'recovery')
        OR
        (LOWER(t.raw_data->'metadata'->>'utm_campaign') LIKE 'recovery_%')
        OR
        -- Monetizze recovery emails
        (LOWER(t.raw_data->'venda'->>'utm_source') IN ('activecampaign', 'brevo')
         AND LOWER(t.raw_data->'venda'->>'utm_medium') = 'email')
        OR
        (LOWER(t.raw_data->'venda'->>'utm_campaign') LIKE '%rmkt%')
        OR
        (LOWER(t.raw_data->'venda'->>'utm_campaign') LIKE 'recovery_%')
      )
      ORDER BY t.created_at DESC
    `);
    
    const allRecoveryTx = utmQuery.rows;
    
    // ===== METHOD 2: Cross-reference dispatch log with transactions =====
    // Find emails that received recovery emails AND later made a purchase
    const crossRefQuery = await pool.queryRetry(`
      SELECT DISTINCT
        t.transaction_id,
        t.email,
        t.name,
        t.value,
        t.status,
        t.funnel_language,
        t.funnel_source,
        t.created_at,
        d.category as dispatch_category,
        d.language as dispatch_language,
        d.email_num as dispatch_email_num,
        d.dispatched_at as email_sent_at
      FROM transactions t
      INNER JOIN email_dispatch_log d ON LOWER(t.email) = LOWER(d.email)
      WHERE d.status = 'sent'
        AND t.status = 'approved'
        AND t.created_at > d.dispatched_at
        AND t.transaction_id NOT IN (
          SELECT transaction_id FROM (
            SELECT transaction_id FROM transactions WHERE
              LOWER(raw_data->'metadata'->>'utm_source') IN ('activecampaign', 'brevo')
              OR LOWER(raw_data->'metadata'->>'utm_term') = 'recovery'
              OR LOWER(raw_data->'metadata'->>'utm_campaign') LIKE 'recovery_%'
              OR LOWER(raw_data->'venda'->>'utm_source') IN ('activecampaign', 'brevo')
              OR LOWER(raw_data->'venda'->>'utm_campaign') LIKE '%rmkt%'
              OR LOWER(raw_data->'venda'->>'utm_campaign') LIKE 'recovery_%'
          ) utm_matched
        )
      ORDER BY t.created_at DESC
    `);
    
    const crossRefTx = crossRefQuery.rows;
    
    // ===== AGGREGATE METRICS =====
    // UTM-tracked recovery sales
    const utmApproved = allRecoveryTx.filter(t => t.status === 'approved');
    const utmPending = allRecoveryTx.filter(t => ['pending_payment', 'abandoned_checkout'].includes(t.status));
    const utmRejected = allRecoveryTx.filter(t => ['cancelled', 'refunded', 'chargeback'].includes(t.status));
    
    const utmRevenue = utmApproved.reduce((sum, t) => sum + (parseFloat(t.value) || 0), 0);
    
    // Cross-referenced (attributed) sales
    const crossRefRevenue = crossRefTx.reduce((sum, t) => sum + (parseFloat(t.value) || 0), 0);
    
    // Combined unique approved sales
    const allApprovedIds = new Set([
      ...utmApproved.map(t => t.transaction_id),
      ...crossRefTx.map(t => t.transaction_id)
    ]);
    
    // Breakdown by campaign
    const campaignBreakdown = {};
    for (const tx of utmApproved) {
      const camp = tx.utm_campaign || 'unknown';
      if (!campaignBreakdown[camp]) {
        campaignBreakdown[camp] = { count: 0, revenue: 0, emails: [] };
      }
      campaignBreakdown[camp].count++;
      campaignBreakdown[camp].revenue += parseFloat(tx.value) || 0;
      campaignBreakdown[camp].emails.push(tx.email);
    }
    
    // Breakdown by category (from utm_campaign: recovery_checkout_abandon_en -> checkout_abandon)
    const categoryBreakdown = {};
    for (const tx of [...utmApproved, ...crossRefTx]) {
      let category = 'unknown';
      const camp = (tx.utm_campaign || tx.dispatch_category || '').toLowerCase();
      if (camp.includes('checkout_abandon') || camp.includes('checkout abandon')) category = 'checkout_abandon';
      else if (camp.includes('sale_cancelled') || camp.includes('sale cancelled')) category = 'sale_cancelled';
      else if (camp.includes('funnel_abandon') || camp.includes('funnel abandon')) category = 'funnel_abandon';
      else if (camp.includes('rmkt')) category = 'remarketing';
      else category = camp || 'unknown';
      
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { count: 0, revenue: 0 };
      }
      // Avoid double counting
      if (!categoryBreakdown[category][tx.transaction_id]) {
        categoryBreakdown[category][tx.transaction_id] = true;
        categoryBreakdown[category].count++;
        categoryBreakdown[category].revenue += parseFloat(tx.value) || 0;
      }
    }
    // Clean up tracking keys from breakdown
    for (const cat of Object.values(categoryBreakdown)) {
      for (const key of Object.keys(cat)) {
        if (key !== 'count' && key !== 'revenue') delete cat[key];
      }
    }
    
    // Get total dispatch stats for conversion rate
    let totalDispatched = 0;
    try {
      const dispatchCount = await pool.queryRetry(`
        SELECT COUNT(DISTINCT email) as total FROM email_dispatch_log WHERE status = 'sent'
      `);
      totalDispatched = parseInt(dispatchCount.rows[0]?.total || 0);
    } catch (e) {
      console.log('Error getting dispatch count:', e.message);
    }
    
    // Today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayApproved = utmApproved.filter(t => new Date(t.created_at) >= today);
    const todayRevenue = todayApproved.reduce((sum, t) => sum + (parseFloat(t.value) || 0), 0);
    
    // Daily breakdown (last 7 days)
    const dailyBreakdown = [];
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const daySales = utmApproved.filter(t => {
        const d = new Date(t.created_at);
        return d >= dayStart && d < dayEnd;
      });
      
      dailyBreakdown.push({
        date: dayStart.toISOString().split('T')[0],
        count: daySales.length,
        revenue: daySales.reduce((sum, t) => sum + (parseFloat(t.value) || 0), 0)
      });
    }
    
    res.json({
      success: true,
      summary: {
        totalApproved: utmApproved.length,
        totalRevenue: Math.round(utmRevenue * 100) / 100,
        totalPending: utmPending.length,
        totalRejected: utmRejected.length,
        totalAllEvents: allRecoveryTx.length,
        crossRefSales: crossRefTx.length,
        crossRefRevenue: Math.round(crossRefRevenue * 100) / 100,
        combinedUniqueSales: allApprovedIds.size,
        todaySales: todayApproved.length,
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        totalDispatched,
        conversionRate: totalDispatched > 0 
          ? ((allApprovedIds.size / totalDispatched) * 100).toFixed(2) 
          : '0.00'
      },
      categoryBreakdown,
      campaignBreakdown,
      dailyBreakdown,
      recentSales: utmApproved.slice(0, 20).map(t => ({
        transaction_id: t.transaction_id,
        email: t.email,
        name: t.name,
        value: parseFloat(t.value) || 0,
        campaign: t.utm_campaign,
        language: t.funnel_language,
        created_at: t.created_at
      }))
    });
  } catch (error) {
    console.error('Error getting recovery sales:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
