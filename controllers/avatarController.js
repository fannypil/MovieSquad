const { getValidAvatars } = require("../config/avatars");

// GET /api/avatars
exports.getAvatars = async (req, res) => {
  try {
    const avatars = getValidAvatars();
    res.json({
      success: true,
      count: avatars.length,
      data: avatars,
    });
  } catch (error) {
    console.error("Error fetching avatars:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
