const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs"); // password hashing library
const jwt = require("jsonwebtoken"); // JWT library for token generation
const User = require("../models/User");

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public

exports.registerUser = async (req, res) => {
  // validate the request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { username, email, password } = req.body;
  try {
    // Check if user already exists
    let userByEmail = await User.findOne({ email });
    if (userByEmail) {
      return res
        .status(400)
        .json({ errors: [{ msg: "User with this email already exists" }] });
    }
    let userByUsername = await User.findOne({ username });
    if (userByUsername) {
      return res
        .status(400)
        .json({ errors: [{ msg: "User with this username already exists" }] });
    }
    // Create a new user
    const user = new User({
      username,
      email,
      password,
    });

    await user.save();
    // Generate a JWT token
    const payload = {
      user: {
        id: user.id, // Mongoose `id` is the `_id` field
        role: user.role, //Include role in token for auth checks
      },
    };
    jwt.sign(
      payload,
      process.env.JWT_SECRET, // Use the secret from environment variables
      { expiresIn: "1h" }, // Token expires in 1 hour
      (err, token) => {
        if (err) throw err;
        res.status(201).json({
          success: true,
          msg: "User registered successfully",
          token: token,
          user: {
            // ADD THIS USER OBJECT
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            profilePicture: user.profilePicture,
            bio: user.bio,
          },
        });
      }
    );
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ msg: "Server error" });
  }
};

// @desc    Authenticate user & get token (login)
// @route   POST /api/auth/login
// @access  Public

exports.loginUser = async (req, res) => {
  // validate the request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password } = req.body;
  try {
    // Check if user exists - INCLUDE password for comparison
    let user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ errors: [{ msg: "Invalid credentials" }] });
    }
    // Use the model's built-in password matching method
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ errors: [{ msg: "Invalid credentials" }] });
    }
    // Generate a JWT token
    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
      (err, token) => {
        if (err) throw err;
        res.status(200).json({
          success: true,
          msg: "User logged in successfully",
          token: token,
          user: {
            // ADD THIS USER OBJECT
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            profilePicture: user.profilePicture,
            bio: user.bio,
            // DO NOT include password here!
          },
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server error" });
  }
};
