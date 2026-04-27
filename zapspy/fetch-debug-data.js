const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    
    try {
        console.log('Navigating to admin panel...');
        await page.goto('https://painel.aimonitor.com/admin', { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });
        
        // Wait a bit for the page to load
        await page.waitForTimeout(3000);
        
        // Check if we're already logged in or if there's a login form
        const currentUrl = page.url();
        console.log('Current URL:', currentUrl);
        
        // Take a screenshot of the current state
        await page.screenshot({ path: 'admin-page.png', fullPage: true });
        console.log('Screenshot saved as admin-page.png');
        
        // Check localStorage for credentials
        const localStorage = await page.evaluate(() => {
            return JSON.stringify(window.localStorage);
        });
        console.log('LocalStorage:', localStorage);
        
        // Now navigate to the debug endpoint
        console.log('Navigating to debug endpoint...');
        await page.goto('https://painel.aimonitor.com/api/admin/debug/refund-check', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        // Wait for content to load
        await page.waitForTimeout(2000);
        
        // Get the page content
        const content = await page.content();
        
        // Try to get JSON from the page
        const jsonData = await page.evaluate(() => {
            const pre = document.querySelector('pre');
            if (pre) {
                return pre.textContent;
            }
            return document.body.textContent;
        });
        
        console.log('=== DEBUG ENDPOINT RESPONSE ===');
        console.log(jsonData);
        
        // Save to file
        fs.writeFileSync('debug-response.json', jsonData);
        console.log('Response saved to debug-response.json');
        
        // Take a screenshot of the debug page
        await page.screenshot({ path: 'debug-page.png', fullPage: true });
        console.log('Screenshot saved as debug-page.png');
        
    } catch (error) {
        console.error('Error:', error.message);
        await page.screenshot({ path: 'error-page.png', fullPage: true });
    } finally {
        await browser.close();
    }
})();
