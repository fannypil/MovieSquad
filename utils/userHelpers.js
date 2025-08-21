const User = require("../models/User");

exports.findUserById = async (userId, excludePassword = true) => {
  try {
    const user = await User.findById(userId)
      .select(excludePassword ? "-password" : "");
    
    if (!user) {
      return { found: false, code: 404, message: "User not found" };
    }
    
    return { found: true, user };
  } catch (err) {
    if (err.kind === "ObjectId") {
      return { found: false, code: 400, message: "Invalid user ID format" };
    }
    throw err; // Let the caller handle other errors
  }
};

exports.handleServerError = (res, err, message = "Server Error") => {
  console.error(err.message);
  
  if (err.kind === "ObjectId") {
    return res.status(400).json({ 
      success: false,
      message: "Invalid ID format" 
    });
  }
  
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ 
      success: false,
      message: `User with this ${field} already exists` 
    });
  }
  
  res.status(500).json({ 
    success: false,
    message 
  });
};

// -- Collection Item Management -- //

exports.addItemToUserCollection = async (userId, collection, item, uniqueCheck) => {
  const user = await User.findById(userId);
  if (!user) {
    return { success: false, code: 404, message: "User not found" };
  }
  
  // Initialize the collection if it doesn't exist
  if (!user[collection]) user[collection] = [];
  
  // Check if item already exists in collection
  const exists = user[collection].some(uniqueCheck);
  if (exists) {
    return { 
      success: false, 
      code: 400, 
      message: `Item already exists in ${collection}` 
    };
  }
  
  // Add the item to the beginning of the collection
  user[collection].unshift(item);
  await user.save();
  
  return { success: true, data: user[collection] };
};

exports.removeItemFromUserCollection = async (userId, collection, filterFn) => {
  const user = await User.findById(userId);
  if (!user) {
    return { success: false, code: 404, message: "User not found" };
  }
  
  const initialLength = user[collection].length;
  user[collection] = user[collection].filter(filterFn);
  
  if (user[collection].length === initialLength) {
    return { 
      success: false, 
      code: 404, 
      message: `Item not found in ${collection}` 
    };
  }
  
  await user.save();
  return { success: true, data: user[collection] };
};

// - Friend Request Validation -
exports.validateFriendRequest = (senderId, recipientId) => {
  if (!recipientId) {
    return { valid: false, code: 400, message: "Recipient ID is required" };
  }
  
  if (recipientId === senderId) {
    return { 
      valid: false, 
      code: 400, 
      message: "You cannot send a friend request to yourself" 
    };
  }
  
  return { valid: true };
};