const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const auth = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/authorizeRoles');

// Get posts per group per month for the last 12 months, GET /api/stats/posts-per-group-monthly
router.get('/posts-per-group-monthly', statsController.getPostsPerGroupMonthly);

// Get top N favorite genres by user count, GET /api/stats/top-genres
router.get('/top-genres', statsController.getTopGenresByUserCount);

// Get posts per user per month for the last 12 months, GET /api/stats/posts-per-user-monthly
router.get('/posts-per-user-monthly', statsController.getPostsPerUserMonthly);

// Get comprehensive statistics summary, GET /api/stats/summary
router.get('/summary', auth, authorizeRoles('admin'), statsController.getStatsSummary);

module.exports = router;