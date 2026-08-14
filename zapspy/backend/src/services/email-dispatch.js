/**
 * Email Dispatch Service v2
 *
 * Complete backend-managed email recovery + welcome pipeline (Brevo only):
 * 1. Recovery leads are enqueued automatically per event (enqueueRecovery)
 * 2. Cron processes scheduled emails at their scheduled_for time
 * 3. Self-hosted tracking pixel/click + Brevo webhook record metrics
 * 4. cancelEmailFunnel stops pending recovery when a lead converts
 */

const pool = require('../database');
const brevo = require('./brevo');
const trackingService = require('./email-tracking');

// ==================== SCHEDULE BY CATEGORY ====================
// Offsets in hours (accumulated from the event moment) for each email.
// Email 1 is NOT immediate for recovery categories - it has its own delay.
const SCHEDULE_BY_CATEGORY = {
  'sale_cancelled': { 1: 0.33, 2: 6.33, 3: 18.33, 4: 42.33 },   // +20min, e1+6h, e2+12h, e3+24h
  'funnel_abandon': { 1: 0.33, 2: 2.33, 3: 14.33, 4: 38.33 },   // +20min, e1+2h, e2+12h, e3+24h
  'checkout_abandon': { 1: 0.083, 2: 3.083, 3: 15.083, 4: 33.083 }, // +5min, e1+3h, e2+12h, e3+18h
  'welcome': { 1: 0, 2: 1 },                                     // immediate, e1+1h (conditional)
};

const EMAIL_SCHEDULE = SCHEDULE_BY_CATEGORY.checkout_abandon; // backward-compat default

// Cleanup: 7 days after dispatch
const CLEANUP_DELAY_HOURS = 168;

// ==================== DISPATCH STATUS ====================
let dispatchStatus = {
  running: false,
  category: null,
  language: null,
  total: 0,
  processed: 0,
  success: 0,
  failed: 0,
  startedAt: null,
  lastUpdate: null,
  errors: [],
  batchId: null
};

// ==================== DATABASE TABLE ====================
async function ensureDispatchTable() {
  // Create table if not exists, then safely add UNIQUE constraint if missing
  // NEVER drop the table - dispatch_log data must persist across deploys
  await pool.queryRetry(`
    CREATE TABLE IF NOT EXISTS email_dispatch_log (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL,
      language VARCHAR(10) NOT NULL,
      email_num INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(20) DEFAULT 'scheduled',
      batch_id VARCHAR(100),
      ac_contact_id VARCHAR(50),
      scheduled_for TIMESTAMP,
      sent_at TIMESTAMP,
      dispatched_at TIMESTAMP DEFAULT NOW(),
      cleaned_up BOOLEAN DEFAULT FALSE,
      cleanup_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Add UNIQUE constraint if missing (safe - won't error if already exists)
  try {
    const check = await pool.queryRetry(`
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'email_dispatch_log' AND constraint_type = 'UNIQUE'
    `);
    if (check.rows.length === 0) {
      console.log('📧 Adding UNIQUE constraint to email_dispatch_log...');
      // Remove duplicates first (keep the latest entry)
      await pool.queryRetry(`
        DELETE FROM email_dispatch_log a USING email_dispatch_log b
        WHERE a.id < b.id 
        AND a.email = b.email AND a.category = b.category 
        AND a.language = b.language AND a.email_num = b.email_num
      `);
      await pool.queryRetry(`
        ALTER TABLE email_dispatch_log 
        ADD CONSTRAINT email_dispatch_log_email_category_language_email_num_key 
        UNIQUE (email, category, language, email_num)
      `);
      console.log('✅ UNIQUE constraint added successfully');
    }
  } catch (e) {
    console.log('📧 UNIQUE constraint already exists or could not be added:', e.message);
  }

  // Ensure provider column exists (defaults to 'brevo'). Safe, additive.
  await pool.queryRetry(`
    ALTER TABLE email_dispatch_log ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'brevo';
  `);

  // Ensure indexes exist
  await pool.queryRetry(`
    CREATE INDEX IF NOT EXISTS idx_dispatch_status ON email_dispatch_log(status);
    CREATE INDEX IF NOT EXISTS idx_dispatch_scheduled ON email_dispatch_log(status, scheduled_for);
    CREATE INDEX IF NOT EXISTS idx_dispatch_cleanup ON email_dispatch_log(cleaned_up, dispatched_at);
    CREATE INDEX IF NOT EXISTS idx_dispatch_batch ON email_dispatch_log(batch_id);
  `);
}

// ==================== ENQUEUE RECOVERY (AUTOMATIC PER EVENT) ====================

/**
 * Enqueue a recovery/welcome funnel for a lead at the moment an event occurs.
 * Inserts all emails as 'scheduled' with scheduled_for computed from NOW +
 * SCHEDULE_BY_CATEGORY[category]. The cron (processScheduledEmails) sends
 * them when their time comes. ON CONFLICT DO NOTHING prevents duplicates if
 * the same event fires more than once.
 *
 * @param {object} opts
 * @param {string} opts.email
 * @param {string} [opts.name]
 * @param {string} opts.category - one of SCHEDULE_BY_CATEGORY keys
 * @param {string} opts.language - 'en' | 'es' | ...
 * @param {number} [opts.fromEmailNum] - only schedule emails >= this number
 *   (default 1). For welcome, email 1 is sent immediately, so pass 2.
 */
async function enqueueRecovery({ email, name, category, language, fromEmailNum = 1 }) {
  if (!email || !category || !SCHEDULE_BY_CATEGORY[category]) {
    return { enqueued: 0, error: 'invalid_args' };
  }

  await ensureDispatchTable();

  const schedule = SCHEDULE_BY_CATEGORY[category];
  const nowMs = Date.now();
  const emailNums = Object.keys(schedule)
    .map(Number)
    .filter(n => n >= fromEmailNum)
    .sort((a, b) => a - b);

  let enqueued = 0;
  for (const emailNum of emailNums) {
    const delayMs = schedule[emailNum] * 60 * 60 * 1000;
    const scheduledFor = new Date(nowMs + delayMs);

    await pool.queryRetry(`
      INSERT INTO email_dispatch_log (email, category, language, email_num, status, batch_id, scheduled_for, dispatched_at, provider)
      VALUES ($1, $2, $3, $4, 'scheduled', $5, $6, NOW(), 'brevo')
      ON CONFLICT (email, category, language, email_num) DO NOTHING
    `, [email, category, language, emailNum, `event_${Date.now()}`, scheduledFor]);

    enqueued++;
  }

  console.log(`📧 Enqueued recovery ${category}/${language} for ${email}: ${enqueued} emails scheduled`);
  return { enqueued };
}

// ==================== LEAD COUNT QUERIES ====================

async function getLeadCounts() {
  try {
    // Checkout Abandoned EN
    const checkoutEN = await pool.queryRetry(`
      SELECT COUNT(DISTINCT l.email) as count
      FROM leads l
      INNER JOIN funnel_events fe ON l.ip_address = fe.ip_address
      WHERE fe.event = 'checkout_clicked'
      AND l.email IS NOT NULL AND l.email != ''
      AND l.funnel_language = 'en'
      AND NOT EXISTS (
        SELECT 1 FROM transactions t WHERE t.email = l.email AND t.status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM email_dispatch_log d 
        WHERE d.email = l.email AND d.category = 'checkout_abandon' AND d.language = 'en' AND d.email_num = 1
      )
    `);

    // Checkout Abandoned ES
    const checkoutES = await pool.queryRetry(`
      SELECT COUNT(DISTINCT l.email) as count
      FROM leads l
      INNER JOIN funnel_events fe ON l.ip_address = fe.ip_address
      WHERE fe.event = 'checkout_clicked'
      AND l.email IS NOT NULL AND l.email != ''
      AND l.funnel_language = 'es'
      AND NOT EXISTS (
        SELECT 1 FROM transactions t WHERE t.email = l.email AND t.status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM email_dispatch_log d 
        WHERE d.email = l.email AND d.category = 'checkout_abandon' AND d.language = 'es' AND d.email_num = 1
      )
    `);

    // Sale Cancelled EN
    const cancelledEN = await pool.queryRetry(`
      SELECT COUNT(DISTINCT t.email) as count
      FROM transactions t
      WHERE t.status IN ('refunded', 'cancelled', 'chargeback')
      AND t.email IS NOT NULL AND t.email != ''
      AND t.funnel_language = 'en'
      AND NOT EXISTS (
        SELECT 1 FROM transactions t2 WHERE t2.email = t.email AND t2.status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM email_dispatch_log d 
        WHERE d.email = t.email AND d.category = 'sale_cancelled' AND d.language = 'en' AND d.email_num = 1
      )
    `);

    // Sale Cancelled ES
    const cancelledES = await pool.queryRetry(`
      SELECT COUNT(DISTINCT t.email) as count
      FROM transactions t
      WHERE t.status IN ('refunded', 'cancelled', 'chargeback')
      AND t.email IS NOT NULL AND t.email != ''
      AND t.funnel_language = 'es'
      AND NOT EXISTS (
        SELECT 1 FROM transactions t2 WHERE t2.email = t.email AND t2.status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM email_dispatch_log d 
        WHERE d.email = t.email AND d.category = 'sale_cancelled' AND d.language = 'es' AND d.email_num = 1
      )
    `);

    // Funnel Abandon EN
    const funnelEN = await pool.queryRetry(`
      SELECT COUNT(DISTINCT l.email) as count
      FROM leads l
      WHERE l.email IS NOT NULL AND l.email != ''
      AND l.funnel_language = 'en'
      AND NOT EXISTS (
        SELECT 1 FROM transactions t WHERE t.email = l.email AND t.status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM funnel_events fe WHERE fe.ip_address = l.ip_address AND fe.event = 'checkout_clicked'
      )
      AND NOT EXISTS (
        SELECT 1 FROM email_dispatch_log d 
        WHERE d.email = l.email AND d.category = 'funnel_abandon' AND d.language = 'en' AND d.email_num = 1
      )
    `);

    // Funnel Abandon ES
    const funnelES = await pool.queryRetry(`
      SELECT COUNT(DISTINCT l.email) as count
      FROM leads l
      WHERE l.email IS NOT NULL AND l.email != ''
      AND l.funnel_language = 'es'
      AND NOT EXISTS (
        SELECT 1 FROM transactions t WHERE t.email = l.email AND t.status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM funnel_events fe WHERE fe.ip_address = l.ip_address AND fe.event = 'checkout_clicked'
      )
      AND NOT EXISTS (
        SELECT 1 FROM email_dispatch_log d 
        WHERE d.email = l.email AND d.category = 'funnel_abandon' AND d.language = 'es' AND d.email_num = 1
      )
    `);

    return {
      checkout_abandon: {
        en: parseInt(checkoutEN.rows[0]?.count || 0),
        es: parseInt(checkoutES.rows[0]?.count || 0)
      },
      sale_cancelled: {
        en: parseInt(cancelledEN.rows[0]?.count || 0),
        es: parseInt(cancelledES.rows[0]?.count || 0)
      },
      funnel_abandon: {
        en: parseInt(funnelEN.rows[0]?.count || 0),
        es: parseInt(funnelES.rows[0]?.count || 0)
      }
    };
  } catch (error) {
    console.error('Error getting lead counts:', error.message);
    throw error;
  }
}

// ==================== GET LEADS FOR DISPATCH ====================

async function getLeadsForDispatch(category, language, limit = 500) {
  let query;

  if (category === 'checkout_abandon') {
    query = `
      SELECT DISTINCT ON (l.email) l.email, l.name, l.whatsapp as phone
      FROM leads l
      INNER JOIN funnel_events fe ON l.ip_address = fe.ip_address
      WHERE fe.event = 'checkout_clicked'
      AND l.email IS NOT NULL AND l.email != ''
      AND l.funnel_language = $1
      AND NOT EXISTS (
        SELECT 1 FROM transactions t WHERE t.email = l.email AND t.status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM email_dispatch_log d 
        WHERE d.email = l.email AND d.category = $2 AND d.language = $1 AND d.email_num = 1
      )
      ORDER BY l.email, l.created_at DESC
      LIMIT $3
    `;
  } else if (category === 'sale_cancelled') {
    query = `
      SELECT DISTINCT ON (t.email) t.email, t.name, t.phone
      FROM transactions t
      WHERE t.status IN ('refunded', 'cancelled', 'chargeback')
      AND t.email IS NOT NULL AND t.email != ''
      AND t.funnel_language = $1
      AND NOT EXISTS (
        SELECT 1 FROM transactions t2 WHERE t2.email = t.email AND t2.status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM email_dispatch_log d 
        WHERE d.email = t.email AND d.category = $2 AND d.language = $1 AND d.email_num = 1
      )
      ORDER BY t.email, t.created_at DESC
      LIMIT $3
    `;
  } else if (category === 'funnel_abandon') {
    query = `
      SELECT DISTINCT ON (l.email) l.email, l.name, l.whatsapp as phone
      FROM leads l
      WHERE l.email IS NOT NULL AND l.email != ''
      AND l.funnel_language = $1
      AND NOT EXISTS (
        SELECT 1 FROM transactions t WHERE t.email = l.email AND t.status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM funnel_events fe WHERE fe.ip_address = l.ip_address AND fe.event = 'checkout_clicked'
      )
      AND NOT EXISTS (
        SELECT 1 FROM email_dispatch_log d 
        WHERE d.email = l.email AND d.category = $2 AND d.language = $1 AND d.email_num = 1
      )
      ORDER BY l.email, l.created_at DESC
      LIMIT $3
    `;
  }

  const result = await pool.queryRetry(query, [language, category, limit]);
  return result.rows;
}

// ==================== BATCH DISPATCH ====================

async function startBatchDispatch(category, language, batchSize = 500) {
  if (dispatchStatus.running) {
    return { success: false, message: 'A dispatch is already running. Wait for it to finish.' };
  }

  await ensureDispatchTable();

  const batchId = `batch_${Date.now()}_${category}_${language}`;

  dispatchStatus = {
    running: true,
    category,
    language,
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    lastUpdate: new Date().toISOString(),
    errors: [],
    batchId
  };

  // Run in background
  runDispatch(category, language, batchSize, batchId).catch(err => {
    console.error('Dispatch error:', err);
    dispatchStatus.running = false;
    dispatchStatus.errors.push(err.message);
  });

  return { success: true, batchId, message: `Dispatch started for ${category} ${language}` };
}

async function runDispatch(category, language, batchSize, batchId) {
  try {
    console.log(`📧 Starting FULL dispatch: ${category} ${language} (batch size: ${batchSize})`);

    // First, get total count to show in progress
    let totalRemaining = 0;
    let batchNumber = 0;
    let globalProcessed = 0;
    let globalSuccess = 0;
    let globalFailed = 0;

    // Loop: fetch and process batches until no more leads remain
    while (true) {
      batchNumber++;
      const leads = await getLeadsForDispatch(category, language, batchSize);

      if (leads.length === 0) {
        if (batchNumber === 1) {
          console.log('📧 No leads to dispatch');
        } else {
          console.log(`📧 No more leads remaining after ${batchNumber - 1} batches`);
        }
        break;
      }

      // On first batch, estimate total by adding current batch to what we already processed
      if (batchNumber === 1) {
        // Get approximate total count for progress display
        try {
          const countResult = await getLeadCounts();
          const catCounts = countResult[category] || {};
          totalRemaining = catCounts[language] || leads.length;
        } catch (e) {
          totalRemaining = leads.length;
        }
        dispatchStatus.total = totalRemaining;
      }

      console.log(`📧 Batch #${batchNumber}: Processing ${leads.length} leads...`);

      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];

        try {
          // Send Email 1 immediately via Brevo (manual dispatch utility).
          // The automatic flow uses enqueueRecovery + the cron instead.
          const trackId = await trackingService.createTrackingRecord(lead.email, category, language, 1, batchId);
          await brevo.sendTransactional({
            email: lead.email,
            category,
            emailNum: 1,
            name: lead.name || '',
            last4digits: lead.last4digits || '',
            trackId,
          });

          // Log Email 1 as sent (Brevo only)
          await pool.queryRetry(`
            INSERT INTO email_dispatch_log (email, category, language, email_num, status, batch_id, scheduled_for, sent_at, dispatched_at, provider)
            VALUES ($1, $2, $3, 1, 'sent', $4, NOW(), NOW(), NOW(), 'brevo')
            ON CONFLICT (email, category, language, email_num) DO UPDATE SET
              status = 'sent', batch_id = $4, sent_at = NOW(), provider = 'brevo'
          `, [lead.email, category, language, batchId]);

          // Schedule Emails 2-4 with per-category schedule
          const schedule = SCHEDULE_BY_CATEGORY[category] || {};
          const now = Date.now();
          for (let emailNum = 2; emailNum <= 4; emailNum++) {
            const delayMs = (schedule[emailNum] || 0) * 60 * 60 * 1000;
            const scheduledFor = new Date(now + delayMs);

            await pool.queryRetry(`
              INSERT INTO email_dispatch_log (email, category, language, email_num, status, batch_id, scheduled_for, dispatched_at, provider)
              VALUES ($1, $2, $3, $4, 'scheduled', $5, $6, NOW(), 'brevo')
              ON CONFLICT (email, category, language, email_num) DO NOTHING
            `, [lead.email, category, language, emailNum, batchId, scheduledFor]);
          }

          globalSuccess++;
          dispatchStatus.success = globalSuccess;
        } catch (error) {
          console.error(`Error dispatching to ${lead.email}:`, error.message);
          globalFailed++;
          dispatchStatus.failed = globalFailed;
          if (dispatchStatus.errors.length < 50) {
            dispatchStatus.errors.push(`${lead.email}: ${error.message}`);
          }

          // Log as error
          try {
            await pool.queryRetry(`
              INSERT INTO email_dispatch_log (email, category, language, email_num, status, batch_id, dispatched_at)
              VALUES ($1, $2, $3, 1, 'error', $4, NOW())
              ON CONFLICT (email, category, language, email_num) DO UPDATE SET status = 'error'
            `, [lead.email, category, language, batchId]);
          } catch (e) { /* ignore logging errors */ }
        }

        globalProcessed++;
        dispatchStatus.processed = globalProcessed;
        dispatchStatus.lastUpdate = new Date().toISOString();

        // Rate limiting: 500ms between contacts (AC API limit ~5/sec)
        if (i < leads.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }

        // Log progress every 50 contacts
        if (globalProcessed % 50 === 0) {
          console.log(`📧 Progress: ${globalProcessed}/${dispatchStatus.total} (${globalSuccess} ok, ${globalFailed} failed) [batch #${batchNumber}]`);
        }
      }

      console.log(`📧 Batch #${batchNumber} complete: ${leads.length} processed. Total so far: ${globalProcessed} (${globalSuccess} ok, ${globalFailed} failed)`);

      // Update total estimate for next batch
      dispatchStatus.total = globalProcessed + batchSize; // Will be corrected when next batch loads

      // Small pause between batches to avoid overloading
      await new Promise(r => setTimeout(r, 2000));
    }

    // Final totals
    dispatchStatus.total = globalProcessed;
    console.log(`✅ FULL dispatch complete: ${globalSuccess} sent, ${globalFailed} failed out of ${globalProcessed} total across ${batchNumber} batches`);
  } catch (error) {
    console.error('❌ Dispatch error:', error);
    dispatchStatus.errors.push(error.message);
  } finally {
    dispatchStatus.running = false;
    dispatchStatus.lastUpdate = new Date().toISOString();
  }
}

// ==================== CRON: PROCESS SCHEDULED EMAILS ====================

async function processScheduledEmails() {
  try {
    await ensureDispatchTable();

    // Find emails that are scheduled and due now
    const result = await pool.queryRetry(`
      SELECT id, email, category, language, email_num, batch_id
      FROM email_dispatch_log
      WHERE status = 'scheduled'
      AND scheduled_for <= NOW()
      ORDER BY scheduled_for ASC
      LIMIT 500
    `);

    if (result.rows.length === 0) {
      return { processed: 0, errors: 0 };
    }

    console.log(`📧 Processing ${result.rows.length} scheduled emails...`);

    let sent = 0;
    let errors = 0;

    for (const row of result.rows) {
      try {
        // Check if contact already purchased (skip recovery emails for buyers)
        const buyerCheck = await pool.queryRetry(`
          SELECT id FROM transactions
          WHERE LOWER(email) = LOWER($1) AND status = 'approved'
          LIMIT 1
        `, [row.email]);

        if (buyerCheck.rows.length > 0) {
          console.log(`📧 Skipping email #${row.email_num} for ${row.email} - already purchased`);
          await pool.queryRetry(`
            UPDATE email_dispatch_log
            SET status = 'cancelled'
            WHERE id = $1
          `, [row.id]);

          // Cancel remaining emails and unsubscribe
          cancelEmailFunnel(row.email, 'already_purchased').catch(err => 
            console.error(`Error cancelling funnel for buyer ${row.email}:`, err.message)
          );
          continue;
        }

        // Welcome email 2 is conditional: only send if email 1 was NOT
        // opened or clicked (re-engagement follow-up).
        if (row.category === 'welcome' && row.email_num === 2) {
          const interacted = await pool.queryRetry(`
            SELECT e.id
            FROM email_tracking t
            JOIN email_tracking_events e ON e.track_id = t.track_id
            WHERE t.email = $1 AND t.category = 'welcome' AND t.email_num = 1
            AND e.event_type IN ('open', 'click')
            LIMIT 1
          `, [row.email]);

          if (interacted.rows.length > 0) {
            console.log(`📧 Skipping welcome email #2 for ${row.email} - email 1 was opened/clicked`);
            await pool.queryRetry(`
              UPDATE email_dispatch_log SET status = 'skipped'
              WHERE id = $1
            `, [row.id]);
            continue;
          }
        }

        // Create tracking record and send via Brevo (sole provider).
        const lead = await brevo.getLeadData(row.email);
        const trackId = await trackingService.createTrackingRecord(row.email, row.category, row.language, row.email_num, row.batch_id || null);
        await brevo.sendTransactional({
          email: row.email,
          category: row.category,
          emailNum: row.email_num,
          name: lead.name || '',
          last4digits: lead.last4digits || '',
          trackId,
        });

        // Update status to sent
        await pool.queryRetry(`
          UPDATE email_dispatch_log
          SET status = 'sent', sent_at = NOW()
          WHERE id = $1
        `, [row.id]);

        sent++;
      } catch (error) {
        console.error(`Error sending scheduled email ${row.email} #${row.email_num}:`, error.message);

        // Update status to error
        await pool.queryRetry(`
          UPDATE email_dispatch_log
          SET status = 'error'
          WHERE id = $1
        `, [row.id]);

        errors++;
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`📧 Scheduled emails processed: ${sent} sent, ${errors} errors`);
    return { processed: sent, errors };
  } catch (error) {
    console.error('Error processing scheduled emails:', error);
    return { processed: 0, errors: 0, error: error.message };
  }
}

// ==================== CANCEL FUNNEL: Remove contact when they buy or need to be removed ====================

async function cancelEmailFunnel(email, reason = 'sale_approved') {
  try {
    await ensureDispatchTable();

    if (!email) return { cancelled: false, reason: 'no_email' };

    const pending = await pool.queryRetry(`
      SELECT DISTINCT category, language
      FROM email_dispatch_log
      WHERE LOWER(email) = LOWER($1)
      AND status = 'scheduled'
    `, [email]);

    if (pending.rows.length === 0) {
      const existing = await pool.queryRetry(`
        SELECT DISTINCT category, language
        FROM email_dispatch_log
        WHERE LOWER(email) = LOWER($1)
        AND cleaned_up = FALSE
      `, [email]);

      if (existing.rows.length === 0) {
        return { cancelled: false, reason: 'not_in_funnel' };
      }

      for (const row of existing.rows) {
        await unsubscribeAndCleanup(row, email);
      }

      return { cancelled: true, reason, scheduledCancelled: 0, listsRemoved: existing.rows.length };
    }

    const cancelResult = await pool.queryRetry(`
      UPDATE email_dispatch_log
      SET status = 'cancelled'
      WHERE LOWER(email) = LOWER($1)
      AND status = 'scheduled'
    `, [email]);

    const cancelledCount = cancelResult.rowCount || 0;
    console.log(`📧 Cancelled ${cancelledCount} scheduled emails for ${email} (reason: ${reason})`);

    const distinctEntries = await pool.queryRetry(`
      SELECT DISTINCT category, language
      FROM email_dispatch_log
      WHERE LOWER(email) = LOWER($1)
      AND cleaned_up = FALSE
    `, [email]);

    for (const row of distinctEntries.rows) {
      await unsubscribeAndCleanup(row, email);
    }

    return { cancelled: true, reason, scheduledCancelled: cancelledCount, listsRemoved: distinctEntries.rows.length };
  } catch (error) {
    console.error(`Error cancelling email funnel for ${email}:`, error.message);
    return { cancelled: false, error: error.message };
  }
}

async function unsubscribeAndCleanup(row, email) {
  try {
    await pool.queryRetry(`
      UPDATE email_dispatch_log
      SET cleaned_up = TRUE, cleanup_at = NOW()
      WHERE LOWER(email) = LOWER($1) AND category = $2 AND language = $3
    `, [email, row.category, row.language]);

  } catch (error) {
    console.error(`Error cleaning up ${email} from ${row.category}/${row.language}:`, error.message);
  }
}

// ==================== CLEANUP: REMOVE COMPLETED CONTACTS ====================

async function cleanupCompletedContacts() {
  try {
    await ensureDispatchTable();

    // Find contacts who completed all 4 emails and cleanup delay has passed
    const result = await pool.queryRetry(`
      SELECT DISTINCT d.email, d.category, d.language
      FROM email_dispatch_log d
      WHERE d.email_num = 4
      AND d.status = 'sent'
      AND d.sent_at < NOW() - INTERVAL '2 hours'
      AND d.cleaned_up = FALSE
      LIMIT 200
    `);

    if (result.rows.length === 0) {
      return { cleaned: 0 };
    }

    console.log(`📧 Cleaning up ${result.rows.length} completed contacts...`);

    let cleaned = 0;

    for (const row of result.rows) {
      try {
        // Mark all emails for this contact as cleaned
        await pool.queryRetry(`
          UPDATE email_dispatch_log
          SET cleaned_up = TRUE, cleanup_at = NOW()
          WHERE email = $1 AND category = $2 AND language = $3
        `, [row.email, row.category, row.language]);

        cleaned++;
      } catch (error) {
        console.error(`Error cleaning up ${row.email}:`, error.message);
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`✅ Cleaned up ${cleaned} contacts`);
    return { cleaned };
  } catch (error) {
    console.error('Error in cleanup:', error);
    return { cleaned: 0, error: error.message };
  }
}

// ==================== STATUS & STATS ====================

function getDispatchStatus() {
  return { ...dispatchStatus };
}

async function getDispatchHistory(limit = 20) {
  await ensureDispatchTable();

  const result = await pool.queryRetry(`
    SELECT 
      batch_id,
      category,
      language,
      COUNT(DISTINCT email) as total_contacts,
      COUNT(*) FILTER (WHERE status = 'sent') as emails_sent,
      COUNT(*) FILTER (WHERE status = 'scheduled') as emails_pending,
      COUNT(*) FILTER (WHERE status = 'error') as emails_failed,
      COUNT(DISTINCT email) FILTER (WHERE cleaned_up = TRUE) as cleaned,
      MIN(dispatched_at) as started_at,
      MAX(sent_at) as last_sent_at
    FROM email_dispatch_log
    WHERE batch_id IS NOT NULL
    GROUP BY batch_id, category, language
    ORDER BY MAX(dispatched_at) DESC
    LIMIT $1
  `, [limit]);

  return result.rows;
}

async function getDispatchStats() {
  try {
    await ensureDispatchTable();

    const stats = await pool.queryRetry(`
      SELECT 
        category, language,
        COUNT(DISTINCT email) FILTER (WHERE email_num = 1 AND status = 'sent') as email1_sent,
        COUNT(DISTINCT email) FILTER (WHERE email_num = 2 AND status = 'sent') as email2_sent,
        COUNT(DISTINCT email) FILTER (WHERE email_num = 3 AND status = 'sent') as email3_sent,
        COUNT(DISTINCT email) FILTER (WHERE email_num = 4 AND status = 'sent') as email4_sent,
        COUNT(DISTINCT email) FILTER (WHERE status = 'scheduled') as pending,
        COUNT(DISTINCT email) FILTER (WHERE status = 'error') as errors,
        COUNT(DISTINCT email) FILTER (WHERE cleaned_up = TRUE) as cleaned
      FROM email_dispatch_log
      GROUP BY category, language
      ORDER BY category, language
    `);
    return stats.rows;
  } catch (error) {
    console.error('Error getting dispatch stats:', error);
    return [];
  }
}

// ==================== TEST EMAIL ====================

async function sendTestEmails(testEmail, category, language, emailNumbers = [1, 2, 3, 4]) {
  const results = [];

  for (const emailNum of emailNumbers) {
    try {
      // Send directly via Brevo (sole provider), with a generated track id.
      const trackId = trackingService.generateTrackId();
      await brevo.sendTransactional({
        email: testEmail,
        category,
        emailNum,
        name: 'Test User',
        trackId,
      });
      results.push({
        emailNum,
        success: true,
        message: `Email ${emailNum} sent successfully`,
      });
    } catch (error) {
      results.push({
        emailNum,
        success: false,
        error: error.message,
      });
    }

    // Small delay between sends
    await new Promise(r => setTimeout(r, 1000));
  }

  return {
    testEmail,
    category,
    language,
    results,
    totalSent: results.filter(r => r.success).length,
    totalFailed: results.filter(r => !r.success).length
  };
}

module.exports = {
  getLeadCounts,
  getLeadsForDispatch,
  startBatchDispatch,
  getDispatchStatus,
  getDispatchHistory,
  getDispatchStats,
  processScheduledEmails,
  cleanupCompletedContacts,
  cancelEmailFunnel,
  enqueueRecovery,
  ensureDispatchTable,
  sendTestEmails,
  SCHEDULE_BY_CATEGORY,
  EMAIL_SCHEDULE,
};
