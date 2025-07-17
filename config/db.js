const mongoose = require("mongoose");
const dotenv = require("dotenv");

// load environment variables
dotenv.config();

// connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

// export the connection function
module.exports = connectDB;
