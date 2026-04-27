/**
 * Centralized error handling middleware
 * Catches unhandled errors from route handlers and returns consistent responses.
 * Must be registered AFTER all routes in server.js.
 */

function errorHandler(err, req, res, next) {
    // CORS error
    if (err.message === 'CORS not allowed') {
        return res.status(403).json({
            error: 'Origin not allowed',
            status: 403
        });
    }

    // Log the error with context
    const errorInfo = {
        method: req.method,
        path: req.path,
        ip: req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
        timestamp: new Date().toISOString()
    };

    console.error(`❌ Unhandled error [${errorInfo.method} ${errorInfo.path}]:`, err.message);
    if (process.env.NODE_ENV !== 'production') {
        console.error(err.stack);
    }

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // Build response
    const response = {
        error: statusCode === 500 ? 'Internal server error' : err.message,
        status: statusCode
    };

    // Include stack trace in development
    if (process.env.NODE_ENV !== 'production') {
        response.details = err.message;
        response.path = errorInfo.path;
    }

    res.status(statusCode).json(response);
}

// 404 handler for unknown routes
function notFoundHandler(req, res) {
    // Skip for static file requests (they're handled by express.static)
    if (req.path.match(/\.(html|css|js|png|jpg|gif|svg|ico|woff|ttf|map)$/)) {
        return res.status(404).end();
    }

    // Only respond with JSON for API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            error: 'Endpoint not found',
            path: req.path,
            method: req.method,
            status: 404
        });
    }

    // For non-API routes, let it fall through (static files, etc.)
    res.status(404).end();
}

module.exports = { errorHandler, notFoundHandler };
