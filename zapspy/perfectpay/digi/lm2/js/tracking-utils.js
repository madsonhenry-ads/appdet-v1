/**
 * Tracking Utilities
 * Centralized UTM capture, Visitor ID generation, and retry logic
 * Must be loaded FIRST before other tracking scripts
 */

const TrackingUtils = {
    // ============================================
    // UTM CAPTURE AND PRESERVATION
    // ============================================
    
    utmParams: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
    
    /**
     * Capture UTMs from URL and save to localStorage.
     * Never overwrites paid UTMs (FB, google, tiktok, etc.) with organic/empty values.
     * Only a fresh ad click (with a real paid utm_source) can replace existing UTMs.
     */
    captureUTMs: function() {
        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.has('utm_source') || urlParams.has('utm_campaign')) {
            var newSource = (urlParams.get('utm_source') || '').toLowerCase();
            var existingSource = (localStorage.getItem('utm_source') || '').toLowerCase();
            
            var paidSources = ['fb','facebook','ig','instagram','google','gads','gclid','tiktok','tt','taboola','outbrain','bing','twitter','x','snapchat','pinterest','kwai','meta'];
            var existingIsPaid = paidSources.some(function(s) { return existingSource.indexOf(s) !== -1; });
            var newIsPaid = paidSources.some(function(s) { return newSource.indexOf(s) !== -1; });
            
            if (existingIsPaid && !newIsPaid) {
                console.log('[TrackingUtils] Skipping UTM overwrite: keeping paid source "' + existingSource + '" over "' + newSource + '"');
                return;
            }
            
            var expDate = new Date(new Date().getTime() + 7*24*60*60*1000).toISOString();
            this.utmParams.forEach(param => {
                const value = urlParams.get(param);
                if (value) {
                    localStorage.setItem(param, value);
                    localStorage.setItem(param + '_exp', expDate);
                }
            });
            console.log('[TrackingUtils] Captured UTMs from URL:', this.getStoredUTMs());
        }

        // Capture Google Ads gclid (persists across pages like fbc/fbp)
        const gclid = urlParams.get('gclid');
        if (gclid) {
            localStorage.setItem('gclid', gclid);
            console.log('[TrackingUtils] Captured gclid:', gclid);
        }
    },
    
    getGclid: function() {
        return localStorage.getItem('gclid') || null;
    },
    
    /**
     * Get all stored UTMs from localStorage
     * @returns {Object} UTM values
     */
    getStoredUTMs: function() {
        const utms = {};
        this.utmParams.forEach(param => {
            const value = localStorage.getItem(param);
            if (value) {
                utms[param] = value;
            }
        });
        return utms;
    },
    
    /**
     * Build UTM query string for checkout URLs
     * @param {Object} defaults - Default values if UTMs not in localStorage
     * @returns {String} Query string (without leading ?)
     */
    buildUTMQueryString: function(defaults = {}) {
        const params = [];
        
        this.utmParams.forEach(param => {
            const value = localStorage.getItem(param) || defaults[param];
            if (value) {
                params.push(`${param}=${encodeURIComponent(value)}`);
            }
        });
        
        return params.join('&');
    },
    
    /**
     * Append stored UTMs to any internal navigation URL.
     * Preserves existing query params and avoids duplicates.
     * @param {String} url - Target URL (e.g. 'phone.html?gender=male')
     * @returns {String} URL with UTMs appended
     */
    appendUTMs: function(url) {
        try {
            var base = url.split('?')[0];
            var existing = url.indexOf('?') !== -1 ? url.split('?')[1] : '';
            var params = new URLSearchParams(existing);
            this.utmParams.forEach(function(key) {
                if (!params.has(key)) {
                    var val = localStorage.getItem(key);
                    if (val) params.set(key, val);
                }
            });
            var fbclid = localStorage.getItem('fbclid_raw');
            if (fbclid && !params.has('fbclid')) params.set('fbclid', fbclid);
            var qs = params.toString();
            return qs ? base + '?' + qs : base;
        } catch(e) {
            return url;
        }
    },

    /**
     * Navigate to an internal funnel page preserving UTM params.
     * Drop-in replacement for window.location.href = url
     * @param {String} url - Target URL
     */
    navigateWithUTMs: function(url) {
        window.location.href = this.appendUTMs(url);
    },

    // ============================================
    // VISITOR ID (Centralized)
    // ============================================
    
    /**
     * Get or create a unique visitor ID
     * @returns {String} Visitor ID
     */
    getVisitorId: function() {
        let visitorId = localStorage.getItem('funnelVisitorId');
        if (!visitorId) {
            visitorId = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('funnelVisitorId', visitorId);
            console.log('[TrackingUtils] Generated new Visitor ID:', visitorId);
        }
        return visitorId;
    },
    
    // ============================================
    // RETRY LOGIC FOR TRACKING CALLS
    // ============================================
    
    /**
     * Send tracking request with retry logic
     * @param {String} url - API endpoint
     * @param {Object} data - Data to send
     * @param {Object} options - Options (retries, backoff)
     * @returns {Promise}
     */
    sendWithRetry: async function(url, data, options = {}) {
        const maxRetries = options.retries || 3;
        const baseBackoff = options.backoff || 1000; // 1 second
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    return { success: true, response };
                }
                
                // If server error (5xx), retry; if client error (4xx), don't retry
                if (response.status < 500) {
                    console.warn('[TrackingUtils] Client error, not retrying:', response.status);
                    return { success: false, status: response.status };
                }
                
            } catch (error) {
                console.warn(`[TrackingUtils] Attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
            }
            
            // Wait before retry (exponential backoff)
            if (attempt < maxRetries - 1) {
                const waitTime = baseBackoff * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        console.error('[TrackingUtils] All retry attempts failed for:', url);
        return { success: false, error: 'Max retries reached' };
    },
    
    /**
     * Send tracking using sendBeacon (for page unload)
     * Falls back to fetch if sendBeacon not available
     * @param {String} url - API endpoint
     * @param {Object} data - Data to send
     */
    sendBeacon: function(url, data) {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        
        if (navigator.sendBeacon) {
            const sent = navigator.sendBeacon(url, blob);
            if (sent) {
                console.log('[TrackingUtils] Beacon sent successfully');
                return true;
            }
        }
        
        // Fallback to fetch with keepalive
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            keepalive: true
        }).catch(err => console.warn('[TrackingUtils] Beacon fallback error:', err));
        
        return false;
    },
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    /**
     * Initialize tracking utilities
     * Call this on every page load
     */
    init: function() {
        // Capture UTMs from URL (if present)
        this.captureUTMs();
        
        // Ensure visitor ID exists
        this.getVisitorId();
        
        console.log('[TrackingUtils] Initialized', {
            visitorId: localStorage.getItem('funnelVisitorId'),
            utms: this.getStoredUTMs()
        });
    }
};

// Auto-initialize on script load
TrackingUtils.init();

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrackingUtils;
}
