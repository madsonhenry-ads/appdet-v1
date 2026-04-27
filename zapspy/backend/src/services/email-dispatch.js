/**
 * Email Dispatch Service v2
 * 
 * Complete backend-managed email recovery pipeline:
 * 1. Pulls leads from PostgreSQL by category
 * 2. Adds contacts to ActiveCampaign + subscribes to list
 * 3. Sends Email 1 immediately via campaign_send (API v1)
 * 4. Schedules Emails 2-4 in the database
 * 5. Cron job processes scheduled emails at the right time
 * 6. After all 4 emails, removes contact from list (cleanup)
 */

const pool = require('../database');
const acService = require('./activecampaign');
const { AC_API_URL, AC_API_KEY } = require('../config');
const trackingService = require('./email-tracking');

// ==================== CAMPAIGN MAPPING ====================
// Maps category_language_emailNumber to campaign and message IDs
const CAMPAIGN_MAP = {
  'checkout_abandon_en_1': { campaignId: 191, messageId: 256 },
  'checkout_abandon_en_2': { campaignId: 192, messageId: 257 },
  'checkout_abandon_en_3': { campaignId: 193, messageId: 258 },
  'checkout_abandon_en_4': { campaignId: 194, messageId: 259 },
  'checkout_abandon_es_1': { campaignId: 195, messageId: 260 },
  'checkout_abandon_es_2': { campaignId: 196, messageId: 261 },
  'checkout_abandon_es_3': { campaignId: 197, messageId: 262 },
  'checkout_abandon_es_4': { campaignId: 198, messageId: 263 },
  'sale_cancelled_en_1': { campaignId: 199, messageId: 264 },
  'sale_cancelled_en_2': { campaignId: 200, messageId: 265 },
  'sale_cancelled_en_3': { campaignId: 201, messageId: 266 },
  'sale_cancelled_en_4': { campaignId: 202, messageId: 267 },
  'sale_cancelled_es_1': { campaignId: 203, messageId: 268 },
  'sale_cancelled_es_2': { campaignId: 204, messageId: 269 },
  'sale_cancelled_es_3': { campaignId: 205, messageId: 270 },
  'sale_cancelled_es_4': { campaignId: 206, messageId: 271 },
  'funnel_abandon_en_1': { campaignId: 207, messageId: 272 },
  'funnel_abandon_en_2': { campaignId: 208, messageId: 273 },
  'funnel_abandon_en_3': { campaignId: 209, messageId: 274 },
  'funnel_abandon_en_4': { campaignId: 210, messageId: 275 },
  'funnel_abandon_es_1': { campaignId: 211, messageId: 276 },
  'funnel_abandon_es_2': { campaignId: 212, messageId: 277 },
  'funnel_abandon_es_3': { campaignId: 213, messageId: 278 },
  'funnel_abandon_es_4': { campaignId: 214, messageId: 279 },
};

// Email schedule: delay in hours after initial dispatch for each email
const EMAIL_SCHEDULE = {
  1: 0,       // Immediately
  2: 24,      // 1 day later
  3: 72,      // 3 days later (2 days after email 2)
  4: 120,     // 5 days later (2 days after email 3)
};

// Cleanup: 48 hours after email 4
const CLEANUP_DELAY_HOURS = 168; // 7 days after dispatch

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

// ==================== AC API v1 (GET) ====================

async function acApiV1Get(action, params = {}) {
  if (!AC_API_URL || !AC_API_KEY) {
    throw new Error('AC_API_URL or AC_API_KEY not configured');
  }

  const queryParams = new URLSearchParams({
    api_key: AC_API_KEY,
    api_action: action,
    api_output: 'json',
    ...params
  });

  const url = `${AC_API_URL}/admin/api.php?${queryParams.toString()}`;

  const response = await fetch(url, { method: 'GET' });
  const data = await response.json();
  return data;
}

// ==================== SEND EMAIL VIA CAMPAIGN_SEND ====================

async function sendCampaignEmail(email, category, language, emailNum) {
  const key = `${category}_${language}_${emailNum}`;
  const campaign = CAMPAIGN_MAP[key];
  
  if (!campaign) {
    throw new Error(`No campaign found for key: ${key}`);
  }

  // Use messageid=0 to send the campaign's default message
  // Using GET method as per AC API v1 documentation
  const result = await acApiV1Get('campaign_send', {
    email: email,
    campaignid: campaign.campaignId,
    messageid: 0,
    type: 'mime',
    action: 'send',
  });

  if (result.result_code !== 1) {
    throw new Error(`campaign_send failed: ${result.result_message || JSON.stringify(result)}`);
  }

  return result;
}

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

  // Ensure indexes exist
  await pool.queryRetry(`
    CREATE INDEX IF NOT EXISTS idx_dispatch_status ON email_dispatch_log(status);
    CREATE INDEX IF NOT EXISTS idx_dispatch_scheduled ON email_dispatch_log(status, scheduled_for);
    CREATE INDEX IF NOT EXISTS idx_dispatch_cleanup ON email_dispatch_log(cleaned_up, dispatched_at);
    CREATE INDEX IF NOT EXISTS idx_dispatch_batch ON email_dispatch_log(batch_id);
  `);
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
          // 1. Add contact to ActiveCampaign + subscribe to list
          const contactId = await acService.syncContact(lead.email, lead.name, lead.phone);
          
          if (!contactId) {
            throw new Error('Failed to sync contact to AC');
          }

          // Subscribe to list → send email → unsubscribe → delete contact
          // Contact is deleted from AC after sending to free up plan slots
          const eventType = category === 'checkout_abandon' ? 'checkout_abandoned' : 
                           category === 'sale_cancelled' ? 'sale_cancelled' : 'lead_captured';
          const listMapping = acService.LIST_MAP[eventType];
          let listId = null;
          if (listMapping && listMapping[language]) {
            listId = await acService.getOrCreateList(listMapping[language]);
            if (listId) {
              await acService.subscribeToList(contactId, listId);
            }
          }

          // 2. Send Email 1 immediately via campaign_send
          await sendCampaignEmail(lead.email, category, language, 1);

          // 2.5. Unsubscribe from list after sending
          if (listId) {
            try {
              await acService.apiRequest('POST', 'contactLists', {
                contactList: { list: String(listId), contact: String(contactId), status: 2 }
              });
            } catch (unsubErr) {
              console.error(`AC: Error removing ${lead.email} from list after send:`, unsubErr.message);
            }
          }

          // 2.6. Delete contact from AC to free plan slots
          try {
            await acService.deleteContact(contactId);
          } catch (delErr) {
            console.error(`AC: Error deleting ${lead.email} after send:`, delErr.message);
          }

          // 2.7. Create tracking record for Email 1
          try {
            await trackingService.createTrackingRecord(lead.email, category, language, 1, batchId);
          } catch (trackErr) {
            console.error(`Tracking record error for ${lead.email}:`, trackErr.message);
          }

          // 3. Log Email 1 as sent
          await pool.queryRetry(`
            INSERT INTO email_dispatch_log (email, category, language, email_num, status, batch_id, ac_contact_id, scheduled_for, sent_at, dispatched_at)
            VALUES ($1, $2, $3, 1, 'sent', $4, $5, NOW(), NOW(), NOW())
            ON CONFLICT (email, category, language, email_num) DO UPDATE SET 
              status = 'sent', batch_id = $4, ac_contact_id = $5, sent_at = NOW()
          `, [lead.email, category, language, batchId, String(contactId)]);

          // 4. Schedule Emails 2, 3, 4
          const now = Date.now();
          for (let emailNum = 2; emailNum <= 4; emailNum++) {
            const delayMs = EMAIL_SCHEDULE[emailNum] * 60 * 60 * 1000;
            const scheduledFor = new Date(now + delayMs);
            
            await pool.queryRetry(`
              INSERT INTO email_dispatch_log (email, category, language, email_num, status, batch_id, ac_contact_id, scheduled_for, dispatched_at)
              VALUES ($1, $2, $3, $4, 'scheduled', $5, $6, $7, NOW())
              ON CONFLICT (email, category, language, email_num) DO NOTHING
            `, [lead.email, category, language, emailNum, batchId, String(contactId), scheduledFor]);
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
      SELECT id, email, category, language, email_num, ac_contact_id
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

        // Re-create contact → subscribe → send → unsubscribe → delete
        // Contact must be re-synced because it was deleted after previous email
        let contactId = row.ac_contact_id;
        try {
          const syncResult = await acService.syncContact(row.email);
          if (syncResult) {
            contactId = syncResult;
            await pool.queryRetry(`
              UPDATE email_dispatch_log SET ac_contact_id = $1
              WHERE LOWER(email) = LOWER($2) AND category = $3 AND language = $4
            `, [contactId, row.email, row.category, row.language]);
          }
        } catch (syncErr) {
          console.error(`AC: Error re-syncing ${row.email} for scheduled email:`, syncErr.message);
        }

        const eventType = row.category === 'checkout_abandon' ? 'checkout_abandoned' :
                         row.category === 'sale_cancelled' ? 'sale_cancelled' : 'lead_captured';
        const listMapping = acService.LIST_MAP[eventType];
        let listId = null;

        if (contactId && listMapping && listMapping[row.language]) {
          listId = await acService.getOrCreateList(listMapping[row.language]);
          if (listId) {
            await acService.subscribeToList(contactId, listId);
          }
        }

        // Send the email via campaign_send
        await sendCampaignEmail(row.email, row.category, row.language, row.email_num);

        // Unsubscribe from list after sending
        if (listId && contactId) {
          try {
            await acService.apiRequest('POST', 'contactLists', {
              contactList: { list: String(listId), contact: String(contactId), status: 2 }
            });
          } catch (unsubErr) {
            console.error(`AC: Error removing ${row.email} from list after scheduled send:`, unsubErr.message);
          }
        }

        // Delete contact from AC to free plan slots
        if (contactId) {
          try {
            await acService.deleteContact(contactId);
          } catch (delErr) {
            console.error(`AC: Error deleting ${row.email} after scheduled send:`, delErr.message);
          }
        }

        // Create tracking record
        try {
          await trackingService.createTrackingRecord(row.email, row.category, row.language, row.email_num, null);
        } catch (trackErr) {
          console.error(`Tracking record error for ${row.email} #${row.email_num}:`, trackErr.message);
        }

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
      SELECT DISTINCT category, language, ac_contact_id
      FROM email_dispatch_log
      WHERE LOWER(email) = LOWER($1)
      AND status = 'scheduled'
    `, [email]);

    if (pending.rows.length === 0) {
      const existing = await pool.queryRetry(`
        SELECT DISTINCT category, language, ac_contact_id
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
      SELECT DISTINCT category, language, ac_contact_id
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
    if (row.ac_contact_id) {
      // Delete contact entirely from AC to free plan slots
      try {
        await acService.deleteContact(row.ac_contact_id);
        console.log(`🗑️ Deleted ${email} from AC (cleanup)`);
      } catch (delErr) {
        console.log(`AC: Contact ${email} may already be deleted: ${delErr.message}`);
      }
    }

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
      SELECT DISTINCT d.email, d.category, d.language, d.ac_contact_id
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
        if (row.ac_contact_id) {
          // Try to delete the contact entirely from AC to free plan slots
          // (it may already be deleted if the per-email deletion worked)
          try {
            await acService.deleteContact(row.ac_contact_id);
          } catch (delErr) {
            // Contact may already be deleted - that's fine
            console.log(`AC: Contact ${row.email} may already be deleted: ${delErr.message}`);
          }
        }

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
    const key = `${category}_${language}_${emailNum}`;
    const campaign = CAMPAIGN_MAP[key];

    if (!campaign) {
      results.push({ emailNum, success: false, error: `No campaign found for key: ${key}` });
      continue;
    }

    try {
      // First ensure the contact exists in AC
      const contactId = await acService.syncContact(testEmail, 'Test User', '');

      // Send the email using GET method with messageid=0 (default message)
      const result = await acApiV1Get('campaign_send', {
        email: testEmail,
        campaignid: campaign.campaignId,
        messageid: 0,
        type: 'mime',
        action: 'send',
      });

      if (result.result_code === 1) {
        results.push({ 
          emailNum, 
          success: true, 
          campaignId: campaign.campaignId,
          message: `Email ${emailNum} sent successfully` 
        });
      } else {
        results.push({ 
          emailNum, 
          success: false, 
          campaignId: campaign.campaignId,
          error: result.result_message || 'Unknown error' 
        });
      }
    } catch (error) {
      results.push({ 
        emailNum, 
        success: false, 
        error: error.message 
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
  ensureDispatchTable,
  sendTestEmails,
  CAMPAIGN_MAP,
  EMAIL_SCHEDULE,
};
