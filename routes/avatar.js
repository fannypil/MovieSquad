const express = require('express');
const router = express.Router();
const avatarController = require('../controllers/avatarController');

// @route   GET /api/avatars
// @desc    Get all available predefined avatars
// @access  Public (no auth required as these are just display options)
router.get('/', avatarController.getAvatars);

module.exports = router;