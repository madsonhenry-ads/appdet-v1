/**
 * Supabase Auth Service
 *
 * Auto-provisions member area users when a purchase is approved.
 * Creates the user in Supabase Auth with email_confirm: true,
 * generates a magic link, and sends credentials via email.
 *
 * Environment variables required:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key (admin access)
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AC_API_URL, AC_API_KEY } = require('../config');

// Lazy singleton for Supabase admin client
let _supabaseAdmin = null;

// Cache for AC custom field ID (MAGIC_LINK)
let _magicLinkFieldId = null;

function getSupabaseAdmin() {
    if (!_supabaseAdmin) {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
        }
        _supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
    }
    return _supabaseAdmin;
}

/**
 * Resolve the AC custom field ID for MAGIC_LINK by searching by personalization tag.
 * AC API requires numeric field IDs, not field names.
 */
async function getMagicLinkFieldId() {
    if (_magicLinkFieldId) return _magicLinkFieldId;

    if (!AC_API_URL || !AC_API_KEY) return null;

    try {
        const res = await fetch(`${AC_API_URL}/api/3/fields?limit=100`, {
            headers: { 'Api-Token': AC_API_KEY }
        });
        if (!res.ok) return null;

        const data = await res.json();
        const field = (data.fields || []).find(f =>
            f.title === 'MAGIC_LINK' || f.personaltag === '%MAGIC_LINK%'
        );
        if (field) {
            _magicLinkFieldId = field.id;
            console.log(`📧 AC: MAGIC_LINK field ID resolved: ${_magicLinkFieldId}`);
        }
        return _magicLinkFieldId;
    } catch (err) {
        console.error(`📧 AC: Error resolving MAGIC_LINK field ID:`, err.message);
        return null;
    }
}

function isConfigured() {
    return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Generate a secure random password (16 chars)
 */
function generateSecurePassword() {
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    const bytes = crypto.randomBytes(24);
    let password = '';
    for (let i = 0; i < 16; i++) {
        password += chars[bytes[i] % chars.length];
    }
    return password;
}

/**
 * Ensure a Supabase Auth user exists for the given email.
 * Creates the user if not already registered, and generates a magic link.
 *
 * @param {string} email - Buyer's email
 * @param {string} name - Buyer's name
 * @param {string} funnelLanguage - 'en', 'es', 'pt', 'fr'
 * @returns {{ created: boolean, email: string, magicLink?: string, userId?: string }}
 */
async function ensureSupabaseUser(email, name, funnelLanguage) {
    if (!isConfigured()) {
        console.log('⚠️ Supabase Auth not configured, skipping user provisioning');
        return { created: false, email };
    }

    const supabase = getSupabaseAdmin();
    const password = generateSecurePassword();

    try {
        // Try to create the user
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: name || '',
                funnel_language: funnelLanguage || 'en'
            }
        });

        if (error) {
            // User already exists (422 = duplicate email)
            if (error.status === 422 || error.message?.includes('already been registered')) {
                console.log(`🔐 Supabase: User already exists for ${email}`);
                return { created: false, email };
            }
            throw error;
        }

        const userId = data.user?.id;
        console.log(`🔐 Supabase: User created successfully: ${email} (id: ${userId})`);

        // Generate magic link for one-click login
        let magicLink = null;
        try {
            const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
                type: 'magiclink',
                email
            });

            if (linkError) {
                console.log(`⚠️ Supabase: Could not generate magic link for ${email}: ${linkError.message}`);
            } else if (linkData?.properties?.action_link) {
                magicLink = linkData.properties.action_link;
                console.log(`🔐 Supabase: Magic link generated for ${email}`);
            }
        } catch (linkErr) {
            console.log(`⚠️ Supabase: Magic link generation error: ${linkErr.message}`);
        }

        return { created: true, email, magicLink, userId };

    } catch (err) {
        console.error(`❌ Supabase: Error creating user ${email}:`, err.message);
        throw err;
    }
}

/**
 * Send credentials/welcome email to the newly created user.
 * Uses ActiveCampaign to send a campaign email with the magic link.
 *
 * @param {string} email - User's email
 * @param {string} magicLink - One-click login URL
 * @param {string} name - User's name
 * @param {string} funnelLanguage - 'en', 'es', 'pt', 'fr'
 */
async function sendCredentialsEmail(email, magicLink, name, funnelLanguage) {
    const lang = (funnelLanguage || 'en').startsWith('es') ? 'es' :
                 (funnelLanguage || 'en').startsWith('pt') ? 'pt' :
                 (funnelLanguage || 'en').startsWith('fr') ? 'fr' : 'en';

    // Log the magic link for debugging (always)
    if (magicLink) {
        console.log(`📧 Supabase: Magic link for ${email}: ${magicLink}`);
    }

    // If ActiveCampaign is configured, create/update contact and send welcome email
    if (!AC_API_URL || !AC_API_KEY) {
        console.log('⚠️ ActiveCampaign not configured - magic link logged above but no email sent');
        return;
    }

    try {
        // Resolve AC custom field ID for MAGIC_LINK
        const fieldId = await getMagicLinkFieldId();

        // Build field values with numeric field ID
        const fieldValues = [];
        if (fieldId) {
            fieldValues.push({ field: String(fieldId), value: magicLink || 'https://pc.appdetect.site/' });
        }

        // Create or update contact in ActiveCampaign with magic link
        const contactData = {
            email,
            firstName: (name || '').split(' ')[0] || '',
            lastName: (name || '').split(' ').slice(1).join(' ') || '',
            fieldValues
        };

        const contactRes = await fetch(`${AC_API_URL}/api/3/contact/sync`, {
            method: 'POST',
            headers: {
                'Api-Token': AC_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ contact: contactData })
        });

        if (!contactRes.ok) {
            console.log(`⚠️ AC: Could not sync contact ${email}: ${contactRes.status}`);
            return;
        }

        const contactJson = await contactRes.json();
        const contactId = contactJson.contact?.id;
        console.log(`📧 AC: Contact synced: ${email} (id: ${contactId})`);

        // Add "buyer" tag based on language (same tags used by activecampaign.js)
        const buyerTags = {
            en: 'Whats Spy-buyer-en',
            es: 'Whats Spy-buyer-es',
            pt: 'Whats Spy-buyer-en', // Portuguese uses EN tag as fallback
            fr: 'Whats Spy-buyer-en'  // French uses EN tag as fallback
        };

        // Look up the tag ID
        const tagRes = await fetch(`${AC_API_URL}/api/3/tags?search=${encodeURIComponent(buyerTags[lang])}`, {
            headers: { 'Api-Token': AC_API_KEY }
        });

        if (tagRes.ok) {
            const tagJson = await tagRes.json();
            const tagId = tagJson.tags?.[0]?.id;
            if (tagId && contactId) {
                await fetch(`${AC_API_URL}/api/3/contactTags`, {
                    method: 'POST',
                    headers: {
                        'Api-Token': AC_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } })
                });
                console.log(`📧 AC: Tag "${buyerTags[lang]}" added to ${email}`);
            }
        }

        console.log(`📧 AC: Welcome email should be triggered for ${email} (${lang})`);

    } catch (acErr) {
        console.error(`📧 AC: Error sending credentials email to ${email}:`, acErr.message);
        // Log magic link as fallback
        if (magicLink) {
            console.log(`📧 FALLBACK: Magic link for ${email}: ${magicLink}`);
        }
    }
}

/**
 * Disable a user's access to the member area (for refunds/chargebacks).
 *
 * @param {string} userId - Supabase Auth user ID
 */
async function disableUser(userId) {
    if (!isConfigured()) return;

    try {
        const supabase = getSupabaseAdmin();
        await supabase.auth.admin.updateUserById(userId, { ban_duration: '876000h' }); // ~100 years
        console.log(`🔐 Supabase: User ${userId} banned (refund/chargeback)`);
    } catch (err) {
        console.error(`❌ Supabase: Error banning user ${userId}:`, err.message);
    }
}

module.exports = {
    isConfigured,
    ensureSupabaseUser,
    sendCredentialsEmail,
    disableUser
};
