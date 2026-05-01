/**
 * Script para criar transação manual e acionar fluxo de magic link
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });

const { Pool } = require('pg');

// Criar pool de conexão com Supabase
const pool = new Pool({
    host: 'aws-1-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.qvrykyhrmdcsogpyrxeq',
    password: 'Z2siwNjj1AKHQnlG',
    ssl: {
        rejectUnauthorized: false
    }
});

async function createManualTestTransaction() {
    try {
        console.log('🧪 Creating manual test transaction...\n');

        // Gerar transaction_id único
        const transactionId = 'MANUAL_TEST_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        console.log('📝 Transaction ID:', transactionId);

        // Inserir transação
        const result = await pool.query(`
            INSERT INTO transactions (
                transaction_id,
                email,
                phone,
                name,
                product,
                value,
                monetizze_status,
                status,
                raw_data,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            ON CONFLICT (transaction_id) DO NOTHING
            RETURNING *
        `, [
            transactionId,
            'messiasbolsonaro351@gmail.com',
            '+5511999999999',
            'Messias',
            'Whats Spy - Brazilian Monitoring',
            '97.90',
            'aprovado',
            'approved',
            JSON.stringify({ source: 'manual_test', test: true })
        ]);

        console.log('✅ Transaction created successfully!\n');

        // Mostrar resultado
        console.log('📊 Transaction Details:');
        console.log('─'.repeat(60));
        console.log('Transaction ID:', result.rows[0].transaction_id);
        console.log('Email:', result.rows[0].email);
        console.log('Name:', result.rows[0].name);
        console.log('Product:', result.rows[0].product);
        console.log('Value:', result.rows[0].value);
        console.log('Status:', result.rows[0].status);
        console.log('Monetizze Status:', result.rows[0].monetizze_status);
        console.log('Created At:', result.rows[0].created_at);
        console.log('─'.repeat(60));

        console.log('\n📧 Next Steps:');
        console.log('1. Check your inbox for the welcome email');
        console.log('2. The magic link should now contain: pc.appdetect.site');

        // Consultar logs do postback para ver se o fluxo foi acionado
        console.log('\n🔍 Checking backend logs...');
        console.log('Look for:');
        console.log('- "🔐 Supabase user created: messiasbolsonaro351@gmail.com"');
        console.log('- "📧 AC: Magic link for messiasbolsonaro351@gmail.com"');
        console.log('- "📧 AC: Contact synced: messiasbolsonaro351@gmail.com"');

    } catch (error) {
        console.error('❌ Error creating transaction:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
        console.error('\n📝 Please check:');
        console.error('- Database connection is working');
        console.error('- Your Supabase project exists');
    } finally {
        await pool.end();
    }
}

createManualTestTransaction();