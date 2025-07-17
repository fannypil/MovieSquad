const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");

// @route   GET /api/user/me
// @desc    Get current authenticated user's profile
// @access  Private (requires authentication)
router.get("/me", auth, userController.getMe);

// @route   PUT /api/user/me
// @desc    Update current logged in user's profile (username, bio, profilePicture, email)
// @access  Private
router.put("/me", auth, userController.updateMe);

// @route   PUT /api/user/me/settings, update profile settings
router.put("/me/settings", auth, userController.updateProfileSettings);

// -- ROUTES FOR MANAGING WATCHED CONTENT --
// @route   PUT /api/user/me/watched
router.put("/me/watched", auth, userController.addWatchedContent);

// @route   DELETE /api/user/me/watched/:tmdbId/:tmdbType
router.delete(
  "/me/watched/:tmdbId/:tmdbType",
  auth,
  userController.removeWatchedContent
);

// -- ROUTES FOR MANAGING FAVORITE MOVIES --
// @route   PUT /api/user/me/favorite-movies
router.put("/me/favorite-movies", auth, userController.addFavoriteMovie);

// @route   DELETE /api/user/me/favorite-movies/:tmdbId
router.delete(
  "/me/favorite-movies/:tmdbId",
  auth,
  userController.removeFavoriteMovie
);

// -- ROUTES FOR MANAGING FAVORITE GENRES --
// @route   PUT /api/user/me/genres
router.put("/me/genres", auth, userController.addFavoriteGenre);

// @route   DELETE /api/user/me/genres/:genreName
router.delete(
  "/me/genres/:genreName",
  auth,
  userController.removeFavoriteGenre
);

// -- ROUTES FOR MANAGING FRIENDS --
// @route   PUT /api/user/me/friends/:friendId
router.put("/me/friends/:friendId", auth, userController.addFriend);

// @route   DELETE /api/user/me/friends/:friendId
router.delete("/me/friends/:friendId", auth, userController.removeFriend);

//  GET /api/user/me/friends
router.get("/me/friends", auth, userController.getMyFriends);

// Friend request routes
router.post("/friends/request", auth, userController.sendFriendRequest);
router.put("/friends/accept", auth, userController.acceptFriendRequest);
router.put("/friends/reject", auth, userController.rejectFriendRequest);
// GET /api/user/me/friend-requests, Get pending friend requests
router.get(
  "/me/friend-requests",
  auth,
  userController.getPendingFriendRequests
);

// @route   GET /api/user/friends
router.get("/search", auth, userController.searchUsers);
// @route   GET /api/user/profile/:userId
router.get("/profile/:userId", auth, userController.getUserProfile);

module.exports = router;
