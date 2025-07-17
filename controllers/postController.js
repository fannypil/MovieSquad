const Post = require("../models/Post");
const User = require("../models/User");
const Group = require("../models/Group");
const { createNotification } = require("../utils/notificationService");

// Helper function for consistent error handling
const handleServerError = (res, err, message = "Server error") => {
  console.error(err.message);
  if (err.kind === "ObjectId") {
    return res.status(400).json({ message: "Invalid ID format" });
  }
  if (err.response && err.response.data) {
    // For errors from external APIs like TMDB (though not directly used here)
    return res.status(err.response.status).json(err.response.data);
  }
  res.status(500).json({ message: message });
};

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private (authenticated users)
exports.createPost = async (req, res) => {
  const {
    content,
    groupId,
    tmdbId,
    tmdbType,
    tmdbTitle,
    tmdbPosterPath,
    categories,
  } = req.body;

  // --- Validation for REQUIRED fields from YOUR Post Schema ---
  if (!content) {
    return res.status(400).json({ msg: "Post content is required" });
  }
  if (!tmdbId || !tmdbType || !tmdbTitle) {
    return res
      .status(400)
      .json({
        msg: "Post must be associated with a movie or TV show (tmdbId, tmdbType, tmdbTitle are required)",
      });
  }
  if (!["movie", "tv"].includes(tmdbType)) {
    return res
      .status(400)
      .json({ msg: 'tmdbType must be either "movie" or "tv"' });
  }
  try {
    // If a groupId is provided, check if the group exists and if the user is a member/admin of it
    // This is a common requirement for posting within a group.
    let group = null;
    if (groupId) {
      group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
    }
    const newPost = new Post({
      author: req.user.id, // Assign the authenticated user as the author
      group: groupId || undefined, // Set group if provided, otherwise leave undefined
      content: content,
      tmdbId: tmdbId,
      tmdbType: tmdbType,
      tmdbTitle: tmdbTitle,
      tmdbPosterPath: tmdbPosterPath || null, // Use provided, or default to null
      categories:
        categories && Array.isArray(categories) && categories.length > 0
          ? categories
          : ["general"], // Use provided categories or default to ['general']
      // Likes and comments start empty by default
    });
    await newPost.save();

    res.status(201).json(newPost);
  } catch (err) {
    handleServerError(res, err, "Server error creating post");
  }
};
// @desc    Get all posts (optionally by group or user)
// @route   GET /api/posts
// @access  Public
exports.getPosts = async (req, res) => {
  const { authorId, groupId, search } = req.query;
  try {
    let query = {};
    if (authorId) {
      query.author = authorId;
    }
    if (groupId) {
      query.group = groupId;
    }
    if (search) {
      // Use Mongoose's text search for content and tmdbTitle
      query.$text = { $search: search };
    }
    const posts = await Post.find(query)
      .populate("author", "username email")
      .populate("group", "name") // Populate group details
      .sort({ createdAt: -1 }); // Sort by newest first
    res.json(posts);
  } catch (err) {
    handleServerError(res, err, "Server error fetching posts");
  }
};

// @desc    Get post by ID
// @route   GET /api/posts/:id
// @access  Public
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("author", "username email")
      .populate("group", "name")
      .populate("likes", "username email")
      .populate("comments.user", "username email");
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.json(post);
  } catch (err) {
    handleServerError(res, err, "Server error fetching post by ID");
  }
};
// @desc    Update a post
// @route   PUT /api/posts/:id
// @access  Private (Post author or Global Admin)
exports.updatePost = async (req, res) => {
  const {
    content,
    tmdbId,
    tmdbType,
    tmdbTitle,
    tmdbPosterPath,
    categories,
    groupId,
  } = req.body;
  const postId = req.params.id;
  try {
    let post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    // Check if the authenticated user is the post author or a global admin
    if (post.author.toString() !== req.user.id && req.user.role !== "admin") {
      return res
        .status(403)
        .json({
          message: "Forbidden: You are not authorized to update this post",
        });
    }
    // update post fields
    if (content) post.content = content;
    if (tmdbId) post.tmdbId = tmdbId;
    if (tmdbType) {
      if (!["movie", "tv"].includes(tmdbType)) {
        return res
          .status(400)
          .json({ msg: 'tmdbType must be either "movie" or "tv"' });
      }
      post.tmdbType = tmdbType;
    }
    if (tmdbTitle) post.tmdbTitle = tmdbTitle;
    if (tmdbPosterPath !== undefined) post.tmdbPosterPath = tmdbPosterPath; // Allow setting to null
    if (categories && Array.isArray(categories)) {
      // Optional: add validation for enum values for categories
      post.categories = categories;
    }
    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ message: "Target group not found" });
      }
      post.group = groupId;
    } else if (groupId === null) {
      post.group = undefined;
    }

    await post.save();

    await post.populate("author", "username email _id");

    res.json(post);
  } catch (err) {
    handleServerError(res, err, "Server error updating post");
  }
};

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private (Post author, Group Admin of post's group, or Global Admin)
exports.deletePost = async (req, res) => {
  const postId = req.params.id;
  try {
    let post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    // Check if the authenticated user is the post author, a group admin of the post's group, or a global admin
    let isAuthorized = false;
    if (post.author.toString() === req.user.id) {
      isAuthorized = true; // User is the post author
    } else if (req.user.role === "admin") {
      isAuthorized = true; // Global admin
    } else if (post.group && req.user.role === "groupAdmin") {
      const group = await Group.findById(post.group);
      if (group && group.admin.toString() === req.user.id) {
        isAuthorized = true; // User is a group admin of the post's group
      }
    }
    if (!isAuthorized) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You are not authorized to delete this post",
        });
    }
    // Delete the post
    await Post.deleteOne({ _id: postId });
    res.json({ msg: "Post removed successfully" });
  } catch (err) {
    handleServerError(res, err, "Server error deleting post");
  }
};

// -- FUNCTIONS FOR LIKES AND COMMENTS --
// Like or Unlike a post ,  PUT /api/posts/:id/like
exports.likePost = async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id; // User ID from auth middleware

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    // Check if the post has already been liked by this user
    const hasLiked = post.likes.includes(userId);

    if (hasLiked) {
      // If already liked, unlike it (pull user ID from likes array)
      post.likes.pull(userId);
      await post.save();
      return res.json({
        msg: "Post unliked successfully",
        likes: post.likes.length,
      });
    } else {
      // If not liked, like it (push user ID to likes array)
      post.likes.push(userId);
      await post.save();
      // CREATE NOTIFICATION: Notify post author if someone else liked their post
      if (post.author.toString() !== userId) {
        await createNotification(post.author, "like", {
          senderId: userId,
          entityId: postId,
          entityType: "Post",
        });
      }
      return res.json({
        msg: "Post liked successfully",
        likes: post.likes.length,
      });
    }
  } catch (err) {
    handleServerError(res, err, "Server error liking/unliking post");
  }
};

//Add a comment to a post ,  POST /api/posts/:id/comments
exports.addComment = async (req, res) => {
  const postId = req.params.id;
  const { text } = req.body; // Comment content

  if (!text || text.trim() === "") {
    return res.status(400).json({ message: "Comment text is required." });
  }

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }
    const newComment = {
      user: req.user.id, // The authenticated user is the comment author
      text: text.trim(),
      createdAt: Date.now(), // Set creation timestamp
    };
    post.comments.unshift(newComment); // Add new comment to the beginning of the array (most recent first)
    await post.save();
    // CREATE NOTIFICATION: Notify post author if someone else commented on their post
    if (post.author.toString() !== req.user.id) {
      await createNotification(post.author, "comment", {
        senderId: req.user.id,
        entityId: postId,
        entityType: "Post",
      });
    }

    // Populate the user field for the newly added comment before sending response
    const populatedPost = await Post.findById(postId).populate(
      "comments.user",
      "username email"
    ); // Only populate comments.user
    // Find the newly added comment in the populated post to return it
    const latestComment = populatedPost.comments[0];

    res.status(201).json(latestComment); // Return the newly added comment
  } catch (err) {
    handleServerError(res, err, "Server error adding comment");
  }
};

// Delete a comment from a post, DELETE /api/posts/:postId/comments/:commentId
exports.deleteComment = async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user.id; // Authenticated user attempting to delete

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    // Find the specific comment
    const comment = post.comments.find(
      (comm) => comm._id.toString() === commentId
    );

    if (!comment) {
      return res.status(404).json({ message: "Comment not found." });
    }
    // --- Authorization Check for deleting a comment ---
    let isAuthorized = false;
    // 1. Comment author
    if (comment.user.toString() === userId) {
      isAuthorized = true;
    }
    // 2. Post author
    else if (post.author.toString() === userId) {
      isAuthorized = true;
    }
    // 3. Global admin
    else if (req.user.role === "admin") {
      isAuthorized = true;
    }
    // 4. Group Admin of THIS post's group (if post has a group)
    else if (post.group && req.user.role === "groupAdmin") {
      const group = await Group.findById(post.group);
      // IMPORTANT: Your Group schema has 'admin', not 'admins'. Corrected below.
      if (group && group.admin.toString() === userId) {
        isAuthorized = true;
      }
    }
    if (!isAuthorized) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You are not authorized to delete this comment.",
        });
    }
    // Remove the comment
    post.comments = post.comments.filter(
      ({ _id }) => _id.toString() !== commentId
    );
    await post.save();
    res.json({ msg: "Comment removed successfully", comments: post.comments });
  } catch (err) {
    handleServerError(res, err, "Server error deleting comment");
  }
};

//  Advanced search for posts,GET /api/posts/search
exports.searchPosts = async (req, res) => {
  try {
    const {
      q, // General search query
      author, // Author username
      tmdbId, // Specific movie/TV ID
      tmdbType, // 'movie' or 'tv'
      category, // Post category
      dateFrom, // Date range start
      dateTo, // Date range end
      groupId, // Group filter
      sortBy = "createdAt", // Sort field
      order = "desc", // Sort order
      limit = 20, // Results limit
      page = 1, // Pagination
    } = req.query;

    let query = {};
    let sort = {};

    // Text search across content, tmdbTitle, categories
    if (q) {
      query.$text = { $search: q };
    }

    // Search by author username
    if (author) {
      const authorUser = await User.findOne({
        username: { $regex: author, $options: "i" },
      });
      if (authorUser) {
        query.author = authorUser._id;
      } else {
        return res.json({
          posts: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0,
          },
        });
      }
    }

    // Filter by specific movie/TV show
    if (tmdbId) {
      query.tmdbId = parseInt(tmdbId);
    }

    // Filter by movie or TV
    if (tmdbType) {
      if (["movie", "tv"].includes(tmdbType)) {
        query.tmdbType = tmdbType;
      } else {
        return res.json({
          posts: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0,
          },
        });
      }
    }

    // Filter by category
    if (category) {
      query.categories = { $in: [category] };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo);
      }
    }

    // Group filter
    if (groupId) {
      query.group = groupId;
    }

    // Sorting
    sort[sortBy] = order === "desc" ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute search
    const posts = await Post.find(query)
      .populate("author", "username email profilePicture")
      .populate("group", "name")
      .populate("likes", "username")
      .populate("comments.user", "username")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Post.countDocuments(query);

    res.json({
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    handleServerError(res, err, "Error searching posts");
  }
};
