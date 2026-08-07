/**
 * Whats Spy Funnel Configuration
 * Single source of truth for API URL and shared settings.
 * Include this script BEFORE other funnel scripts in HTML pages.
 *
 * Em localhost: usa o mesmo host do funil na porta 3000 quando a página não está já na 3000
 * (ex.: Live Server). Assim /api/whatsapp-check bate no backend local e os logs aparecem no terminal.
 */
(function() {
    var PROD = 'https://zapspy-funnel-production.up.railway.app';
    if (typeof location === 'undefined' || location.protocol === 'file:') {
        window.ZAPSPY_API_URL = PROD;
        return;
    }
    var h = location.hostname || '';
    var local = h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
    if (local) {
        window.ZAPSPY_API_URL = (location.port === '3000' || location.port === '')
            ? location.origin
            : location.protocol + '//' + h + ':3000';
        return;
    }
    var railwayHosts = ['go.zappdetect.com', 'zapspy-funnel-production.up.railway.app'];
    if (railwayHosts.indexOf(h) !== -1) {
        window.ZAPSPY_API_URL = location.origin;
        return;
    }
    window.ZAPSPY_API_URL = PROD;
})();
