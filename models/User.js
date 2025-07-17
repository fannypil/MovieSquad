const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required."],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters long."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        "Please add a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [6, "Password must be at least 6 characters long."],
    },
    role: {
      type: String,
      enum: ["user", "groupAdmin", "admin"],
      default: "user",
    },
    profilePicture: {
      type: String,
      default: "https://www.w3schools.com/howto/img_avatar.png",
      validate: {
        validator: function (value) {
          // Skip validation for null/empty values and the default avatar
          if (
            !value ||
            value === "https://www.w3schools.com/howto/img_avatar.png"
          ) {
            return true;
          }
          // Import here to avoid circular dependency
          const { isValidAvatar } = require("../config/avatars");
          return isValidAvatar(value);
        },
        message: "Invalid profile picture URL",
      },
    },
    bio: {
      // Optional: short user description
      type: String,
      maxlength: [500, "Bio cannot be more than 200 characters."],
      trim: true,
    },
    // Optional: Add fields for tracking content, groups, etc.
    watchedContent: [
      {
        tmdbId: { type: Number, required: true },
        tmdbType: { type: String, enum: ["movie", "tv"], required: true },
        title: { type: String, required: true },
        watchedDate: { type: Date, default: Date.now },
        posterPath: { type: String },
      },
    ],
    favoriteMovies: [
      {
        tmdbId: { type: Number, required: true },
        title: { type: String, required: true },
        tmdbType: { type: String, enum: ["movie", "tv"], required: true },
        posterPath: { type: String },
      },
    ],
    favoriteGenres: [
      // Add this field
      {
        type: String,
        trim: true,
      },
    ],
    // Add an array of ObjectIds referencing Group models, if a user can be part of many groups
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group", // This will reference the 'Group' model
      },
    ],
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // This will reference the 'User' model
      },
    ],
    friendRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    profileSettings: {
      isPublic: {
        type: Boolean,
        default: true,
      },
      showWatchedContent: {
        type: Boolean,
        default: true,
      },
      showFavorites: {
        type: Boolean,
        default: true,
      },
    },
    resetPasswordToken: String, // For password reset functionality
    resetPasswordExpire: Date,
  },
  {
    timestamps: true, // Adds `createdAt` and `updatedAt` fields automatically
  }
);

//Encrypt password using bcrypt before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Sign JWT and return token
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// export the User model
module.exports = mongoose.model("User", userSchema);
