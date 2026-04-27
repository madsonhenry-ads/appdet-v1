/**
 * Fix Placeholders in AC Email Templates
 * 
 * Replaces broken {{}} placeholders with real values and correct AC tags
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware');
const { AC_API_URL, AC_API_KEY } = require('../config');

async function acApiV1Get(action, params = {}) {
  const queryParams = new URLSearchParams({ api_key: AC_API_KEY, api_action: action, api_output: 'json', ...params });
  const url = `${AC_API_URL}/admin/api.php?${queryParams.toString()}`;
  const response = await fetch(url, { method: 'GET' });
  return await response.json();
}

async function acApiV1Post(action, formData) {
  const url = `${AC_API_URL}/admin/api.php?api_action=${action}&api_output=json`;
  const body = new URLSearchParams({ api_key: AC_API_KEY, ...formData });
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  return await response.json();
}

// Placeholder replacements per category/language/emailNum
const REPLACEMENTS = {
  // ============ CHECKOUT ABANDON EN ============
  checkout_abandon_en_1: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'the number you searched',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  checkout_abandon_en_2: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'the number you searched',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  checkout_abandon_en_3: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'the number you searched',
    '{{regular_price}}': '$47',
    '{{discounted_price}}': '$33',
    '{{savings_amount}}': '$14',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  checkout_abandon_en_4: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'the number you searched',
    '{{regular_price}}': '$47',
    '{{final_price}}': '$24',
    '{{savings_amount}}': '$23',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },

  // ============ CHECKOUT ABANDON ES ============
  checkout_abandon_es_1: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'el número que buscaste',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  checkout_abandon_es_2: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'el número que buscaste',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  checkout_abandon_es_3: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'el número que buscaste',
    '{{regular_price}}': '$37',
    '{{discounted_price}}': '$26',
    '{{savings_amount}}': '$11',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  checkout_abandon_es_4: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'el número que buscaste',
    '{{regular_price}}': '$37',
    '{{final_price}}': '$19',
    '{{savings_amount}}': '$18',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },

  // ============ SALE CANCELLED EN ============
  sale_cancelled_en_1: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'the number you searched',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  sale_cancelled_en_2: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'the number you searched',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  sale_cancelled_en_3: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'the number you searched',
    '{{regular_price}}': '$47',
    '{{discounted_price}}': '$33',
    '{{savings_amount}}': '$14',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  sale_cancelled_en_4: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'the number you searched',
    '{{regular_price}}': '$47',
    '{{final_price}}': '$24',
    '{{savings_amount}}': '$23',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },

  // ============ SALE CANCELLED ES ============
  sale_cancelled_es_1: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'el número que buscaste',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  sale_cancelled_es_2: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'el número que buscaste',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  sale_cancelled_es_3: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'el número que buscaste',
    '{{regular_price}}': '$37',
    '{{discounted_price}}': '$26',
    '{{savings_amount}}': '$11',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  sale_cancelled_es_4: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'el número que buscaste',
    '{{regular_price}}': '$37',
    '{{final_price}}': '$19',
    '{{savings_amount}}': '$18',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },

  // ============ FUNNEL ABANDON EN ============
  funnel_abandon_en_1: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'the number you searched',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  funnel_abandon_en_2: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'the number you searched',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  funnel_abandon_en_3: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'the number you searched',
    '{{regular_price}}': '$47',
    '{{discounted_price}}': '$33',
    '{{savings_amount}}': '$14',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  funnel_abandon_en_4: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'the number you searched',
    '{{regular_price}}': '$47',
    '{{final_price}}': '$28',
    '{{savings_amount}}': '$19',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },

  // ============ FUNNEL ABANDON ES ============
  funnel_abandon_es_1: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'el número que buscaste',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  funnel_abandon_es_2: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'el número que buscaste',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  funnel_abandon_es_3: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'el número que buscaste',
    '{{regular_price}}': '$37',
    '{{discounted_price}}': '$26',
    '{{savings_amount}}': '$11',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
  funnel_abandon_es_4: {
    '{{first_name}}': '',
    '{{last_4_digits}}': 'el número que buscaste',
    '{{regular_price}}': '$37',
    '{{final_price}}': '$22',
    '{{savings_amount}}': '$15',
    '{{unsubscribe_link}}': '%UNSUBSCRIBELINK%',
    '{{privacy_link}}': 'https://xaimonitor.com/privacy',
  },
};

// Also need to fix the HTML around {{first_name}} - it's wrapped in <strong> tags
// "Hi <strong>{{first_name}}</strong>," → "Hi,"
// "Hola <strong>{{first_name}}</strong>," → "Hola,"
const REGEX_REPLACEMENTS = [
  // EN: Remove "Hi <strong>{{first_name}}</strong>," → just "Hi,"
  { find: /Hi\s*<strong[^>]*>\s*\{\{first_name\}\}\s*<\/strong>\s*,/gi, replace: 'Hi,' },
  // ES: Remove "Hola <strong>{{first_name}}</strong>," → just "Hola,"
  { find: /Hola\s*<strong[^>]*>\s*\{\{first_name\}\}\s*<\/strong>\s*,/gi, replace: 'Hola,' },
  // Generic fallback for any remaining {{first_name}} with strong tags
  { find: /<strong[^>]*>\s*\{\{first_name\}\}\s*<\/strong>/gi, replace: '' },
  // Remove standalone {{first_name}}
  { find: /\{\{first_name\}\}/g, replace: '' },
  // Replace ...{{last_4_digits}} in strong tags (EN)
  { find: /\.\.\.\{\{last_4_digits\}\}/g, replace: 'the number you searched' },
  // Replace {{last_4_digits}} standalone
  { find: /\{\{last_4_digits\}\}/g, replace: 'the number you searched' },
];

const REGEX_REPLACEMENTS_ES = [
  // ES: Remove "Hola <strong>{{first_name}}</strong>," → just "Hola,"
  { find: /Hola\s*<strong[^>]*>\s*\{\{first_name\}\}\s*<\/strong>\s*,/gi, replace: 'Hola,' },
  { find: /<strong[^>]*>\s*\{\{first_name\}\}\s*<\/strong>/gi, replace: '' },
  { find: /\{\{first_name\}\}/g, replace: '' },
  // ES: Replace ...{{last_4_digits}}
  { find: /\.\.\.\{\{last_4_digits\}\}/g, replace: 'el número que buscaste' },
  { find: /\{\{last_4_digits\}\}/g, replace: 'el número que buscaste' },
];

const CAMPAIGNS = [
  { key: 'checkout_abandon_en_1', messageId: 256, language: 'en' },
  { key: 'checkout_abandon_en_2', messageId: 257, language: 'en' },
  { key: 'checkout_abandon_en_3', messageId: 258, language: 'en' },
  { key: 'checkout_abandon_en_4', messageId: 259, language: 'en' },
  { key: 'checkout_abandon_es_1', messageId: 260, language: 'es' },
  { key: 'checkout_abandon_es_2', messageId: 261, language: 'es' },
  { key: 'checkout_abandon_es_3', messageId: 262, language: 'es' },
  { key: 'checkout_abandon_es_4', messageId: 263, language: 'es' },
  { key: 'sale_cancelled_en_1', messageId: 264, language: 'en' },
  { key: 'sale_cancelled_en_2', messageId: 265, language: 'en' },
  { key: 'sale_cancelled_en_3', messageId: 266, language: 'en' },
  { key: 'sale_cancelled_en_4', messageId: 267, language: 'en' },
  { key: 'sale_cancelled_es_1', messageId: 268, language: 'es' },
  { key: 'sale_cancelled_es_2', messageId: 269, language: 'es' },
  { key: 'sale_cancelled_es_3', messageId: 270, language: 'es' },
  { key: 'sale_cancelled_es_4', messageId: 271, language: 'es' },
  { key: 'funnel_abandon_en_1', messageId: 272, language: 'en' },
  { key: 'funnel_abandon_en_2', messageId: 273, language: 'en' },
  { key: 'funnel_abandon_en_3', messageId: 274, language: 'en' },
  { key: 'funnel_abandon_en_4', messageId: 275, language: 'en' },
  { key: 'funnel_abandon_es_1', messageId: 276, language: 'es' },
  { key: 'funnel_abandon_es_2', messageId: 277, language: 'es' },
  { key: 'funnel_abandon_es_3', messageId: 278, language: 'es' },
  { key: 'funnel_abandon_es_4', messageId: 279, language: 'es' },
];

// POST /api/admin/fix-placeholders — Fix all broken placeholders in AC templates
router.post('/api/admin/fix-placeholders', authenticateToken, async (req, res) => {
  const dryRun = req.query.dry_run === 'true';
  const results = [];

  try {
    for (const campaign of CAMPAIGNS) {
      const { key, messageId, language } = campaign;
      try {
        // 1. Get current HTML from AC
        const msgData = await acApiV1Get('message_view', { id: messageId });
        const currentHtml = msgData.html || msgData.htmlcontent || msgData.text || '';

        if (!currentHtml || currentHtml.length < 50) {
          results.push({ key, messageId, status: 'skipped', reason: 'No HTML content' });
          continue;
        }

        let updatedHtml = currentHtml;
        let changes = [];

        // 2. Apply regex replacements first (for HTML-wrapped placeholders)
        const regexList = language === 'es' ? REGEX_REPLACEMENTS_ES : REGEX_REPLACEMENTS;
        for (const { find, replace } of regexList) {
          if (find.test(updatedHtml)) {
            updatedHtml = updatedHtml.replace(find, replace);
            changes.push(`Regex: ${find.toString().substring(0, 40)}...`);
            // Reset lastIndex for global regexes
            find.lastIndex = 0;
          }
          find.lastIndex = 0;
        }

        // 3. Apply simple string replacements for prices, links etc
        const replacements = REPLACEMENTS[key] || {};
        for (const [placeholder, value] of Object.entries(replacements)) {
          if (placeholder === '{{first_name}}' || placeholder === '{{last_4_digits}}') continue; // handled by regex
          if (updatedHtml.includes(placeholder)) {
            updatedHtml = updatedHtml.split(placeholder).join(value);
            changes.push(`Replaced ${placeholder} → ${value}`);
          }
        }

        // 4. Check for any remaining {{}} placeholders
        const remaining = updatedHtml.match(/\{\{[^}]+\}\}/g);
        if (remaining) {
          changes.push(`WARNING: Remaining placeholders: ${remaining.join(', ')}`);
        }

        if (changes.length === 0) {
          results.push({ key, messageId, status: 'no_changes', reason: 'No placeholders found' });
          continue;
        }

        if (dryRun) {
          results.push({ key, messageId, status: 'dry_run', changes });
          continue;
        }

        // 5. Save updated HTML back to AC
        const editParams = {
          id: messageId,
          html: updatedHtml,
          htmlconstructor: 'editor',
          format: msgData.format || 'mime',
          charset: msgData.charset || 'utf-8',
          encoding: msgData.encoding || 'quoted-printable',
          subject: msgData.subject || '',
          fromemail: msgData.fromemail || 'noreply@xaimonitor.com',
          fromname: msgData.fromname || 'Whats Spy',
          reply2: msgData.reply2 || 'support@Whats Spy',
          priority: msgData.priority || '3',
          textcopy: msgData.textcopy || '',
        };
        if (msgData.listslist) {
          const listIds = String(msgData.listslist).split(',');
          listIds.forEach((lid) => { editParams[`p[${lid.trim()}]`] = lid.trim(); });
        }
        const editResult = await acApiV1Post('message_edit', editParams);

        if (editResult.result_code === 0) {
          results.push({ key, messageId, status: 'error', reason: editResult.result_message, changes });
        } else {
          results.push({ key, messageId, status: 'updated', changes });
        }

      } catch (error) {
        results.push({ key, messageId, status: 'error', reason: error.message });
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const updated = results.filter(r => r.status === 'updated').length;
    const errors = results.filter(r => r.status === 'error').length;
    const noChanges = results.filter(r => r.status === 'no_changes').length;

    res.json({
      success: true,
      summary: { total: results.length, updated, errors, noChanges, dryRun },
      results
    });

  } catch (error) {
    console.error('Error fixing placeholders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
