/**
 * Google Ads Dynamic Loader
 * Loads gtag.js with ALL active Conversion IDs from the backend.
 * Supports multiple Google Ads accounts per language.
 */

const GoogleAdsLoader = {
    API_URL: window.ZAPSPY_API_URL || 'https://zapspy-funnel-production.up.railway.app',
    loaded: false,
    configs: [],

    getLanguage: function() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('/espanhol/') || path.includes('/es/')) return 'es';
        if (path.includes('/portugues/') || path.includes('/pt/')) return 'pt';
        return 'en';
    },

    load: function() {
        if (this.loaded) return;

        var self = this;
        var lang = this.getLanguage();

        fetch(this.API_URL + '/api/gads-config/' + lang)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.active) {
                    console.log('[GoogleAds] No active config for', lang);
                    return;
                }

                var cfgs = data.configs || [];
                if (cfgs.length === 0 && data.conversion_id) {
                    cfgs = [{ conversion_id: data.conversion_id, conversion_label: data.conversion_label }];
                }
                if (cfgs.length === 0) return;

                self.configs = cfgs;
                self.loaded = true;

                // Load gtag.js once with the first conversion ID
                var firstId = cfgs[0].conversion_id;
                var gtagScript = document.createElement('script');
                gtagScript.async = true;
                gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + firstId;
                document.head.appendChild(gtagScript);

                window.dataLayer = window.dataLayer || [];
                window.gtag = function() { window.dataLayer.push(arguments); };
                window.gtag('js', new Date());

                // Configure ALL conversion IDs
                for (var i = 0; i < cfgs.length; i++) {
                    window.gtag('config', cfgs[i].conversion_id);
                }

                console.log('[GoogleAds] gtag.js loaded with', cfgs.length, 'account(s):', cfgs.map(function(c) { return c.conversion_id; }).join(', '));
            })
            .catch(function(err) {
                console.log('[GoogleAds] Config fetch error:', err.message);
            });
    },

    sendConversion: function(transactionId, value, currency) {
        if (!this.configs.length || !window.gtag) return;

        for (var i = 0; i < this.configs.length; i++) {
            var cfg = this.configs[i];
            var sendTo = cfg.conversion_id + '/' + cfg.conversion_label;
            window.gtag('event', 'conversion', {
                send_to: sendTo,
                value: value || 0,
                currency: currency || 'USD',
                transaction_id: transactionId || ''
            });
            console.log('[GoogleAds] Conversion sent to', sendTo);
        }
    }
};

GoogleAdsLoader.load();
