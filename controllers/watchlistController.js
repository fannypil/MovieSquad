const Group = require("../models/Group");
const User = require("../models/User");
const {handleServerError,checkGroupAccess,createGroupNotification, 
    validateTMDBContent} = require("../utils/groupHelpers");
const {addItemToUserCollection,removeItemFromUserCollectio}= require("../utils/userHelpers");

// Add a movie/TV show to a group's shared watchlist,  POST /api/groups/:id/watchlist
exports.addToSharedWatchlist = async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;
  const { tmdbId, tmdbType, tmdbTitle, tmdbPosterPath } = req.body;

  // Validate input using helper function
  const validation = validateTMDBContent(tmdbId, tmdbType, tmdbTitle);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  try {
    // Check group access and authorization
    const { success, code, message, group } = await checkGroupAccess(
      groupId,
      userId,
      "member"
    );
    if (!success) {
      return res.status(code).json({ message });
    }

    // Check for duplicates in the shared watchlist
    const alreadyExists = group.sharedWatchlist.some(
      (item) => item.tmdbId === tmdbId && item.tmdbType === tmdbType
    );

    if (alreadyExists) {
      return res.status(400).json({
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
    // Notify all group members except the one who added it
    const membersToNotify = group.members.filter(
      (memberId) => memberId.toString() !== userId
    );

    for (const memberId of membersToNotify) {
      await createGroupNotification(
        memberId,
        "group_watchlist_add",
        userId,
        groupId,
        `${req.user.username || "Someone"} added "${tmdbTitle}" to ${group.name}'s watchlist.`
      );
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
    // Check group access and authorization
    const { success, code, message, group } = await checkGroupAccess(
      groupId,
      userId,
      "member"
    );
    if (!success) {
      return res.status(code).json({ message });
    }

    // Check if the item exists in the watchlist
    const initialLength = group.sharedWatchlist.length;
    group.sharedWatchlist = group.sharedWatchlist.filter(
      (item) => !(item.tmdbId == tmdbId && item.tmdbType === tmdbType)
    );

    if (group.sharedWatchlist.length === initialLength) {
      return res.status(404).json({
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

    // If group is private, check authorization
    if (group.isPrivate) {
      if (!userId) {
        return res.status(401).json({
          message: "Authentication required to view private group watchlist.",
        });
      }

      const status = checkUserGroupStatus(group, userId);
      const isGlobalAdmin = req.user.role === "admin";

      if (!status.isMember && !status.isAdmin && !isGlobalAdmin) {
        return res.status(403).json({
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

// -- USER MANAGING WATCHED CONTENT --
// Add a watched content to the user's profile, /api/user/me/watched
exports.addWatchedContent = async (req, res) => {
  const { tmdbId, tmdbType, title, watchedDate, posterPath } = req.body;
  
  // Validate TMDB input
  const validation = validateTMDBContent(tmdbId, tmdbType, title);
  if (!validation.valid) {
    return res.status(validation.code).json({ message: validation.message });
  }
  
  try {
    // Add to user's watched content collection
    const result = await addItemToUserCollection(
      req.user.id,
      'watchedContent',
      {
        tmdbId: parseInt(tmdbId),
        tmdbType,
        title,
        watchedDate: watchedDate || Date.now(),
        posterPath: posterPath || null
      },
      (item) => item.tmdbId === parseInt(tmdbId) && item.tmdbType === tmdbType
    );
    
    if (!result.success) {
      return res.status(result.code).json({ message: result.message });
    }
    
    res.json(result.data);
  } catch (err) {
    handleServerError(res, err);
  }
};

//Remove a movie/TV show from user's watched list /api/user/me/watched/:tmdbId/:tmdbType
exports.removeWatchedContent = async (req, res) => {
  const { tmdbId, tmdbType } = req.params;
  try {
    const result = await removeItemFromUserCollection(
      req.user.id, 
      'watchedContent',
      (item) => !(item.tmdbId == tmdbId && item.tmdbType === tmdbType)
    );
    if (!result.success) {
      return res.status(result.code).json({ message: result.message });
    }
    res.json(result.data);
  } catch (err) {
    handleServerError(res, err, "Error removing watched content");
  }
};
