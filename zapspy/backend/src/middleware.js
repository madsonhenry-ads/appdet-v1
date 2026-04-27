/**
 * Authentication middleware, rate limiters, and cache utilities
 */
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Admin role check
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
};

// Rate limiters
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});

const leadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many submissions, please try again later.' }
});

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    message: { error: 'Too many admin requests, please slow down.' },
    standardHeaders: true,
    legacyHeaders: false
});

const bulkLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Too many bulk operations, try again later.' }
});

// In-memory cache
const apiCache = new Map();

function getCached(key, ttlMs) {
    const entry = apiCache.get(key);
    if (entry && (Date.now() - entry.time) < ttlMs) return entry.data;
    return null;
}

function setCache(key, data) {
    apiCache.set(key, { data, time: Date.now() });
    if (apiCache.size > 200) {
        const oldest = [...apiCache.entries()].sort((a, b) => a[1].time - b[1].time);
        for (let i = 0; i < 50; i++) apiCache.delete(oldest[i][0]);
    }
}

function invalidateCache(prefix) {
    for (const key of apiCache.keys()) {
        if (key.startsWith(prefix)) apiCache.delete(key);
    }
}

module.exports = {
    authenticateToken,
    requireAdmin,
    apiLimiter,
    leadLimiter,
    adminLimiter,
    bulkLimiter,
    getCached,
    setCache,
    invalidateCache
};
