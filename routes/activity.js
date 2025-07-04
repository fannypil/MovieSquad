const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const activityController = require('../controllers/activityController');

// @route   GET /api/activity/me
// @desc    Get my recent posts activity
// @access  Private
router.get('/me', auth, activityController.getMyPostsActivity);

// @route   GET /api/activity/feed
// @desc    Get friends' posts feed (main timeline)
// @access  Private
router.get('/feed', auth, activityController.getFriendsPostsFeed);

// @route   GET /api/activity/user/:userId
// @desc    Get a specific user's posts activity
// @access  Private
router.get('/user/:userId', auth, activityController.getUserPostsActivity);

// @route   GET /api/activity/stats
// @desc    Get activity statistics for current user
// @access  Private
router.get('/stats', auth, activityController.getActivityStats);

module.exports = router;