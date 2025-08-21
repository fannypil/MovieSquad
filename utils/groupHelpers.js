const Group = require("../models/Group");
const User = require("../models/User");
const { createNotification } = require("./notificationService");

// Error handling helper
exports.handleServerError = (res, err, message = "Server error") => {
  console.error(err.message);
  if (err.kind === "ObjectId") {
    return res.status(400).json({ message: "Invalid ID format" });
  }
  if (err.code === 11000) {
    return res.status(400).json({
      message:
        "Duplicate key error: A resource with this unique field already exists.",
    });
  }
  res.status(500).json({ message: message });
};

// Group authorization checks
exports.checkGroupAccess = async (groupId, userId, requiredRole = "member") => {
  const group = await Group.findById(groupId);

  if (!group) {
    return { success: false, code: 404, message: "Group not found." };
  }

  const isAdmin = group.admin.toString() === userId;
  const isMember = group.members.includes(userId);

  if (requiredRole === "admin" && !isAdmin) {
    return {
      success: false,
      code: 403,
      message: "Forbidden: Only group admin can perform this action.",
    };
  }

  if (requiredRole === "member" && !isMember && !isAdmin) {
    return {
      success: false,
      code: 403,
      message: "Forbidden: You must be a member of this group.",
    };
  }

  return { success: true, group };
};

// Add user to group
exports.addUserToGroup = async (userId, groupId) => {
  // Add to group members
  const group = await Group.findById(groupId);
  if (!group.members.includes(userId)) {
    group.members.push(userId);
    await group.save();
  }

  // Add to user's groups
  const user = await User.findById(userId);
  if (user && !user.groups.includes(groupId)) {
    user.groups.push(groupId);
    await user.save();
  }

  return { user, group };
};

// Remove user from group
exports.removeUserFromGroup = async (userId, groupId) => {
  // Remove from group
  const group = await Group.findById(groupId);
  group.members.pull(userId);
  await group.save();

  // Remove from user's groups
  const user = await User.findById(userId);
  if (user) {
    user.groups.pull(groupId);
    await user.save();
  }

  return { user, group };
};

// Create group notifications
exports.createGroupNotification = async (
  recipientId,
  notificationType,
  senderId,
  groupId,
  customMessage = null
) => {
  await createNotification(recipientId, notificationType, {
    senderId: senderId,
    entityId: groupId,
    entityType: "Group",
    message: customMessage,
  });
};

// Validate TMDB content
exports.validateTMDBContent = (tmdbId, tmdbType, tmdbTitle) => {
  if (!tmdbId || !tmdbType || !tmdbTitle) {
    return { valid: false, message: "TMDB ID, type, and title are required." };
  }

  if (!["movie", "tv"].includes(tmdbType)) {
    return {
      valid: false,
      message: 'Invalid TMDB type. Must be "movie" or "tv".',
    };
  }

  return { valid: true };
};

// Check user's group status
exports.checkUserGroupStatus = (group, userId) => {
  return {
    isMember: group.members.includes(userId),
    isPending: group.pendingMembers.includes(userId),
    isAdmin: group.admin.toString() === userId,
  };
};
