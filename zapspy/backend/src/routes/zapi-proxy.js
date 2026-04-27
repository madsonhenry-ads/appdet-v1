const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware');
const { zapiProfilePicture } = require('../services/zapi');

router.get('/profile-picture/:phone', authenticateToken, async (req, res) => {
    try {
        const picture = await zapiProfilePicture(req.params.phone);
        res.json({ link: picture || null });
    } catch (error) {
        console.error(`Z-API profile-picture exception:`, error.message);
        res.json({ link: null });
    }
});

module.exports = router;
