/**
 * Email Tracking Public Routes
 * 
 * These endpoints are PUBLIC (no auth) because they are called from emails:
 * 
 * TrackId-based (for future use):
 * - GET /t/o/:trackId — Open tracking pixel (1x1 transparent PNG)
 * - GET /t/c/:trackId — Click tracking redirect
 * 
 * Email-based (used in AC campaign templates with %EMAIL% personalization):
 * - GET /t/open — Open tracking pixel with query params: e, c, l, n
 * - GET /t/click — Click tracking redirect with query params: e, c, l, n, url
 */

const express = require('express');
const router = express.Router();
const trackingService = require('../services/email-tracking');

// ==================== EMAIL-BASED OPEN TRACKING ====================
// Used in AC templates: <img src="https://domain/t/open?e=%EMAIL%&c=sale_cancelled&l=en&n=1" width="1" height="1" />

router.get('/t/open', async (req, res) => {
  try {
    const { e: email, c: category, l: language, n: emailNum } = req.query;
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'] || '';

    if (email && category && language && emailNum) {
      // Record the open event (non-blocking)
      trackingService.recordOpenByEmail(
        email, category, language, parseInt(emailNum), ipAddress, userAgent
      ).catch(() => {});
    }

    // Return 1x1 transparent PNG
    const pixel = trackingService.getTrackingPixel();
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(pixel);
  } catch (error) {
    const pixel = trackingService.getTrackingPixel();
    res.set('Content-Type', 'image/png');
    res.end(pixel);
  }
});

// ==================== EMAIL-BASED CLICK TRACKING ====================
// Used in AC templates: <a href="https://domain/t/click?e=%EMAIL%&c=sale_cancelled&l=en&n=1&url=https://Whats Spy">

router.get('/t/click', async (req, res) => {
  try {
    const { e: email, c: category, l: language, n: emailNum, url } = req.query;
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'] || '';

    if (email && category && language && emailNum) {
      // Record the click event (non-blocking)
      trackingService.recordClickByEmail(
        email, category, language, parseInt(emailNum), url, ipAddress, userAgent
      ).catch(() => {});
    }

    // Redirect to the original URL
    if (url) {
      res.redirect(302, url);
    } else {
      res.redirect(302, 'https://Whats Spy');
    }
  } catch (error) {
    const fallbackUrl = req.query.url || 'https://Whats Spy';
    res.redirect(302, fallbackUrl);
  }
});

// ==================== TRACKID-BASED OPEN TRACKING (LEGACY) ====================
// Embedded in emails as: <img src="https://domain/t/o/{trackId}" width="1" height="1" />

router.get('/t/o/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'] || '';

    trackingService.recordOpen(trackId, ipAddress, userAgent).catch(() => {});

    const pixel = trackingService.getTrackingPixel();
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(pixel);
  } catch (error) {
    const pixel = trackingService.getTrackingPixel();
    res.set('Content-Type', 'image/png');
    res.end(pixel);
  }
});

// ==================== TRACKID-BASED CLICK TRACKING (LEGACY) ====================
// Links in emails: https://domain/t/c/{trackId}?url={encodedOriginalUrl}

router.get('/t/c/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;
    const { url } = req.query;
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'] || '';

    trackingService.recordClick(trackId, url, ipAddress, userAgent).catch(() => {});

    if (url) {
      res.redirect(302, url);
    } else {
      res.redirect(302, 'https://Whats Spy');
    }
  } catch (error) {
    const fallbackUrl = req.query.url || 'https://Whats Spy';
    res.redirect(302, fallbackUrl);
  }
});

module.exports = router;
