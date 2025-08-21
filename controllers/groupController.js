const Group = require("../models/Group");
const User = require("../models/User");
const { createNotification } = require("../utils/notificationService");
const Notification = require("../models/Notification");
const {
  handleServerError,checkGroupAccess, addUserToGroup,removeUserFromGroup,
  createGroupNotification,validateTMDBContent,checkUserGroupStatus
} = require("../utils/groupHelpers");
const watchlistController = require('./group/watchlistController');
const membershipController = require('./group/membershipController');

// Basic Group CRUD Operations

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
      return res.status(403).json({
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

exports.deleteGroup = async (req, res) => {
  const groupId = req.params.id;
  try {
    let group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ msg: "Group not found" });
    }
    // Check if the user is the admin of the group
    if (group.admin.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
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


module.exports = { ...exports, ...watchlistController, ...membershipController };

