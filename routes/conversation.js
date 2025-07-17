const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles"); // If you want to restrict access by role
const conversationController = require("../controllers/conversationController");

// @route   GET /api/conversations/me
// @desc    Get all private conversations for the authenticated user
router.get(
  "/me",
  auth,
  authorizeRoles("user", "groupAdmin", "admin"),
  conversationController.getMyConversations
);

// @route   GET /api/conversations/:chatIdentifier/messages
// @desc    Get messages for a specific private conversation
router.get(
  "/:chatIdentifier/messages",
  auth,
  authorizeRoles("user", "groupAdmin", "admin"),
  conversationController.getConversationMessages
);

// @route   PUT /api/conversations/:chatIdentifier/read
// @desc    Mark messages in a private conversation as read by the current user
router.put(
  "/:chatIdentifier/read",
  auth,
  authorizeRoles("user", "groupAdmin", "admin"),
  conversationController.markConversationAsRead
);

module.exports = router;
