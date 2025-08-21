const User = require("../models/User");
const bcrypt = require("bcryptjs");

// Helper function for handling common database errors
const handleServerError = (res, err) => {
  console.error(err.message);
  res.status(500).send("Server Error");
};

// Get admin dashboard data
exports.getDashboard = (req, res) => {
  res.json({ msg: `Welcome to the Admin Dashboard, ${req.user.id}!` });
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password"); // Exclude passwords
    res.json(users);
  } catch (err) {
    handleServerError(res, err);
  }
};

// Get a user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      // Handle invalid ID format
      return res.status(400).json({ msg: "Invalid User ID format" });
    }
    res.status(500).send("Server Error");
  }
};

// Update a user by ID
exports.updateUser = async (req, res) => {
  const { username, email, role, bio, profilePicture, password } = req.body;

  const fieldsToUpdate = {};
  if (username) fieldsToUpdate.username = username;
  if (email) fieldsToUpdate.email = email;
  if (role) fieldsToUpdate.role = role;
  if (bio !== undefined) fieldsToUpdate.bio = bio;
  if (profilePicture !== undefined)
    fieldsToUpdate.profilePicture = profilePicture;

  // Handle password update if provided by admin (and hash it)
  if (password) {
    const salt = await bcrypt.genSalt(10);
    fieldsToUpdate.password = await bcrypt.hash(password, salt);
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: fieldsToUpdate },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res
        .status(400)
        .json({ msg: `A user with this ${field} already exists.` });
    }
    if (err.kind === "ObjectId") {
      return res.status(400).json({ msg: "Invalid User ID format" });
    }
    res.status(500).send("Server Error");
  }
};

// Delete a user by ID
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    res.json({ msg: "User removed" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(400).json({ msg: "Invalid User ID format" });
    }
    res.status(500).send("Server Error");
  }
};
