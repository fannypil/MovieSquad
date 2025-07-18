const Group = require("../models/Group");
const User = require("../models/User");
const { createNotification } = require("../utils/notificationService"); // Add this import
const Notification = require("../models/Notification");

// Helper function for consistent error handling
const handleServerError = (res, err, message = "Server error") => {
  console.error(err.message);
  if (err.kind === "ObjectId") {
    return res.status(400).json({ message: "Invalid ID format" });
  }
  if (err.code === 11000) {
    return res
      .status(400)
      .json({
        message:
          "Duplicate key error: A resource with this unique field already exists.",
      });
  }
  res.status(500).json({ message: message });
};

// @desc    Create a new group
// @route   POST /api/groups
// @access  Private (only authenticated users can create groups)
exports.createGroup = async (req, res) => {
  const { name, description, isPrivate } = req.body;

  // Validate input
  if (!name || !description) {
    return res
      .status(400)
      .json({ message: "Please enter all fields (name and description)" });
  }
  try {
    //Check if a group with the same name already exists
    let group = await Group.findOne({ name });
    if (group) {
      return res
        .status(400)
        .json({ msg: "Group with this name already exists" });
    }
    // Create a new group
    group = new Group({
      name,
      description,
      isPrivate: typeof isPrivate === "boolean" ? isPrivate : false,
      admin: req.user.id, // The authenticated user becomes the admin
      members: [req.user.id], // The admin is also the first member
    });
    // Save the group to the database
    await group.save();
    // add the group to the user's groups list
    const user = await User.findById(req.user.id);
    // Ensure user exists
    if (user) {
      if (!user.groups) {
        user.groups = [];
      }
      if (!user.groups.includes(group._id)) {
        user.groups.push(group._id);
      }
      await user.save();
    }
    res.status(201).json(group); // 201 Created
  } catch (err) {
    handleServerError(res, err, "Server Error creating group");
  }
};

// @desc    Get all groups
// @route   GET /api/groups
// @access  Public (anyone can view groups)
exports.getAllGroups = async (req, res) => {
  try {
    const groups = await Group.find()
      .populate("admin", "username email")
      .populate("members", "username email");
    res.json(groups);
  } catch (err) {
    handleServerError(res, err, "Server Error fetching all groups");
  }
};

// @desc    Get group by ID
// @route   GET /api/groups/:id
// @access  Public (anyone can view a specific group)
exports.getGroupById = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("admin", "username email")
      .populate("members", "username email");
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    res.json(group);
  } catch (err) {
    handleServerError(res, err, "Server Error fetching group by ID");
  }
};

// @desc    Update a group
// @route   PUT /api/groups/:id
// @access  Private (only group admin or global admin)
exports.updateGroup = async (req, res) => {
  const { name, description, isPrivate } = req.body;
  const groupId = req.params.id;
  try {
    let group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ msg: "Group not found" });
    }
    // Check if the user is the admin of the group
    if (group.admin.toString() !== req.user.id && req.user.role !== "admin") {
      return res
        .status(403)
        .json({
          msg: "Forbidden: You are not authorized to update this group",
        });
    }
    if (name && name !== group.name) {
      const existingGroup = await Group.findOne({ name });
      if (existingGroup && existingGroup._id.toString() !== groupId) {
        return res
          .status(400)
          .json({ msg: "Another group with this name already exists" });
      }
    }
    // Update group details
    if (name) group.name = name;
    if (description) group.description = description;
    if (typeof isPrivate === "boolean") group.isPrivate = isPrivate;
    await group.save();
    res.json(group);
  } catch (err) {
    handleServerError(res, err, "Server Error updating group");
  }
};

// @desc    Delete a group
// @route   DELETE /api/groups/:id
// @access  Private (only group admin or global admin)
exports.deleteGroup = async (req, res) => {
  const groupId = req.params.id;
  try {
    let group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ msg: "Group not found" });
    }
    // Check if the user is the admin of the group
    if (group.admin.toString() !== req.user.id && req.user.role !== "admin") {
      return res
        .status(403)
        .json({
          msg: "Forbidden: You are not authorized to delete this group",
        });
    }
    // Remove the group from the user's groups list
    await Group.deleteOne({ _id: groupId });
    //remove this group from all users
    await User.updateMany({ groups: groupId }, { $pull: { groups: groupId } });
    res.json({ msg: "Group deleted successfully" });
  } catch (err) {
    handleServerError(res, err, "Server Error deleting group");
  }
};

// Add a movie/TV show to a group's shared watchlist,  POST /api/groups/:id/watchlist
exports.addToSharedWatchlist = async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;
  const { tmdbId, tmdbType, tmdbTitle, tmdbPosterPath } = req.body;

  // Validate input
  if (!tmdbId || !tmdbType || !tmdbTitle) {
    return res
      .status(400)
      .json({ message: "TMDB ID, type, and title are required." });
  }
  if (!["movie", "tv"].includes(tmdbType)) {
    return res
      .status(400)
      .json({ message: 'Invalid TMDB type. Must be "movie" or "tv".' });
  }

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Authorization: Only group members or admins can add to watchlist
    if (
      !group.members.includes(userId) &&
      group.admin.toString() !== userId &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({
          message:
            "Forbidden: You must be a member or admin of this group to add to its watchlist.",
        });
    }

    // Check for duplicates in the shared watchlist
    const alreadyExists = group.sharedWatchlist.some(
      (item) => item.tmdbId === tmdbId && item.tmdbType === tmdbType
    );

    if (alreadyExists) {
      return res
        .status(400)
        .json({
          message: "Content already exists in this group's shared watchlist.",
        });
    }

    const newItem = {
      tmdbId,
      tmdbType,
      tmdbTitle,
      tmdbPosterPath: tmdbPosterPath || null,
      addedBy: userId,
      addedAt: Date.now(),
    };

    group.sharedWatchlist.unshift(newItem); // Add to the beginning (most recent first)
    await group.save();
    // CREATE NOTIFICATIONS: Notify all group members except the one who added it
    const membersToNotify = group.members.filter(
      (memberId) => memberId.toString() !== userId
    );

    for (const memberId of membersToNotify) {
      await createNotification(memberId, "group_watchlist_add", {
        senderId: userId,
        entityId: groupId,
        entityType: "Group",
        message: `${req.user.username || "Someone"} added "${tmdbTitle}" to ${group.name}'s watchlist.`,
      });
    }

    // Populate the addedBy field for the newly added item before sending response
    const updatedGroup = await Group.findById(groupId).populate(
      "sharedWatchlist.addedBy",
      "username email"
    );

    // Find the specific item we just added to return it
    const addedItem = updatedGroup.sharedWatchlist.find(
      (item) => item.tmdbId === tmdbId && item.tmdbType === tmdbType
    );

    res.status(201).json(addedItem);
  } catch (err) {
    handleServerError(res, err, "Server Error adding to shared watchlist");
  }
};

//  Remove a movie/TV show from a group's shared watchlist,  DELETE /api/groups/:id/watchlist/:tmdbId/:tmdbType
exports.removeFromSharedWatchlist = async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;
  const { tmdbId, tmdbType } = req.params; // Get TMDB details from URL params

  if (!tmdbId || !tmdbType) {
    return res
      .status(400)
      .json({ message: "TMDB ID and type are required in params." });
  }
  if (!["movie", "tv"].includes(tmdbType)) {
    return res
      .status(400)
      .json({ message: 'Invalid TMDB type. Must be "movie" or "tv".' });
  }

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Authorization: Group members or admins can remove, or global admin
    if (
      !group.members.includes(userId) &&
      group.admin.toString() !== userId &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({
          message:
            "Forbidden: You must be a member or admin of this group to remove from its watchlist.",
        });
    }

    // Check if the item exists in the watchlist
    const initialLength = group.sharedWatchlist.length;
    group.sharedWatchlist = group.sharedWatchlist.filter(
      (item) => !(item.tmdbId == tmdbId && item.tmdbType === tmdbType)
    );

    if (group.sharedWatchlist.length === initialLength) {
      return res
        .status(404)
        .json({
          message: "Content not found in this group's shared watchlist.",
        });
    }

    await group.save();
    res.json({
      msg: "Content removed from shared watchlist successfully",
      sharedWatchlist: group.sharedWatchlist,
    });
  } catch (err) {
    handleServerError(res, err, "Server Error removing from shared watchlist");
  }
};

//  Get a group's shared watchlist,  GET /api/groups/:id/watchlist
exports.getSharedWatchlist = async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user ? req.user.id : null; // User might not be authenticated for public groups

  try {
    const group = await Group.findById(groupId).populate(
      "sharedWatchlist.addedBy",
      "username email"
    ); // Populate who added the item

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Authorization: If group is private, only members/admin (or global admin) can view
    if (group.isPrivate) {
      if (
        !userId ||
        (!group.members.includes(userId) &&
          group.admin.toString() !== userId &&
          req.user.role !== "admin")
      ) {
        return res
          .status(403)
          .json({
            message:
              "Forbidden: You must be a member or admin of this private group to view its watchlist.",
          });
      }
    }
    // For public groups, anyone can view, so no further check needed.

    res.json(group.sharedWatchlist);
  } catch (err) {
    handleServerError(res, err, "Server Error fetching shared watchlist");
  }
};
// Join a group, PUT /api/groups/:id/join
exports.joinGroup = async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check if user is already a member
    if (group.members.includes(userId)) {
      return res
        .status(400)
        .json({ message: "You are already a member of this group." });
    }

    // For private groups, you might want to implement an invitation system
    if (group.isPrivate) {
      return res
        .status(403)
        .json({
          message: "This is a private group. You need an invitation to join.",
        });
    }

    // Add user to group members
    group.members.push(userId);
    await group.save();

    // Add group to user's groups
    const user = await User.findById(userId);
    if (user && !user.groups.includes(groupId)) {
      user.groups.push(groupId);
      await user.save();
    }

    // CREATE NOTIFICATION: Notify group admin that someone joined
    if (group.admin.toString() !== userId) {
      await createNotification(group.admin, "group_joined", {
        senderId: userId,
        entityId: groupId,
        entityType: "Group",
      });
    }

    res.json({ message: "Successfully joined the group", group });
  } catch (err) {
    handleServerError(res, err, "Server Error joining group");
  }
};

// Invite user to group, POST /api/groups/:id/invite
exports.inviteToGroup = async (req, res) => {
  const groupId = req.params.id;
  const { inviteeId } = req.body; // User to invite
  const inviterId = req.user.id;

  if (!inviteeId) {
    return res.status(400).json({ message: "Invitee ID is required" });
  }

  try {
    const group = await Group.findById(groupId);
    const invitee = await User.findById(inviteeId);

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!invitee) {
      return res.status(404).json({ message: "User to invite not found." });
    }

    // Check if inviter has permission (admin or member for non-private groups)
    if (
      group.admin.toString() !== inviterId &&
      !group.members.includes(inviterId) &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You must be a member or admin to invite others.",
        });
    }

    // Check if user is already a member
    if (group.members.includes(inviteeId)) {
      return res
        .status(400)
        .json({ message: "User is already a member of this group." });
    }

    // CREATE NOTIFICATION: Notify the invitee
    await createNotification(inviteeId, "group_invite", {
      senderId: inviterId,
      entityId: groupId,
      entityType: "Group",
    });

    res.json({ message: "Group invitation sent successfully" });
  } catch (err) {
    handleServerError(res, err, "Server Error sending group invitation");
  }
};
// Request to join a private group
exports.requestToJoinGroup = async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check if user is already a member
    if (group.members.includes(userId)) {
      return res
        .status(400)
        .json({ message: "You are already a member of this group." });
    }

    // Check if user already has a pending request
    if (group.pendingMembers.includes(userId)) {
      return res
        .status(400)
        .json({
          message: "You already have a pending request for this group.",
        });
    }

    // Add to pending members
    group.pendingMembers.push(userId);
    await group.save();

    // CREATE NOTIFICATION: Notify group admin about join request
    await createNotification(group.admin, "group_join_request", {
      senderId: userId,
      entityId: groupId,
      entityType: "Group",
    });

    res.json({ message: "Join request sent successfully" });
  } catch (err) {
    handleServerError(res, err, "Server Error sending join request");
  }
};

// Accept group invitation (for invitees)
exports.acceptGroupInvitation = async (req, res) => {
  const notificationId = req.params.notificationId;
  const userId = req.user.id;

  try {
    // Find the notification
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: "Invitation not found." });
    }

    // Verify this notification belongs to the user and is a group invite
    if (
      notification.recipient.toString() !== userId ||
      notification.type !== "group_invite"
    ) {
      return res.status(403).json({ message: "Invalid invitation." });
    }

    // Get the group
    const group = await Group.findById(notification.entityId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check if user is already a member
    if (group.members.includes(userId)) {
      return res
        .status(400)
        .json({ message: "You are already a member of this group." });
    }

    // Add user to group members
    group.members.push(userId);
    await group.save();

    // Add group to user's groups
    const user = await User.findById(userId);
    if (user && !user.groups.includes(group._id)) {
      user.groups.push(group._id);
      await user.save();
    }

    // Mark notification as read and processed
    notification.read = true;
    await notification.save();

    // CREATE NOTIFICATION: Notify group admin that user joined
    await createNotification(group.admin, "group_joined", {
      senderId: userId,
      entityId: group._id,
      entityType: "Group",
    });

    res.json({ message: "Successfully joined the group", group });
  } catch (err) {
    handleServerError(res, err, "Server Error accepting group invitation");
  }
};

// Reject group invitation (for invitees)
exports.rejectGroupInvitation = async (req, res) => {
  const notificationId = req.params.notificationId;
  const userId = req.user.id;

  try {
    // Find the notification
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: "Invitation not found." });
    }

    // Verify this notification belongs to the user and is a group invite
    if (
      notification.recipient.toString() !== userId ||
      notification.type !== "group_invite"
    ) {
      return res.status(403).json({ message: "Invalid invitation." });
    }

    // Mark notification as read
    notification.read = true;
    await notification.save();

    res.json({ message: "Group invitation rejected" });
  } catch (err) {
    handleServerError(res, err, "Server Error rejecting group invitation");
  }
};

// Accept join request (for group admins)
exports.acceptJoinRequest = async (req, res) => {
  const groupId = req.params.id;
  const requesterId = req.params.userId;
  const adminId = req.user.id;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check if user is group admin
    if (group.admin.toString() !== adminId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({
          message: "Forbidden: Only group admin can accept join requests.",
        });
    }

    // Check if requester is in pending members
    if (!group.pendingMembers.includes(requesterId)) {
      return res
        .status(400)
        .json({ message: "No pending request from this user." });
    }

    // Check if user is already a member
    if (group.members.includes(requesterId)) {
      return res
        .status(400)
        .json({ message: "User is already a member of this group." });
    }

    // Add to members and remove from pending
    group.members.push(requesterId);
    group.pendingMembers.pull(requesterId);
    await group.save();

    // Add group to user's groups
    const user = await User.findById(requesterId);
    if (user && !user.groups.includes(groupId)) {
      user.groups.push(groupId);
      await user.save();
    }

    // CREATE NOTIFICATION: Notify requester that request was accepted
    await createNotification(requesterId, "group_request_accepted", {
      senderId: adminId,
      entityId: groupId,
      entityType: "Group",
    });

    res.json({ message: "Join request accepted successfully" });
  } catch (err) {
    handleServerError(res, err, "Server Error accepting join request");
  }
};

// Reject join request (for group admins)
exports.rejectJoinRequest = async (req, res) => {
  const groupId = req.params.id;
  const requesterId = req.params.userId;
  const adminId = req.user.id;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check if user is group admin
    if (group.admin.toString() !== adminId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({
          message: "Forbidden: Only group admin can reject join requests.",
        });
    }

    // Check if requester is in pending members
    if (!group.pendingMembers.includes(requesterId)) {
      return res
        .status(400)
        .json({ message: "No pending request from this user." });
    }

    // Remove from pending
    group.pendingMembers.pull(requesterId);
    await group.save();

    // CREATE NOTIFICATION: Notify requester that request was rejected
    await createNotification(requesterId, "group_request_rejected", {
      senderId: adminId,
      entityId: groupId,
      entityType: "Group",
    });

    res.json({ message: "Join request rejected" });
  } catch (err) {
    handleServerError(res, err, "Server Error rejecting join request");
  }
};
// Check if current user has pending request for a specific group
exports.checkMyRequestStatus = async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check if user has pending request
    const hasPendingRequest = group.pendingMembers.includes(userId);

    res.json({
      hasPendingRequest,
      groupId,
      userId,
    });
  } catch (err) {
    handleServerError(res, err, "Server Error checking request status");
  }
};
// Get pending join requests for a group (for group admins)
exports.getPendingRequests = async (req, res) => {
  const groupId = req.params.id;
  const adminId = req.user.id;

  try {
    const group = await Group.findById(groupId).populate(
      "pendingMembers",
      "username email profilePicture"
    );

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check if user is group admin
    if (group.admin.toString() !== adminId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({
          message: "Forbidden: Only group admin can view join requests.",
        });
    }

    res.json(group.pendingMembers);
  } catch (err) {
    handleServerError(res, err, "Server Error fetching pending requests");
  }
};

// Leave a group
exports.leaveGroup = async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check if user is a member
    if (!group.members.includes(userId)) {
      return res
        .status(400)
        .json({ message: "You are not a member of this group." });
    }

    // Admin cannot leave their own group (they must transfer ownership or delete the group)
    if (group.admin.toString() === userId) {
      return res.status(400).json({
        message:
          "As group admin, you cannot leave the group. Transfer ownership or delete the group instead.",
      });
    }

    // Remove user from group members
    group.members.pull(userId);
    await group.save();

    // Remove group from user's groups
    const user = await User.findById(userId);
    if (user) {
      user.groups.pull(groupId);
      await user.save();
    }

    res.json({ message: "Successfully left the group" });
  } catch (err) {
    handleServerError(res, err, "Server Error leaving group");
  }
};

// Remove member from group (admin only)
exports.removeMember = async (req, res) => {
  const groupId = req.params.id;
  const memberToRemove = req.params.userId;
  const adminId = req.user.id;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const isGroupAdmin = group.admin.toString() === adminId;
    const isGlobalAdmin = req.user.role === "admin";

    if (!isGroupAdmin && !isGlobalAdmin) {
      return res
        .status(403)
        .json({ message: "Forbidden: Only group admin can remove members." });
    }

    // Cannot remove self (admin should use leave group instead)
    if (memberToRemove === adminId) {
      return res
        .status(400)
        .json({
          message: "You cannot remove yourself. Use leave group instead.",
        });
    }

    // Check if user is a member
    if (!group.members.includes(memberToRemove)) {
      return res
        .status(400)
        .json({ message: "User is not a member of this group." });
    }

    // Remove user from group members
    group.members.pull(memberToRemove);
    await group.save();

    // Remove group from user's groups
    const user = await User.findById(memberToRemove);
    if (user) {
      user.groups.pull(groupId);
      await user.save();
    }

    // CREATE NOTIFICATION: Notify removed member
    await createNotification(memberToRemove, "group_removed", {
      senderId: adminId,
      entityId: groupId,
      entityType: "Group",
    });

    res.json({ message: "Member removed successfully" });
  } catch (err) {
    handleServerError(res, err, "Server Error removing member");
  }
};
