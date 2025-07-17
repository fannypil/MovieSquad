const express = require("express");
const router = express.Router();
const tmdbController = require("../controllers/tmdbController");

// Search TMDB for movies/TV shows GET /api/tmdb/search
router.get("/search", tmdbController.searchTmdb);

// Get trending movies/TV shows GET /api/tmdb/trending
router.get("/trending", tmdbController.getTmdbTrending);

// Get videos for a specific movie/TV show GET /api/tmdb/:movieId/videos
router.get("/:movieId/videos", tmdbController.getTmdbVideos);

// Get details of a specific movie/TV show GET /api/tmdb/details/:id
router.get("/:type/:id", tmdbController.getTmdbDetails);

// Discover movies or TV shows with advanced filtering,  GET /api/tmdb/discover
router.get("/discover", tmdbController.discoverTmdb);

module.exports = router;
