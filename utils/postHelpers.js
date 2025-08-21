// utils/postHelpers.js
const Post = require("../models/Post");
const Group = require("../models/Group");

exports.handleServerError = (res, err, message = "Server error") => {
  console.error(err.message);
  if (err.kind === "ObjectId") {
    return res.status(400).json({ message: "Invalid ID format" });
  }
  if (err.response && err.response.data) {
    return res.status(err.response.status).json(err.response.data);
  }
  res.status(500).json({ message: message });
};

exports.validateTMDBContent = (tmdbId, tmdbType, tmdbTitle) => {
  if (!tmdbId || !tmdbType || !tmdbTitle) {
    return { 
      valid: false, 
      code: 400,
      message: "Post must be associated with a movie or TV show (tmdbId, tmdbType, tmdbTitle are required)"
    };
  }
  
  if (!["movie", "tv"].includes(tmdbType)) {
    return { 
      valid: false, 
      code: 400,
      message: 'tmdbType must be either "movie" or "tv"'
    };
  }
  
  return { valid: true };
};

exports.verifyGroup = async (groupId) => {
  if (!groupId) return { valid: true };
  
  const group = await Group.findById(groupId);
  if (!group) {
    return { 
      valid: false, 
      code: 404,
      message: "Group not found" 
    };
  }
  
  return { valid: true, group };
};

exports.checkPostAccess = async (post, userId, userRole) => {
  // Case 1: User is post author
  if (post.author.toString() === userId) {
    return { authorized: true };
  }
  
  // Case 2: User is global admin
  if (userRole === "admin") {
    return { authorized: true };
  }
  
  // Case 3: User is group admin of post's group
  if (post.group && userRole === "groupAdmin") {
    const group = await Group.findById(post.group);
    if (group && group.admin.toString() === userId) {
      return { authorized: true };
    }
  }
  
  return { 
    authorized: false,
    code: 403,
    message: "Forbidden: You are not authorized to perform this action"
  };
};

exports.checkCommentAccess = async (post, comment, userId, userRole) => {
  // Case 1: Comment author
  if (comment.user.toString() === userId) {
    return { authorized: true };
  }
  
  // Case 2: Post author
  if (post.author.toString() === userId) {
    return { authorized: true };
  }
  
  // Case 3: Global admin
  if (userRole === "admin") {
    return { authorized: true };
  }
  
  // Case 4: Group Admin of post's group
  if (post.group && userRole === "groupAdmin") {
    const group = await Group.findById(post.group);
    if (group && group.admin.toString() === userId) {
      return { authorized: true };
    }
  }
  
  return { 
    authorized: false,
    code: 403,
    message: "Forbidden: You are not authorized to perform this action"
  };
};

// Helper function to get post by ID with error handling
exports.getPostById = async (postId) => {
  const post = await Post.findById(postId);
  if (!post) {
    return { found: false, code: 404, message: "Post not found" };
  }
  return { found: true, post };
};