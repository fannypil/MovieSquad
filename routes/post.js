const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");
const postController = require("../controllers/postController");

// POWERFUL SEARCH - MOVE THIS TO THE TOP
router.get("/search", postController.searchPosts);

// Create a new post POST /api/posts
router.post(
  "/",
  auth,
  authorizeRoles("user", "groupAdmin", "admin"),
  postController.createPost
);

// Get all posts GET /api/posts
router.get("/", postController.getPosts);

// Get post by id GET /api/posts/:id - AFTER /search
router.get("/:id", postController.getPostById);

// Update post by id PUT /api/posts/:id
router.put(
  "/:id",
  auth,
  authorizeRoles("user", "groupAdmin", "admin"),
  postController.updatePost
);

// Delete post by id DELETE /api/posts/:id
router.delete(
  "/:id",
  auth,
  authorizeRoles("user", "groupAdmin", "admin"),
  postController.deletePost
);

// Like or Unlike a post,PUT /api/posts/:id/like
router.put(
  "/:id/like",
  auth,
  authorizeRoles("user", "groupAdmin", "admin"),
  postController.likePost
);

//Add a comment to a post, POST /api/posts/:id/comments
router.post(
  "/:id/comments",
  auth,
  authorizeRoles("user", "groupAdmin", "admin"),
  postController.addComment
);

// Delete a comment from a post,  DELETE /api/posts/:postId/comments/:commentId
router.delete(
  "/:postId/comments/:commentId",
  auth,
  authorizeRoles("user", "groupAdmin", "admin"),
  postController.deleteComment
);

module.exports = router;
