const Post = require("../models/Post");
const User = require("../models/User");
const Group = require("../models/Group");
const { createNotification } = require("../utils/notificationService");
const {handleServerError,validateTMDBContent,verifyGroup,checkPostAccess,
  checkCommentAccess,getPostById} = require("../utils/postHelpers")


// Create a new post
exports.createPost = async (req, res) => {
  const { content, groupId, tmdbId, tmdbType, tmdbTitle, tmdbPosterPath, categories } = req.body;

  try {
    // Validate required content
    if (!content) {
      return res.status(400).json({ message: "Post content is required" });
    }
    
    // Validate TMDB content
    const { valid, code, message } = validateTMDBContent(tmdbId, tmdbType, tmdbTitle);
    if (!valid) {
      return res.status(code).json({ message });
    }
    
    // Verify group if provided
    if (groupId) {
      const { valid, code, message } = await verifyGroup(groupId);
      if (!valid) {
        return res.status(code).json({ message });
      }
    }
    
    const newPost = new Post({
      author: req.user.id,
      group: groupId || undefined,
      content,
      tmdbId,
      tmdbType,
      tmdbTitle,
      tmdbPosterPath: tmdbPosterPath || null,
      categories: categories && Array.isArray(categories) && categories.length > 0 
        ? categories 
        : ["general"],
    });
    
    await newPost.save();
    res.status(201).json(newPost);
  } catch (err) {
    handleServerError(res, err, "Server error creating post");
  }
};
// Get all posts (optionally by group or user)
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
      query.$text = { $search: search };
    }
    
    const posts = await Post.find(query)
      .populate("author", "username email")
      .populate("group", "name")
      .sort({ createdAt: -1 });
      
    res.json(posts);
  } catch (err) {
    handleServerError(res, err, "Server error fetching posts");
  }
};

// Get post by ID
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
    // Use helper to get post by ID
    const { found, post, code, message } = await getPostById(postId);
    if (!found) {
      return res.status(code).json({ message });
    }
    
    // Use helper to check authorization
    const { authorized, code: authCode, message: authMessage } = 
      await checkPostAccess(post, req.user.id, req.user.role);
    if (!authorized) {
      return res.status(authCode).json({ message: authMessage });
    }

    // Update post fields
    if (content) post.content = content;
    
    // Check TMDB content validity if updating any TMDB fields
    if (tmdbId || tmdbType || tmdbTitle) {
      const { valid, code, message } = validateTMDBContent(
        tmdbId || post.tmdbId,
        tmdbType || post.tmdbType,
        tmdbTitle || post.tmdbTitle
      );
      
      if (!valid) {
        return res.status(code).json({ message });
      }
      
      // Update TMDB fields only if validation passes
      if (tmdbId) post.tmdbId = tmdbId;
      if (tmdbType) post.tmdbType = tmdbType;
      if (tmdbTitle) post.tmdbTitle = tmdbTitle;
    }
    
    // Update other fields
    if (tmdbPosterPath !== undefined) post.tmdbPosterPath = tmdbPosterPath;
    
    if (categories && Array.isArray(categories)) {
      post.categories = categories;
    }
    
    // Handle group changes
    if (groupId !== undefined) {
      if (groupId) {
        // If groupId provided, verify it exists
        const { valid, code, message } = await verifyGroup(groupId);
        if (!valid) {
          return res.status(code).json({ message });
        }
        post.group = groupId;
      } else {
        // If groupId is null, remove group association
        post.group = undefined;
      }
    }

    await post.save();
    await post.populate("author", "username email _id");

    res.json(post);
  } catch (err) {
    handleServerError(res, err, "Server error updating post");
  }
};

// Delete a post
exports.deletePost = async (req, res) => {
  const postId = req.params.id;
  
  try {
    // Use helper to get post by ID
    const { found, post, code, message } = await getPostById(postId);
    if (!found) {
      return res.status(code).json({ message });
    }
    
    // Use helper to check authorization
    const { authorized, code: authCode, message: authMessage } = 
      await checkPostAccess(post, req.user.id, req.user.role);
    if (!authorized) {
      return res.status(authCode).json({ message: authMessage });
    }
    
    // Delete the post
    await Post.deleteOne({ _id: postId });
    res.json({ message: "Post removed successfully" });
  } catch (err) {
    handleServerError(res, err, "Server error deleting post");
  }
};

// -- FUNCTIONS FOR LIKES AND COMMENTS --
// Like or Unlike a post ,  PUT /api/posts/:id/like
exports.likePost = async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  try {
    // Use helper to get post by ID
    const { found, post, code, message } = await getPostById(postId);
    if (!found) {
      return res.status(code).json({ message });
    }
    
    // Check if already liked
    const hasLiked = post.likes.includes(userId);

    if (hasLiked) {
      post.likes.pull(userId);
      await post.save();
      return res.json({
        message: "Post unliked successfully",
        likes: post.likes.length,
      });
    } else {
      post.likes.push(userId);
      await post.save();
      
      // Notify post author
      if (post.author.toString() !== userId) {
        await createNotification(post.author, "like", {
          senderId: userId,
          entityId: postId,
          entityType: "Post",
        });
      }
      
      return res.json({
        message: "Post liked successfully",
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
  const { text } = req.body;

  if (!text || text.trim() === "") {
    return res.status(400).json({ message: "Comment text is required." });
  }

  try {
    // Use helper to get post by ID
    const { found, post, code, message } = await getPostById(postId);
    if (!found) {
      return res.status(code).json({ message });
    }
    
    const newComment = {
      user: req.user.id,
      text: text.trim(),
      createdAt: Date.now(),
    };
    
    post.comments.unshift(newComment);
    await post.save();
    
    // Notify post author
    if (post.author.toString() !== req.user.id) {
      await createNotification(post.author, "comment", {
        senderId: req.user.id,
        entityId: postId,
        entityType: "Post",
      });
    }

    // Populate comment author
    const populatedPost = await Post.findById(postId).populate(
      "comments.user",
      "username email"
    );
    const latestComment = populatedPost.comments[0];

    res.status(201).json(latestComment);
  } catch (err) {
    handleServerError(res, err, "Server error adding comment");
  }
};

// Delete a comment from a post, DELETE /api/posts/:postId/comments/:commentId
exports.deleteComment = async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user.id;

  try {
    // Use helper to get post by ID
    const { found, post, code, message } = await getPostById(postId);
    if (!found) {
      return res.status(code).json({ message });
    }

    // Find the comment
    const comment = post.comments.find(
      (comm) => comm._id.toString() === commentId
    );

    if (!comment) {
      return res.status(404).json({ message: "Comment not found." });
    }
    
    // Check authorization using helper
    const { authorized, code: authCode, message: authMessage } = 
      await checkCommentAccess(post, comment, userId, req.user.role);
    if (!authorized) {
      return res.status(authCode).json({ message: authMessage });
    }
    
    // Remove the comment
    post.comments = post.comments.filter(
      ({ _id }) => _id.toString() !== commentId
    );
    
    await post.save();
    res.json({ message: "Comment removed successfully", comments: post.comments });
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
