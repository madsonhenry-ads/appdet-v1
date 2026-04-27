const pool = require('./database');
const bcrypt = require('bcryptjs');

async function initDatabase(retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await _initDatabaseCore();
        } catch (error) {
            console.error(`❌ Database init error (attempt ${attempt}/${retries}):`, error.message);
            if (attempt < retries) {
                const delay = attempt * 3000;
                console.log(`⏳ Retrying in ${delay / 1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    console.error('❌ Database init failed after all retries. Server will continue but some features may not work.');
}

async function _initDatabaseCore() {
    try {
        console.log('🔄 Checking database...');
        
        // Create leads table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leads (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255) NOT NULL,
                whatsapp VARCHAR(50) NOT NULL,
                target_phone VARCHAR(50),
                target_gender VARCHAR(20),
                status VARCHAR(50) DEFAULT 'new',
                notes TEXT,
                ip_address VARCHAR(45),
                referrer TEXT,
                user_agent TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Add name column if it doesn't exist (for existing databases)
        await pool.query(`
            ALTER TABLE leads ADD COLUMN IF NOT EXISTS name VARCHAR(255);
        `);
        
        // Add funnel_language column
        await pool.query(`
            ALTER TABLE leads ADD COLUMN IF NOT EXISTS funnel_language VARCHAR(10) DEFAULT 'en';
        `);
        
        // Add visit tracking columns
        await pool.query(`
            ALTER TABLE leads ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 1;
        `);
        await pool.query(`
            ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMP WITH TIME ZONE;
        `);
        
        // Add geolocation columns
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS country VARCHAR(100);`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS country_code VARCHAR(10);`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS city VARCHAR(100);`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS state VARCHAR(100);`);
        
        // Add customer journey tracking columns
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(100);`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS products_purchased TEXT[];`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0;`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_purchase_at TIMESTAMP WITH TIME ZONE;`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_purchase_at TIMESTAMP WITH TIME ZONE;`);
        
        // Add funnel_source column to leads (main or affiliate)
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS funnel_source VARCHAR(20) DEFAULT 'main';`);
        
        // Add UTM tracking columns to leads
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255);`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255);`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(500);`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_content VARCHAR(500);`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_term VARCHAR(255);`);
        
        // WhatsApp verification columns
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT NULL;`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMP WITH TIME ZONE;`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_profile_pic TEXT;`);
        
        // Facebook Pixel tracking columns (for CAPI enrichment on purchase)
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS fbc VARCHAR(255);`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS fbp VARCHAR(255);`);
        
        // Google Ads gclid column (for conversion attribution)
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS gclid VARCHAR(255);`);
        
        // Create funnel_events table for tracking
        await pool.query(`
            CREATE TABLE IF NOT EXISTS funnel_events (
                id SERIAL PRIMARY KEY,
                visitor_id VARCHAR(100) NOT NULL,
                event VARCHAR(100) NOT NULL,
                page VARCHAR(100),
                target_phone VARCHAR(50),
                target_gender VARCHAR(20),
                ip_address VARCHAR(45),
                user_agent TEXT,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Create postback_logs table for debugging
        await pool.query(`
            CREATE TABLE IF NOT EXISTS postback_logs (
                id SERIAL PRIMARY KEY,
                content_type VARCHAR(255),
                body JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Create capi_purchase_logs table for tracking Purchase event attribution
        await pool.query(`
            CREATE TABLE IF NOT EXISTS capi_purchase_logs (
                id SERIAL PRIMARY KEY,
                transaction_id VARCHAR(255),
                email VARCHAR(255),
                product VARCHAR(500),
                value DECIMAL(10,2),
                currency VARCHAR(10) DEFAULT 'USD',
                funnel_language VARCHAR(10),
                funnel_source VARCHAR(20),
                event_source_url TEXT,
                event_id VARCHAR(255),
                pixel_id VARCHAR(50),
                pixel_name VARCHAR(255),
                has_email BOOLEAN DEFAULT FALSE,
                has_fbc BOOLEAN DEFAULT FALSE,
                has_fbp BOOLEAN DEFAULT FALSE,
                has_ip BOOLEAN DEFAULT FALSE,
                has_user_agent BOOLEAN DEFAULT FALSE,
                has_external_id BOOLEAN DEFAULT FALSE,
                has_country BOOLEAN DEFAULT FALSE,
                has_phone BOOLEAN DEFAULT FALSE,
                lead_found BOOLEAN DEFAULT FALSE,
                capi_success BOOLEAN DEFAULT FALSE,
                capi_response JSONB,
                fb_events_received INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Add unique constraint on transaction_id (prevents duplicate CAPI sends)
        // IMPORTANT: Must be a NON-PARTIAL index (no WHERE clause) for ON CONFLICT (transaction_id) to work
        try {
            // First drop the old partial index if it exists (partial indexes don't work with ON CONFLICT)
            await pool.query(`DROP INDEX IF EXISTS idx_capi_purchase_logs_tx_unique;`);
            // Remove any NULL transaction_ids before creating non-partial unique index
            await pool.query(`DELETE FROM capi_purchase_logs WHERE transaction_id IS NULL;`);
            // Remove duplicates keeping the latest entry
            const delResult = await pool.query(`
                DELETE FROM capi_purchase_logs a
                USING capi_purchase_logs b
                WHERE a.id < b.id AND a.transaction_id = b.transaction_id
            `);
            if (delResult.rowCount > 0) {
                console.log(`🧹 Removed ${delResult.rowCount} duplicate capi_purchase_logs entries`);
            }
            // Create NON-PARTIAL unique index (works with ON CONFLICT)
            await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_capi_purchase_logs_tx_nonpartial ON capi_purchase_logs(transaction_id);`);
            console.log('✅ capi_purchase_logs unique index ready (non-partial)');
        } catch (indexErr) {
            console.error('⚠️ capi_purchase_logs index error:', indexErr.message);
        }
        
        // Create transactions table for Monetizze postbacks
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                transaction_id VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50),
                name VARCHAR(255),
                product VARCHAR(255),
                value VARCHAR(50),
                monetizze_status VARCHAR(10),
                status VARCHAR(50),
                raw_data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Add fbc/fbp columns to funnel_events for CAPI attribution matching
        await pool.query(`ALTER TABLE funnel_events ADD COLUMN IF NOT EXISTS fbc VARCHAR(255);`);
        await pool.query(`ALTER TABLE funnel_events ADD COLUMN IF NOT EXISTS fbp VARCHAR(255);`);
        
        // Add fbc/fbp columns to transactions for CAPI attribution (from postback params)
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fbc VARCHAR(500);`);
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fbp VARCHAR(255);`);
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(255);`);
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gclid VARCHAR(255);`);
        
        // Add match_method column to capi_purchase_logs for attribution monitoring
        await pool.query(`ALTER TABLE capi_purchase_logs ADD COLUMN IF NOT EXISTS match_method VARCHAR(50);`);
        
        // Create indexes for funnel_events
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_funnel_visitor ON funnel_events(visitor_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_funnel_event ON funnel_events(event);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_funnel_created ON funnel_events(created_at DESC);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_funnel_ip ON funnel_events(ip_address);`);
        
        // Create indexes for leads
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);`);
        
        // Add funnel_language to transactions if not exists
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS funnel_language VARCHAR(10);`);
        
        // Add funnel_source to transactions (main vs affiliate)
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS funnel_source VARCHAR(20) DEFAULT 'main';`);
        
        // Create indexes for transactions
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_email ON transactions(email);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_funnel_source ON transactions(funnel_source);`);
        
        // Auto-migrate: fix funnel_language values that were set as 'en-aff' or 'es-aff'
        await pool.query(`UPDATE transactions SET funnel_language = 'en', funnel_source = 'affiliate' WHERE funnel_language = 'en-aff'`);
        await pool.query(`UPDATE transactions SET funnel_language = 'es', funnel_source = 'affiliate' WHERE funnel_language = 'es-aff'`);
        // Set null funnel_source to 'main'
        await pool.query(`UPDATE transactions SET funnel_source = 'main' WHERE funnel_source IS NULL`);
        
        // Create refund_requests table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS refund_requests (
                id SERIAL PRIMARY KEY,
                protocol VARCHAR(50) UNIQUE NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                country_code VARCHAR(10),
                purchase_date DATE,
                product VARCHAR(255),
                reason VARCHAR(100),
                details TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                admin_notes TEXT,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Create indexes for refund_requests
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_refunds_email ON refund_requests(email);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_refunds_status ON refund_requests(status);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_refunds_protocol ON refund_requests(protocol);`);
        
        // Add source column to refund_requests if not exists
        await pool.query(`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'form';`);
        await pool.query(`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS refund_type VARCHAR(50) DEFAULT 'refund';`);
        await pool.query(`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);`);
        await pool.query(`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS value DECIMAL(10,2);`);
        await pool.query(`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS funnel_language VARCHAR(10);`);
        await pool.query(`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]';`);
        await pool.query(`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;`);
        await pool.query(`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(100);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_refunds_visitor_id ON refund_requests(visitor_id);`);
        
        // Create recovery_contacts table for tracking contact attempts
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
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_recovery_contacts_email ON recovery_contacts(lead_email);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_recovery_contacts_segment ON recovery_contacts(segment);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_recovery_contacts_status ON recovery_contacts(status);`);
        
        // Recovery funnel system tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recovery_funnels (
                id SERIAL PRIMARY KEY,
                segment VARCHAR(50) NOT NULL,
                name VARCHAR(100) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recovery_funnel_steps (
                id SERIAL PRIMARY KEY,
                funnel_id INTEGER REFERENCES recovery_funnels(id) ON DELETE CASCADE,
                step_number INTEGER NOT NULL,
                delay_hours INTEGER DEFAULT 24,
                template_en TEXT NOT NULL,
                template_es TEXT NOT NULL,
                channel VARCHAR(20) DEFAULT 'whatsapp',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recovery_lead_progress (
                id SERIAL PRIMARY KEY,
                lead_email VARCHAR(255) NOT NULL,
                funnel_id INTEGER REFERENCES recovery_funnels(id) ON DELETE CASCADE,
                current_step INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'active',
                next_contact_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(lead_email, funnel_id)
            );
        `);
        
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_recovery_funnels_segment ON recovery_funnels(segment);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_recovery_funnel_steps_funnel ON recovery_funnel_steps(funnel_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_recovery_lead_progress_email ON recovery_lead_progress(lead_email);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_recovery_lead_progress_funnel ON recovery_lead_progress(funnel_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_recovery_lead_progress_status ON recovery_lead_progress(status);`);
        
        // Create admin_users table for multi-user access
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                role VARCHAR(50) DEFAULT 'support',
                is_active BOOLEAN DEFAULT true,
                last_login TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER
            );
        `);
        
        // Create index for admin_users
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);`);
        
        // Create A/B tests table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ab_tests (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                funnel VARCHAR(50) NOT NULL,
                variant_a_name VARCHAR(100) DEFAULT 'Control',
                variant_a_param VARCHAR(100) DEFAULT 'control',
                variant_b_name VARCHAR(100) DEFAULT 'Test',
                variant_b_param VARCHAR(100) DEFAULT 'test',
                traffic_split INTEGER DEFAULT 50,
                status VARCHAR(20) DEFAULT 'draft',
                winner VARCHAR(10),
                started_at TIMESTAMP WITH TIME ZONE,
                ended_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER
            );
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_ab_tests_funnel ON ab_tests(funnel);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);`);
        
        // Add new columns for A/B test types and configs (if not exist)
        await pool.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ab_tests' AND column_name='test_type') THEN
                    ALTER TABLE ab_tests ADD COLUMN test_type VARCHAR(20) DEFAULT 'page';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ab_tests' AND column_name='config_a') THEN
                    ALTER TABLE ab_tests ADD COLUMN config_a JSONB DEFAULT '{}';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ab_tests' AND column_name='config_b') THEN
                    ALTER TABLE ab_tests ADD COLUMN config_b JSONB DEFAULT '{}';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ab_tests' AND column_name='url_a') THEN
                    ALTER TABLE ab_tests ADD COLUMN url_a TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ab_tests' AND column_name='url_b') THEN
                    ALTER TABLE ab_tests ADD COLUMN url_b TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ab_tests' AND column_name='slug') THEN
                    ALTER TABLE ab_tests ADD COLUMN slug VARCHAR(100) UNIQUE;
                END IF;
            END $$;
        `);
        
        // Add AB test columns to leads and funnel_events
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ab_test_id INTEGER;`);
        await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ab_variant VARCHAR(10);`);
        await pool.query(`ALTER TABLE funnel_events ADD COLUMN IF NOT EXISTS ab_test_id INTEGER;`);
        await pool.query(`ALTER TABLE funnel_events ADD COLUMN IF NOT EXISTS ab_variant VARCHAR(10);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_ab_test ON leads(ab_test_id) WHERE ab_test_id IS NOT NULL;`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_funnel_events_ab_test ON funnel_events(ab_test_id) WHERE ab_test_id IS NOT NULL;`);
        
        // Create A/B test visitors table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ab_test_visitors (
                id SERIAL PRIMARY KEY,
                test_id INTEGER REFERENCES ab_tests(id) ON DELETE CASCADE,
                visitor_id VARCHAR(100) NOT NULL,
                variant VARCHAR(10) NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(test_id, visitor_id)
            );
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_ab_visitors_test ON ab_test_visitors(test_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_ab_visitors_variant ON ab_test_visitors(variant);`);
        
        // Create A/B test conversions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ab_test_conversions (
                id SERIAL PRIMARY KEY,
                test_id INTEGER REFERENCES ab_tests(id) ON DELETE CASCADE,
                visitor_id VARCHAR(100) NOT NULL,
                variant VARCHAR(10) NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                value DECIMAL(10,2) DEFAULT 0,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_ab_conversions_test ON ab_test_conversions(test_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_ab_conversions_event ON ab_test_conversions(event_type);`);
        
        // Create financial_costs table for expense tracking
        await pool.query(`
            CREATE TABLE IF NOT EXISTS financial_costs (
                id SERIAL PRIMARY KEY,
                cost_date DATE NOT NULL,
                category VARCHAR(50) NOT NULL DEFAULT 'other',
                description TEXT NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
                amount_usd DECIMAL(12,2),
                exchange_rate DECIMAL(10,4),
                notes TEXT,
                created_by INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_financial_costs_date ON financial_costs(cost_date);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_financial_costs_category ON financial_costs(category);`);
        
        // Create Google Ads conversion config table (multiple accounts per language)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS gads_config (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) DEFAULT '',
                language VARCHAR(10) NOT NULL,
                conversion_id VARCHAR(50) NOT NULL,
                conversion_label VARCHAR(100) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Migration: drop old UNIQUE constraint on language (allows multiple accounts per language)
        await pool.query(`ALTER TABLE gads_config ADD COLUMN IF NOT EXISTS name VARCHAR(100) DEFAULT '';`);
        try {
            await pool.query(`ALTER TABLE gads_config DROP CONSTRAINT IF EXISTS gads_config_language_key;`);
        } catch (e) { /* constraint may not exist */ }
        
        // Create Google Ads purchase logs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS gads_purchase_logs (
                id SERIAL PRIMARY KEY,
                transaction_id VARCHAR(255),
                conversion_id VARCHAR(50),
                conversion_label VARCHAR(100),
                email VARCHAR(255),
                value DECIMAL(10,2),
                currency VARCHAR(10) DEFAULT 'USD',
                funnel_language VARCHAR(10),
                success BOOLEAN DEFAULT false,
                error_message TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Unique per transaction+conversion_id pair (multiple conversions per transaction allowed)
        try {
            await pool.query(`DROP INDEX IF EXISTS idx_gads_purchase_logs_tx;`);
        } catch (e) { /* index may not exist */ }
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_gads_purchase_logs_tx_conv ON gads_purchase_logs(transaction_id, conversion_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_gads_purchase_logs_created ON gads_purchase_logs(created_at DESC);`);
        
        // Add missing columns to admin_users if they don't exist (for existing tables)
        // Support both 'name' and 'full_name' columns for compatibility
        await pool.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
        await pool.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);`);
        await pool.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'support';`);
        await pool.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`);
        await pool.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;`);
        await pool.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS created_by INTEGER;`);
        
        // Remove NOT NULL constraint from full_name if it exists
        try {
            await pool.query(`ALTER TABLE admin_users ALTER COLUMN full_name DROP NOT NULL;`);
        } catch (e) { /* Column might not exist or already nullable */ }
        
        // Insert default admin user if not exists (using env vars)
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@whatspy';
        if (!process.env.ADMIN_PASSWORD && process.env.NODE_ENV === 'production') {
            console.error('🚨 ADMIN_PASSWORD environment variable is required in production! Set it in Railway.');
        }
        const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? undefined : 'WhatSpy2024');
        const existingAdmin = await pool.query('SELECT id FROM admin_users WHERE role = $1', ['admin']);
        
        if (existingAdmin.rows.length === 0 && adminPassword) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await pool.query(`
                INSERT INTO admin_users (username, email, password_hash, name, role, is_active)
                VALUES ($1, $2, $3, $4, $5, true)
                ON CONFLICT (email) DO NOTHING
            `, ['admin', adminEmail, hashedPassword, 'Administrador', 'admin']);
            console.log('✅ Default admin user created');
        }
        
        // Create profile picture cache table (resilient to Z-API intermittent failures)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS profile_picture_cache (
                phone VARCHAR(50) PRIMARY KEY,
                picture_url TEXT NOT NULL,
                fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // CAPI event logs for monitoring dashboard
        await pool.query(`
            CREATE TABLE IF NOT EXISTS capi_event_logs (
                id SERIAL PRIMARY KEY,
                event_name VARCHAR(50) NOT NULL,
                event_id VARCHAR(200),
                content_name VARCHAR(200),
                funnel_language VARCHAR(10),
                ip_address VARCHAR(45),
                user_agent TEXT,
                fb_success BOOLEAN DEFAULT FALSE,
                fb_events_received INTEGER DEFAULT 0,
                blocked_reason VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Add columns if table already exists without them
        try { await pool.query(`ALTER TABLE capi_event_logs ADD COLUMN IF NOT EXISTS content_name VARCHAR(200);`); } catch(e) {}
        try { await pool.query(`ALTER TABLE capi_event_logs ADD COLUMN IF NOT EXISTS fbc VARCHAR(255);`); } catch(e) {}
        try { await pool.query(`ALTER TABLE capi_event_logs ADD COLUMN IF NOT EXISTS fbp VARCHAR(255);`); } catch(e) {}
        try { await pool.query(`ALTER TABLE capi_event_logs ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(255);`); } catch(e) {}
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_capi_event_logs_created ON capi_event_logs (created_at);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_capi_event_logs_name ON capi_event_logs (event_name);`);

        // WhatsApp photo check logs for monitoring dashboard
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_check_logs (
                id SERIAL PRIMARY KEY,
                phone VARCHAR(50) NOT NULL,
                has_picture BOOLEAN DEFAULT FALSE,
                picture_url TEXT,
                ip_address VARCHAR(45),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_wa_check_logs_created ON whatsapp_check_logs (created_at);`);

        await pool.query(`ALTER TABLE whatsapp_check_logs ADD COLUMN IF NOT EXISTS picture_source VARCHAR(10) DEFAULT NULL`);
        await pool.query(`ALTER TABLE whatsapp_check_logs ADD COLUMN IF NOT EXISTS zapi_found BOOLEAN DEFAULT FALSE`);
        await pool.query(`ALTER TABLE whatsapp_check_logs ADD COLUMN IF NOT EXISTS rapid_attempted BOOLEAN DEFAULT FALSE`);
        await pool.query(`ALTER TABLE whatsapp_check_logs ADD COLUMN IF NOT EXISTS rapid_found BOOLEAN DEFAULT FALSE`);
        await pool.query(`ALTER TABLE whatsapp_check_logs ADD COLUMN IF NOT EXISTS rapid_error VARCHAR(100) DEFAULT NULL`);
        await pool.query(`ALTER TABLE whatsapp_check_logs ADD COLUMN IF NOT EXISTS rapid_duration_ms INTEGER DEFAULT NULL`);

        console.log('✅ Database ready');
        
        // ==================== CLEANUP: Remove duplicate refund_requests ====================
        try {
            // Fix source values: normalize 'monetizze_deep_sync' and 'monetizze_postback_reprocess' to 'monetizze'
            const sourceFixResult = await pool.query(`
                UPDATE refund_requests 
                SET source = 'monetizze' 
                WHERE source IN ('monetizze_deep_sync', 'monetizze_postback_reprocess')
            `);
            if (sourceFixResult.rowCount > 0) {
                console.log(`🔧 Fixed ${sourceFixResult.rowCount} refund_requests with non-standard monetizze source`);
            }
            
            // Remove duplicate refund_requests: keep only the most recent per email + source combo
            const dupsResult = await pool.query(`
                DELETE FROM refund_requests 
                WHERE id NOT IN (
                    SELECT DISTINCT ON (LOWER(email), COALESCE(source, 'form')) id
                    FROM refund_requests
                    ORDER BY LOWER(email), COALESCE(source, 'form'), created_at DESC
                )
            `);
            if (dupsResult.rowCount > 0) {
                console.log(`🧹 Removed ${dupsResult.rowCount} duplicate refund_requests entries`);
            }
            
            // Also remove duplicates by transaction_id (keep most recent)
            const txDupsResult = await pool.query(`
                DELETE FROM refund_requests 
                WHERE transaction_id IS NOT NULL 
                  AND id NOT IN (
                    SELECT DISTINCT ON (transaction_id) id
                    FROM refund_requests
                    WHERE transaction_id IS NOT NULL
                    ORDER BY transaction_id, created_at DESC
                )
            `);
            if (txDupsResult.rowCount > 0) {
                console.log(`🧹 Removed ${txDupsResult.rowCount} duplicate refund_requests by transaction_id`);
            }
        } catch (cleanupError) {
            console.error('⚠️ Refund cleanup error (non-blocking):', cleanupError.message);
        }
        
        // ==================== BACKFILL: Cross-reference refunds with leads/transactions ====================
        try {
            // Find refunds without funnel_language and try to fill from transactions
            const unfilled = await pool.query(`
                SELECT r.id, r.email 
                FROM refund_requests r 
                WHERE r.funnel_language IS NULL AND r.email IS NOT NULL
            `);
            
            if (unfilled.rows.length > 0) {
                console.log(`🔄 Backfill: ${unfilled.rows.length} refunds without language, cross-referencing...`);
                let updated = 0;
                
                for (const refund of unfilled.rows) {
                    // Try transactions first
                    let lang = null;
                    let val = null;
                    let txId = null;
                    
                    const txResult = await pool.query(`
                        SELECT transaction_id, value, funnel_language 
                        FROM transactions 
                        WHERE LOWER(email) = LOWER($1) AND status = 'approved'
                        ORDER BY created_at DESC LIMIT 1
                    `, [refund.email]);
                    
                    if (txResult.rows.length > 0) {
                        lang = txResult.rows[0].funnel_language;
                        val = txResult.rows[0].value;
                        txId = txResult.rows[0].transaction_id;
                    }
                    
                    // If no language from tx, try leads table (direct column)
                    if (!lang) {
                        const leadResult = await pool.query(`
                            SELECT funnel_language
                            FROM leads 
                            WHERE LOWER(email) = LOWER($1) AND funnel_language IS NOT NULL
                            ORDER BY created_at DESC LIMIT 1
                        `, [refund.email]);
                        
                        if (leadResult.rows.length > 0) {
                            lang = leadResult.rows[0].funnel_language;
                        }
                    }
                    
                    // If no language from leads, try funnel_events
                    if (!lang) {
                        const eventResult = await pool.query(`
                            SELECT metadata->>'funnelLanguage' as funnel_language
                            FROM funnel_events 
                            WHERE LOWER(metadata->>'email') = LOWER($1) AND metadata->>'funnelLanguage' IS NOT NULL
                            ORDER BY created_at DESC LIMIT 1
                        `, [refund.email]);
                        
                        if (eventResult.rows.length > 0) {
                            lang = eventResult.rows[0].funnel_language;
                        }
                    }
                    
                    // Update if we found any data
                    if (lang || val || txId) {
                        await pool.query(`
                            UPDATE refund_requests 
                            SET funnel_language = COALESCE(funnel_language, $1),
                                value = COALESCE(value, $2),
                                transaction_id = COALESCE(transaction_id, $3)
                            WHERE id = $4
                        `, [lang, val, txId, refund.id]);
                        updated++;
                    }
                }
                
                console.log(`✅ Backfill complete: ${updated}/${unfilled.rows.length} refunds enriched with cross-referenced data`);
            }
        } catch (backfillError) {
            console.error('⚠️ Backfill error (non-blocking):', backfillError.message);
        }
        
        // ==================== BACKFILL: Create leads for transactions without matching leads ====================
        try {
            const orphanTx = await pool.query(`
                SELECT 
                    LOWER(t.email) as email,
                    MAX(t.name) as name,
                    MAX(t.phone) as phone,
                    array_agg(DISTINCT t.product) as products,
                    SUM(CAST(t.value AS DECIMAL)) as total_spent,
                    MIN(t.created_at) as first_purchase,
                    MAX(t.created_at) as last_purchase,
                    MAX(t.funnel_language) as funnel_language,
                    MAX(t.funnel_source) as funnel_source,
                    COUNT(*) as tx_count
                FROM transactions t
                WHERE t.status = 'approved' 
                  AND t.email IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM leads l WHERE LOWER(l.email) = LOWER(t.email)
                  )
                GROUP BY LOWER(t.email)
            `);
            
            if (orphanTx.rows.length > 0) {
                console.log(`🔄 Found ${orphanTx.rows.length} buyers without matching leads, creating...`);
                let created = 0;
                
                for (const tx of orphanTx.rows) {
                    try {
                        await pool.query(`
                            INSERT INTO leads (email, name, whatsapp, status, funnel_language, funnel_source,
                                products_purchased, total_spent, first_purchase_at, last_purchase_at,
                                created_at, updated_at)
                            VALUES (LOWER($1), $2, $3, 'converted', $4, $5, $6, $7, $8, $9, $8, NOW())
                        `, [
                            tx.email,
                            tx.name || '',
                            tx.phone || '',
                            tx.funnel_language || 'en',
                            tx.funnel_source || 'main',
                            tx.products,
                            tx.total_spent || 0,
                            tx.first_purchase,
                            tx.last_purchase
                        ]);
                        created++;
                    } catch (insertErr) {
                        // Skip duplicates or other errors silently
                    }
                }
                
                console.log(`✅ Created ${created} new leads from orphan transactions`);
            }
        } catch (orphanError) {
            console.error('⚠️ Orphan transaction backfill error (non-blocking):', orphanError.message);
        }
        
    } catch (error) {
        console.error('❌ Database init error:', error.message);
        throw error;
    }
}

module.exports = { initDatabase };
