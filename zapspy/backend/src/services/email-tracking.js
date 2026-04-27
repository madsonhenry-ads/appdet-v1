/**
 * Email Tracking Service
 * 
 * Provides open tracking (pixel) and click tracking (redirect) for recovery emails.
 * 
 * How it works:
 * 1. When an email is sent, a unique trackId is generated
 * 2. A 1x1 transparent pixel is embedded in the email HTML: /t/o/{trackId}
 * 3. All links in the email are wrapped with: /t/c/{trackId}?url={originalUrl}
 * 4. When the pixel loads → open event recorded
 * 5. When a link is clicked → click event recorded, user redirected to original URL
 */

const pool = require('../database');
const crypto = require('crypto');

// ==================== DATABASE TABLE ====================

async function ensureTrackingTable() {
  await pool.queryRetry(`
    CREATE TABLE IF NOT EXISTS email_tracking (
      id SERIAL PRIMARY KEY,
      track_id VARCHAR(32) UNIQUE NOT NULL,
      email VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL,
      language VARCHAR(10) NOT NULL,
      email_num INTEGER NOT NULL,
      batch_id VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tracking_track_id ON email_tracking(track_id);
    CREATE INDEX IF NOT EXISTS idx_tracking_email ON email_tracking(email);
    CREATE INDEX IF NOT EXISTS idx_tracking_category ON email_tracking(category, language, email_num);
  `);

  await pool.queryRetry(`
    CREATE TABLE IF NOT EXISTS email_tracking_events (
      id SERIAL PRIMARY KEY,
      track_id VARCHAR(32) NOT NULL REFERENCES email_tracking(track_id),
      event_type VARCHAR(10) NOT NULL,
      url TEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_events_track_id ON email_tracking_events(track_id);
    CREATE INDEX IF NOT EXISTS idx_events_type ON email_tracking_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_events_created ON email_tracking_events(created_at);
  `);
}

// ==================== TRACK ID GENERATION ====================

function generateTrackId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create a tracking record for an email send.
 * Returns the trackId to be used in the email HTML.
 */
async function createTrackingRecord(email, category, language, emailNum, batchId) {
  const trackId = generateTrackId();
  
  await pool.queryRetry(`
    INSERT INTO email_tracking (track_id, email, category, language, email_num, batch_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (track_id) DO NOTHING
  `, [trackId, email, category, language, emailNum, batchId || null]);

  return trackId;
}

// ==================== EVENT RECORDING ====================

/**
 * Record an open event (pixel loaded).
 * Supports both trackId-based and email-based lookups.
 */
async function recordOpen(trackId, ipAddress, userAgent) {
  try {
    const check = await pool.queryRetry(
      `SELECT id FROM email_tracking WHERE track_id = $1`, [trackId]
    );
    if (check.rows.length === 0) return false;

    await pool.queryRetry(`
      INSERT INTO email_tracking_events (track_id, event_type, ip_address, user_agent)
      VALUES ($1, 'open', $2, $3)
    `, [trackId, ipAddress || null, userAgent || null]);

    return true;
  } catch (error) {
    console.error('Error recording open:', error.message);
    return false;
  }
}

/**
 * Record an open event by email + category + language + emailNum.
 * Used when tracking via AC personalization tags (%EMAIL%).
 */
async function recordOpenByEmail(email, category, language, emailNum, ipAddress, userAgent) {
  try {
    const check = await pool.queryRetry(
      `SELECT track_id FROM email_tracking WHERE email = $1 AND category = $2 AND language = $3 AND email_num = $4 LIMIT 1`,
      [email, category, language, emailNum]
    );
    
    let trackId;
    if (check.rows.length === 0) {
      // Auto-create tracking record if it doesn't exist yet
      trackId = await createTrackingRecord(email, category, language, emailNum, null);
    } else {
      trackId = check.rows[0].track_id;
    }

    await pool.queryRetry(`
      INSERT INTO email_tracking_events (track_id, event_type, ip_address, user_agent)
      VALUES ($1, 'open', $2, $3)
    `, [trackId, ipAddress || null, userAgent || null]);

    return true;
  } catch (error) {
    console.error('Error recording open by email:', error.message);
    return false;
  }
}

/**
 * Record a click event (link clicked).
 */
async function recordClick(trackId, url, ipAddress, userAgent) {
  try {
    const check = await pool.queryRetry(
      `SELECT id FROM email_tracking WHERE track_id = $1`, [trackId]
    );
    if (check.rows.length === 0) return false;

    await pool.queryRetry(`
      INSERT INTO email_tracking_events (track_id, event_type, url, ip_address, user_agent)
      VALUES ($1, 'click', $2, $3, $4)
    `, [trackId, url || null, ipAddress || null, userAgent || null]);

    return true;
  } catch (error) {
    console.error('Error recording click:', error.message);
    return false;
  }
}

/**
 * Record a click event by email + category + language + emailNum.
 * Used when tracking via AC personalization tags (%EMAIL%).
 */
async function recordClickByEmail(email, category, language, emailNum, url, ipAddress, userAgent) {
  try {
    const check = await pool.queryRetry(
      `SELECT track_id FROM email_tracking WHERE email = $1 AND category = $2 AND language = $3 AND email_num = $4 LIMIT 1`,
      [email, category, language, emailNum]
    );
    
    let trackId;
    if (check.rows.length === 0) {
      trackId = await createTrackingRecord(email, category, language, emailNum, null);
    } else {
      trackId = check.rows[0].track_id;
    }

    await pool.queryRetry(`
      INSERT INTO email_tracking_events (track_id, event_type, url, ip_address, user_agent)
      VALUES ($1, 'click', $2, $3, $4)
    `, [trackId, url || null, ipAddress || null, userAgent || null]);

    return true;
  } catch (error) {
    console.error('Error recording click by email:', error.message);
    return false;
  }
}

// ==================== METRICS QUERIES ====================

/**
 * Get aggregated metrics by category, language, and email_num.
 * Returns: total_sent, unique_opens, unique_clicks, open_rate, click_rate
 */
async function getMetrics(filters = {}) {
  try {
    let whereClause = '';
    const params = [];
    let paramIdx = 1;

    if (filters.category) {
      whereClause += ` AND t.category = $${paramIdx++}`;
      params.push(filters.category);
    }
    if (filters.language) {
      whereClause += ` AND t.language = $${paramIdx++}`;
      params.push(filters.language);
    }
    if (filters.dateFrom) {
      whereClause += ` AND t.created_at >= $${paramIdx++}`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      whereClause += ` AND t.created_at <= $${paramIdx++}`;
      params.push(filters.dateTo);
    }

    const result = await pool.queryRetry(`
      SELECT 
        t.category,
        t.language,
        t.email_num,
        COUNT(DISTINCT t.track_id) as total_sent,
        COUNT(DISTINCT CASE WHEN e.event_type = 'open' THEN t.track_id END) as unique_opens,
        COUNT(DISTINCT CASE WHEN e.event_type = 'click' THEN t.track_id END) as unique_clicks,
        COUNT(CASE WHEN e.event_type = 'open' THEN 1 END) as total_opens,
        COUNT(CASE WHEN e.event_type = 'click' THEN 1 END) as total_clicks
      FROM email_tracking t
      LEFT JOIN email_tracking_events e ON t.track_id = e.track_id
      WHERE 1=1 ${whereClause}
      GROUP BY t.category, t.language, t.email_num
      ORDER BY t.category, t.language, t.email_num
    `, params);

    return result.rows.map(row => ({
      category: row.category,
      language: row.language,
      email_num: parseInt(row.email_num),
      total_sent: parseInt(row.total_sent),
      unique_opens: parseInt(row.unique_opens),
      unique_clicks: parseInt(row.unique_clicks),
      total_opens: parseInt(row.total_opens),
      total_clicks: parseInt(row.total_clicks),
      open_rate: row.total_sent > 0 ? (parseInt(row.unique_opens) / parseInt(row.total_sent) * 100).toFixed(1) : '0.0',
      click_rate: row.total_sent > 0 ? (parseInt(row.unique_clicks) / parseInt(row.total_sent) * 100).toFixed(1) : '0.0',
    }));
  } catch (error) {
    console.error('Error getting metrics:', error.message);
    return [];
  }
}

/**
 * Get summary metrics (totals across all emails).
 */
async function getSummaryMetrics() {
  try {
    const result = await pool.queryRetry(`
      SELECT 
        t.category,
        t.language,
        COUNT(DISTINCT t.track_id) as total_sent,
        COUNT(DISTINCT t.email) as unique_contacts,
        COUNT(DISTINCT CASE WHEN e.event_type = 'open' THEN t.track_id END) as unique_opens,
        COUNT(DISTINCT CASE WHEN e.event_type = 'click' THEN t.track_id END) as unique_clicks,
        COUNT(DISTINCT CASE WHEN e.event_type = 'open' THEN t.email END) as contacts_opened,
        COUNT(DISTINCT CASE WHEN e.event_type = 'click' THEN t.email END) as contacts_clicked
      FROM email_tracking t
      LEFT JOIN email_tracking_events e ON t.track_id = e.track_id
      GROUP BY t.category, t.language
      ORDER BY t.category, t.language
    `);

    return result.rows.map(row => ({
      category: row.category,
      language: row.language,
      total_sent: parseInt(row.total_sent),
      unique_contacts: parseInt(row.unique_contacts),
      unique_opens: parseInt(row.unique_opens),
      unique_clicks: parseInt(row.unique_clicks),
      contacts_opened: parseInt(row.contacts_opened),
      contacts_clicked: parseInt(row.contacts_clicked),
      open_rate: row.total_sent > 0 ? (parseInt(row.unique_opens) / parseInt(row.total_sent) * 100).toFixed(1) : '0.0',
      click_rate: row.total_sent > 0 ? (parseInt(row.unique_clicks) / parseInt(row.total_sent) * 100).toFixed(1) : '0.0',
    }));
  } catch (error) {
    console.error('Error getting summary metrics:', error.message);
    return [];
  }
}

/**
 * Get recent tracking events for debugging/monitoring.
 */
async function getRecentEvents(limit = 50) {
  try {
    const result = await pool.queryRetry(`
      SELECT 
        e.event_type,
        e.url,
        e.ip_address,
        e.created_at,
        t.email,
        t.category,
        t.language,
        t.email_num
      FROM email_tracking_events e
      JOIN email_tracking t ON e.track_id = t.track_id
      ORDER BY e.created_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  } catch (error) {
    console.error('Error getting recent events:', error.message);
    return [];
  }
}

/**
 * Get daily metrics for charting.
 */
async function getDailyMetrics(days = 30) {
  try {
    const result = await pool.queryRetry(`
      SELECT 
        DATE(t.created_at) as date,
        t.category,
        t.language,
        COUNT(DISTINCT t.track_id) as sent,
        COUNT(DISTINCT CASE WHEN e.event_type = 'open' THEN t.track_id END) as opens,
        COUNT(DISTINCT CASE WHEN e.event_type = 'click' THEN t.track_id END) as clicks
      FROM email_tracking t
      LEFT JOIN email_tracking_events e ON t.track_id = e.track_id
      WHERE t.created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(t.created_at), t.category, t.language
      ORDER BY DATE(t.created_at) DESC
    `);

    return result.rows;
  } catch (error) {
    console.error('Error getting daily metrics:', error.message);
    return [];
  }
}

// ==================== 1x1 TRANSPARENT PNG PIXEL ====================

// Pre-computed 1x1 transparent PNG (43 bytes)
const TRACKING_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function getTrackingPixel() {
  return TRACKING_PIXEL;
}

module.exports = {
  ensureTrackingTable,
  createTrackingRecord,
  recordOpen,
  recordOpenByEmail,
  recordClick,
  recordClickByEmail,
  getMetrics,
  getSummaryMetrics,
  getRecentEvents,
  getDailyMetrics,
  getTrackingPixel,
  generateTrackId,
};
