// Sentry init stub
(function() {
    if (typeof Sentry === 'undefined') {
        window.Sentry = {
            init: function(){},
            captureException: function(){},
            captureMessage: function(){},
            withScope: function(){}
        };
    }
})();