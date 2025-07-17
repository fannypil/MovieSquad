const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: [3, "Group name must be at least 3 characters long"],
      maxlength: [100, "Group name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Group description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    isPrivate: {
      type: Boolean,
      default: false, // Public group by default, group admins can change to private
    },
    // Array of ObjectIds referencing User models who are members of this group
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // A group must have an admin
    },
    pendingMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    sharedWatchlist: [
      {
        tmdbId: {
          type: Number,
          required: true,
        },
        tmdbType: {
          // 'movie' or 'tv'
          type: String,
          required: true,
          enum: ["movie", "tv"],
        },
        tmdbTitle: {
          type: String,
          required: true,
          trim: true,
        },
        tmdbPosterPath: {
          type: String,
          default: null,
        },
        addedBy: {
          // User who added this item to the shared watchlist
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        addedAt: {
          // Timestamp of when it was added
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

// Export the Group model
module.exports = mongoose.model("Group", groupSchema);
