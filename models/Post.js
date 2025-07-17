const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    //Content of the post
    content: {
      type: String,
      required: [true, "Post content cannot be empty"],
      trim: true,
      minlength: [1, "Post must contain at least 1 character"],
      maxlength: [1000, "Post content cannot exceed 1000 characters"],
    },
    //Reference to the user who created the post
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    //Reference to the group this post belongs to (optional, for group-specific posts)
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      // optional: null if the post is not group-specific
      required: null,
    },
    tmdbId: {
      type: Number,
      required: [true, "Post must be associated with a movie or TV show"],
    },
    // 'movie' or 'tv
    tmdbType: {
      type: String,
      required: true,
      enum: ["movie", "tv"],
    },
    // The title of the movie/TV show
    tmdbTitle: {
      type: String,
      required: true,
      trim: true,
    },
    // Path to the poster image for display
    tmdbPosterPath: {
      type: String,
      default: null,
    },
    // Category or tags for search/filtering (e.g., "review", "recommendation", "discussion", "question")
    categories: [
      {
        type: String,
        enum: [
          "review",
          "recommendation",
          "discussion",
          "news",
          "question",
          "general",
        ],
        default: "general",
      },
    ],
    // Optional: for likes/reactions
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Optional: for comments on posts (can be a separate Comments model too)
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: {
          type: String,
          required: true,
          trim: true,
          maxlength: 500,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Create text index for content and tmdbTitle for search functionality
postSchema.index({ content: "text", tmdbTitle: "text", categories: "text" });
// Export the Post model
module.exports = mongoose.model("Post", postSchema);
