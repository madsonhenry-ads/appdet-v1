/**
 * Script to fetch refund check data from admin API
 * 
 * INSTRUCTIONS:
 * 1. Open https://painel.aimonitor.com/admin in your browser
 * 2. Open Developer Tools (F12)
 * 3. Go to Console tab
 * 4. Run: localStorage.getItem('adminToken')
 * 5. Copy the token value and paste it below
 */

const https = require('https');

// PASTE YOUR TOKEN HERE (between the quotes)
const ADMIN_TOKEN = 'YOUR_TOKEN_HERE';

if (ADMIN_TOKEN === 'YOUR_TOKEN_HERE') {
    console.error('ERROR: Please set your admin token in the script first!');
    console.log('\nInstructions:');
    console.log('1. Open https://painel.aimonitor.com/admin in your browser');
    console.log('2. Open Developer Tools (F12)');
    console.log('3. Go to Console tab');
    console.log('4. Run: localStorage.getItem("adminToken")');
    console.log('5. Copy the token and paste it in this script');
    process.exit(1);
}

const options = {
    hostname: 'painel.aimonitor.com',
    port: 443,
    path: '/api/admin/debug/refund-check',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Accept': 'application/json'
    }
};

console.log('Fetching refund check data...\n');

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode === 200) {
            try {
                const jsonData = JSON.parse(data);
                
                console.log('=== REFUND CHECK DEBUG DATA ===\n');
                
                // Save to file
                const fs = require('fs');
                fs.writeFileSync('refund-check-response.json', JSON.stringify(jsonData, null, 2));
                console.log('✓ Full response saved to: refund-check-response.json\n');
                
                // Display summary
                console.log('SUMMARY:');
                console.log('--------');
                
                if (jsonData.transactions_refunded_chargeback) {
                    console.log(`\n1. Transactions with Refunded/Chargeback Status: ${jsonData.transactions_refunded_chargeback.length}`);
                    if (jsonData.transactions_refunded_chargeback.length > 0) {
                        console.log('   Sample:', jsonData.transactions_refunded_chargeback.slice(0, 3));
                    }
                }
                
                if (jsonData.refund_requests_monetizze) {
                    console.log(`\n2. Refund Requests from Monetizze: ${jsonData.refund_requests_monetizze.length}`);
                    if (jsonData.refund_requests_monetizze.length > 0) {
                        console.log('   Sample:', jsonData.refund_requests_monetizze.slice(0, 3));
                    }
                }
                
                if (jsonData.missing_by_email) {
                    console.log(`\n3. Missing by Email: ${Object.keys(jsonData.missing_by_email).length} emails`);
                    console.log('   Emails:', Object.keys(jsonData.missing_by_email));
                }
                
                if (jsonData.missing_by_txid) {
                    console.log(`\n4. Missing by Transaction ID: ${Object.keys(jsonData.missing_by_txid).length} TXIDs`);
                    console.log('   TXIDs:', Object.keys(jsonData.missing_by_txid));
                }
                
                console.log('\n✓ Check refund-check-response.json for complete data');
                
            } catch (err) {
                console.error('Error parsing JSON:', err.message);
                console.log('Raw response:', data);
            }
        } else {
            console.error(`Error: HTTP ${res.statusCode}`);
            console.log('Response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('Request error:', error.message);
});

req.end();
