// Quick script to fetch refund check data
// This will attempt to use any stored credentials

const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('=== Refund Check Data Fetcher ===\n');
console.log('Please provide your admin token.');
console.log('To get it:');
console.log('1. Open https://painel.aimonitor.com/admin in your browser');
console.log('2. Press F12 -> Console');
console.log('3. Type: localStorage.getItem("adminToken")');
console.log('4. Copy the token (without quotes)\n');

rl.question('Paste your admin token here: ', (token) => {
    if (!token || token.trim() === '') {
        console.error('Error: No token provided');
        rl.close();
        process.exit(1);
    }

    console.log('\nFetching data...\n');

    const options = {
        hostname: 'painel.aimonitor.com',
        port: 443,
        path: '/api/admin/debug/refund-check',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token.trim()}`,
            'Accept': 'application/json'
        }
    };

    const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const jsonData = JSON.parse(data);
                    
                    console.log('✓ Data fetched successfully!\n');
                    console.log('='.repeat(80));
                    console.log('SUMMARY');
                    console.log('='.repeat(80));
                    
                    const refundedCount = jsonData.transactions_refunded_chargeback?.length || 0;
                    const monetizzeCount = jsonData.refund_requests_monetizze?.length || 0;
                    const missingEmailCount = Object.keys(jsonData.missing_by_email || {}).length;
                    const missingTxidCount = Object.keys(jsonData.missing_by_txid || {}).length;
                    
                    console.log(`\n1. Transactions with Refunded/Chargeback Status: ${refundedCount}`);
                    console.log(`2. Refund Requests from Monetizze: ${monetizzeCount}`);
                    console.log(`3. Missing by Email: ${missingEmailCount} emails`);
                    console.log(`4. Missing by Transaction ID: ${missingTxidCount} TXIDs`);
                    
                    console.log('\n' + '='.repeat(80));
                    console.log('DETAILED DATA');
                    console.log('='.repeat(80));
                    
                    // Check for specific emails
                    const targetEmails = [
                        'keniachang85@gmail.com',
                        'solounalmaviviendo@gmail.com',
                        'jennmccue71@gmail.com',
                        'rob.griffiths1_78@bigpond.com'
                    ];
                    
                    console.log('\n--- MISSING BY EMAIL ---');
                    if (jsonData.missing_by_email && Object.keys(jsonData.missing_by_email).length > 0) {
                        console.log('All missing emails:', Object.keys(jsonData.missing_by_email));
                        console.log('\nChecking target emails:');
                        targetEmails.forEach(email => {
                            if (jsonData.missing_by_email[email]) {
                                console.log(`\n✓ Found: ${email}`);
                                console.log(JSON.stringify(jsonData.missing_by_email[email], null, 2));
                            } else {
                                console.log(`✗ Not found: ${email}`);
                            }
                        });
                    } else {
                        console.log('No missing emails found');
                    }
                    
                    // Check for specific transaction IDs
                    const targetTxids = ['55851833', '55844643', '55838428', '55838017', '55834038', '55834036'];
                    
                    console.log('\n--- MISSING BY TRANSACTION ID ---');
                    if (jsonData.missing_by_txid && Object.keys(jsonData.missing_by_txid).length > 0) {
                        console.log('All missing TXIDs:', Object.keys(jsonData.missing_by_txid));
                        console.log('\nChecking target TXIDs:');
                        targetTxids.forEach(txid => {
                            if (jsonData.missing_by_txid[txid]) {
                                console.log(`\n✓ Found: ${txid}`);
                                console.log(JSON.stringify(jsonData.missing_by_txid[txid], null, 2));
                            } else {
                                console.log(`✗ Not found: ${txid}`);
                            }
                        });
                    } else {
                        console.log('No missing transaction IDs found');
                    }
                    
                    console.log('\n--- TRANSACTIONS REFUNDED/CHARGEBACK ---');
                    if (refundedCount > 0) {
                        console.log(JSON.stringify(jsonData.transactions_refunded_chargeback, null, 2));
                    } else {
                        console.log('No refunded/chargeback transactions found');
                    }
                    
                    console.log('\n--- MONETIZZE REFUND REQUESTS ---');
                    if (monetizzeCount > 0) {
                        console.log(JSON.stringify(jsonData.refund_requests_monetizze, null, 2));
                    } else {
                        console.log('No Monetizze refund requests found');
                    }
                    
                    // Save complete data to file
                    const fs = require('fs');
                    const filename = `refund-check-${new Date().toISOString().split('T')[0]}.json`;
                    fs.writeFileSync(filename, JSON.stringify(jsonData, null, 2));
                    console.log(`\n✓ Complete data saved to: ${filename}`);
                    
                } catch (err) {
                    console.error('Error parsing JSON:', err.message);
                    console.log('Raw response:', data);
                }
            } else if (res.statusCode === 401) {
                console.error('Error: Unauthorized (401)');
                console.error('The token may be invalid or expired.');
                console.error('Please get a fresh token from the browser.');
            } else {
                console.error(`Error: HTTP ${res.statusCode}`);
                console.log('Response:', data);
            }
            
            rl.close();
        });
    });

    req.on('error', (error) => {
        console.error('Request error:', error.message);
        rl.close();
    });

    req.end();
});
