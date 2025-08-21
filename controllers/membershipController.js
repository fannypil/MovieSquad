const Group = require("../../models/Group");
const User = require("../../models/User");
const Notification = require("../../models/Notification");
const {handleServerError,checkGroupAccess,addUserToGroup,removeUserFromGroup,
  createGroupNotification,checkUserGroupStatus} = require("../../utils/groupHelpers");

exports.joinGroup = async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  try {
    // Find group and check basic access
    const { success, code, message, group } = await checkGroupAccess(
      groupId,
      userId,
      null
    );
    if (!success) {
      return res.status(code).json({ message });
    }

    // Check membership status
    const status = checkUserGroupStatus(group, userId);
    if (status.isMember) {
      return res
        .status(400)
        .json({ message: "You are already a member of this group." });
    }

    // Check if private
    if (group.isPrivate) {
      return res.status(403).json({
        message: "This is a private group. You need an invitation to join.",
      });
    }

    // Add user to group
    await addUserToGroup(userId, groupId);

    // Send notification
    if (group.admin.toString() !== userId) {
      await createGroupNotification(
        group.admin,
        "group_joined",
        userId,
        groupId
      );
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
      return res.status(403).json({
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
    // Find group and do basic checks
    const { success, code, message, group } = await checkGroupAccess(
      groupId,
      userId,
      null
    );
    if (!success) {
      return res.status(code).json({ message });
    }

    // Check user status with group
    const status = checkUserGroupStatus(group, userId);

    // Check if user is already a member
    if (status.isMember) {
      return res
        .status(400)
        .json({ message: "You are already a member of this group." });
    }

    // Check if user already has a pending request
    if (status.isPending) {
      return res.status(400).json({
        message: "You already have a pending request for this group.",
      });
    }

    // Add to pending members
    group.pendingMembers.push(userId);
    await group.save();

    // Notify group admin
    await createGroupNotification(
      group.admin,
      "group_join_request",
      userId,
      groupId
    );

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
    const { success, code, message, group } = await checkGroupAccess(
      groupId,
      adminId,
      "admin"
    );
    if (!success) {
      return res.status(code).json({ message });
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
    // group.members.push(requesterId);
    group.pendingMembers.pull(requesterId);
    await group.save();

    // Add user to group
    await addUserToGroup(requesterId, groupId);

    // Notify requester
    await createGroupNotification(
      requesterId,
      "group_request_accepted",
      adminId,
      groupId
    );
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
    // Check if admin has access to group
    const { success, code, message, group } = await checkGroupAccess(
      groupId,
      adminId,
      "admin"
    );
    if (!success) {
      return res.status(code).json({ message });
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

    // Notify requester
    await createGroupNotification(
      requesterId,
      "group_request_rejected",
      adminId,
      groupId
    );

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
    // Find group and check access
    const { success, code, message, group } = await checkGroupAccess(
      groupId,
      userId,
      null
    );
    if (!success) {
      return res.status(code).json({ message });
    }

    // Get user's status with group
    const status = checkUserGroupStatus(group, userId);

    res.json({
      hasPendingRequest: status.isPending,
      isMember: status.isMember,
      isAdmin: status.isAdmin,
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
    // Check if admin has access
    const { success, code, message, group } = await checkGroupAccess(
      groupId,
      adminId,
      "admin"
    );
    if (!success) {
      return res.status(code).json({ message });
    }

    // Get populated pending members
    const populatedGroup = await Group.findById(groupId).populate(
      "pendingMembers",
      "username email profilePicture"
    );

    res.json(populatedGroup.pendingMembers);
  } catch (err) {
    handleServerError(res, err, "Server Error fetching pending requests");
  }
};

// Leave a group
exports.leaveGroup = async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  try {
    // Find group and check access
    const { success, code, message, group } = await checkGroupAccess(
      groupId,
      userId,
      null
    );
    if (!success) {
      return res.status(code).json({ message });
    }

    // Get user's status with group
    const status = checkUserGroupStatus(group, userId);

    if (!status.isMember) {
      return res
        .status(400)
        .json({ message: "You are not a member of this group." });
    }

    // Admin cannot leave their own group
    if (status.isAdmin) {
      return res.status(400).json({
        message:
          "As group admin, you cannot leave the group. Transfer ownership or delete the group instead.",
      });
    }

    // Remove user from group
    await removeUserFromGroup(userId, groupId);

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
    // Check if admin has access
    const { success, code, message, group } = await checkGroupAccess(
      groupId,
      adminId,
      "admin"
    );
    if (!success) {
      return res.status(code).json({ message });
    }

    // Cannot remove self (admin should use leave group instead)
    if (memberToRemove === adminId) {
      return res.status(400).json({
        message: "You cannot remove yourself. Use leave group instead.",
      });
    }

    // Check if user is a member
    if (!group.members.includes(memberToRemove)) {
      return res
        .status(400)
        .json({ message: "User is not a member of this group." });
    }

    // Remove user from group
    await removeUserFromGroup(memberToRemove, groupId);

    // Notify removed member
    await createGroupNotification(
      memberToRemove,
      "group_removed",
      adminId,
      groupId
    );

    res.json({ message: "Member removed successfully" });
  } catch (err) {
    handleServerError(res, err, "Server Error removing member");
  }
};


