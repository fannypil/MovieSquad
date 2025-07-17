const User = require("../models/User");
const Group = require("../models/Group");
const Post = require("../models/Post");
const mongoose = require("mongoose");

/**
 * Helper function to handle server errors
 */
const handleServerError = (res, error, message = "Server Error") => {
  console.error(message, error);
  res.status(500).json({
    success: false,
    message: message,
    error:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
  });
};

/**
 * Get posts per group per month for the last 12 months
 * Endpoint: GET /api/stats/posts-per-group-monthly
 * Access: Public or Admin only (adjust as needed)
 */
exports.getPostsPerGroupMonthly = async (req, res) => {
  try {
    // Get date range for last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const aggregationPipeline = [
      // Match posts from the last 12 months that belong to groups
      {
        $match: {
          group: { $ne: null }, // Only group posts
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      // Add month-year fields for grouping
      {
        $addFields: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          monthYear: {
            $dateToString: {
              format: "%Y-%m",
              date: "$createdAt",
            },
          },
        },
      },
      // Group by group and month-year
      {
        $group: {
          _id: {
            groupId: "$group",
            monthYear: "$monthYear",
            year: "$year",
            month: "$month",
          },
          postCount: { $sum: 1 },
          posts: { $push: "$_id" }, // Optional: include post IDs
        },
      },
      {
        $lookup: {
          from: "groups",
          localField: "_id.groupId",
          foreignField: "_id",
          as: "groupInfo",
        },
      },
      {
        $unwind: "$groupInfo",
      },
      // Project final structure
      {
        $project: {
          _id: 0,
          groupId: "$_id.groupId",
          groupName: "$groupInfo.name",
          year: "$_id.year",
          month: "$_id.month",
          monthYear: "$_id.monthYear",
          postCount: 1,
          totalPosts: { $size: "$posts" },
        },
      },
      // Sort by year, month, then by post count descending
      {
        $sort: {
          year: 1,
          month: 1,
          postCount: -1,
        },
      },
    ];

    const results = await Post.aggregate(aggregationPipeline);

    // Format data for D3.js visualization
    const formattedResults = results.map((item) => ({
      groupId: item.groupId,
      groupName: item.groupName,
      date: item.monthYear,
      year: item.year,
      month: item.month,
      value: item.postCount,
      label: `${item.groupName} (${item.postCount} posts)`,
    }));

    res.status(200).json({
      success: true,
      message: "Posts per group monthly data retrieved successfully",
      data: formattedResults,
      totalRecords: formattedResults.length,
      dateRange: {
        from: twelveMonthsAgo.toISOString(),
        to: new Date().toISOString(),
      },
    });
  } catch (error) {
    handleServerError(
      res,
      error,
      "Error retrieving posts per group monthly data"
    );
  }
};

/**
 * Get top N favorite genres by user count
 * Endpoint: GET /api/stats/top-genres?limit=10
 * Access: Public or Admin only (adjust as needed)
 */
exports.getTopGenresByUserCount = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10; // Default to top 10

    if (limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 50",
      });
    }

    const aggregationPipeline = [
      // Match users who have favorite genres
      {
        $match: {
          favoriteGenres: { $exists: true, $ne: [] },
        },
      },
      // Unwind the favoriteGenres array to create separate documents for each genre
      {
        $unwind: "$favoriteGenres",
      },
      // Group by genre and count users
      {
        $group: {
          _id: "$favoriteGenres",
          userCount: { $sum: 1 },
          users: { $push: { userId: "$_id", username: "$username" } },
        },
      },
      // Project final structure
      {
        $project: {
          _id: 0,
          genre: "$_id",
          userCount: 1,
          users: 1,
        },
      },
      // Sort by user count descending
      {
        $sort: { userCount: -1 },
      },
      // Limit to top N results
      {
        $limit: limit,
      },
    ];

    const results = await User.aggregate(aggregationPipeline);

    // Calculate total users for percentage calculation
    const totalUsersWithGenres = await User.countDocuments({
      favoriteGenres: { $exists: true, $ne: [] },
    });

    // Format data for D3.js visualization
    const formattedResults = results.map((item, index) => ({
      rank: index + 1,
      genre: item.genre,
      userCount: item.userCount,
      percentage:
        totalUsersWithGenres > 0
          ? Math.round((item.userCount / totalUsersWithGenres) * 100 * 100) /
            100
          : 0,
      label: `${item.genre} (${item.userCount} users)`,
      users: item.users, // Include user details if needed
    }));

    res.status(200).json({
      success: true,
      message: `Top ${limit} genres by user count retrieved successfully`,
      data: formattedResults,
      totalRecords: formattedResults.length,
      totalUsersWithGenres,
      requestedLimit: limit,
    });
  } catch (error) {
    handleServerError(res, error, "Error retrieving top genres data");
  }
};

/**
 * Get posts per user per month for the last 12 months
 * Endpoint: GET /api/stats/posts-per-user-monthly?limit=20
 * Access: Public or Admin only (adjust as needed)
 */
exports.getPostsPerUserMonthly = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20; // Default to top 20 users

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100",
      });
    }

    // Get date range for last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const aggregationPipeline = [
      // Match posts from the last 12 months
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      // Add month-year fields for grouping
      {
        $addFields: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          monthYear: {
            $dateToString: {
              format: "%Y-%m",
              date: "$createdAt",
            },
          },
        },
      },
      // Group by user and month-year
      {
        $group: {
          _id: {
            userId: "$author",
            monthYear: "$monthYear",
            year: "$year",
            month: "$month",
          },
          postCount: { $sum: 1 },
          posts: { $push: "$_id" },
        },
      },
      // Lookup user information
      {
        $lookup: {
          from: "users",
          localField: "_id.userId",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      // Unwind user info
      {
        $unwind: "$userInfo",
      },
      // Project final structure
      {
        $project: {
          _id: 0,
          userId: "$_id.userId",
          username: "$userInfo.username",
          year: "$_id.year",
          month: "$_id.month",
          monthYear: "$_id.monthYear",
          postCount: 1,
          totalPosts: { $size: "$posts" },
        },
      },
      // Sort by year, month, then by post count descending
      {
        $sort: {
          year: 1,
          month: 1,
          postCount: -1,
        },
      },
    ];

    const results = await Post.aggregate(aggregationPipeline);

    // Get total posts per user for additional insights
    const userTotalsPipeline = [
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: "$author",
          totalPosts: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $unwind: "$userInfo",
      },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          username: "$userInfo.username",
          totalPosts: 1,
        },
      },
      {
        $sort: { totalPosts: -1 },
      },
      {
        $limit: limit,
      },
    ];

    const userTotals = await Post.aggregate(userTotalsPipeline);

    // Format data for D3.js visualization
    const formattedResults = results.map((item) => ({
      userId: item.userId,
      username: item.username,
      date: item.monthYear,
      year: item.year,
      month: item.month,
      value: item.postCount,
      label: `${item.username} (${item.postCount} posts)`,
    }));

    const formattedUserTotals = userTotals.map((item, index) => ({
      rank: index + 1,
      userId: item.userId,
      username: item.username,
      totalPosts: item.totalPosts,
      label: `${item.username} (${item.totalPosts} total posts)`,
    }));

    res.status(200).json({
      success: true,
      message: "Posts per user monthly data retrieved successfully",
      data: {
        monthlyData: formattedResults,
        topUsers: formattedUserTotals,
      },
      totalRecords: formattedResults.length,
      topUsersCount: formattedUserTotals.length,
      dateRange: {
        from: twelveMonthsAgo.toISOString(),
        to: new Date().toISOString(),
      },
      requestedLimit: limit,
    });
  } catch (error) {
    handleServerError(
      res,
      error,
      "Error retrieving posts per user monthly data"
    );
  }
};

/**
 * Get comprehensive statistics summary
 * Endpoint: GET /api/stats/summary
 * Access: Admin only (adjust as needed)
 */
exports.getStatsSummary = async (req, res) => {
  try {
    // Get current date ranges
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Parallel execution of multiple aggregations
    const [
      totalUsers,
      totalGroups,
      totalPosts,
      recentPosts,
      activeUsers,
      topGenres,
    ] = await Promise.all([
      User.countDocuments(),
      Group.countDocuments(),
      Post.countDocuments(),
      Post.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Post.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: "$author" } },
        { $count: "activeUsers" },
      ]),
      User.aggregate([
        { $match: { favoriteGenres: { $exists: true, $ne: [] } } },
        { $unwind: "$favoriteGenres" },
        { $group: { _id: "$favoriteGenres", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const activeUserCount =
      activeUsers.length > 0 ? activeUsers[0].activeUsers : 0;

    res.status(200).json({
      success: true,
      message: "Statistics summary retrieved successfully",
      data: {
        overview: {
          totalUsers,
          totalGroups,
          totalPosts,
          recentPosts,
          activeUsers: activeUserCount,
        },
        topGenres: topGenres.map((genre) => ({
          genre: genre._id,
          userCount: genre.count,
        })),
        lastUpdated: now.toISOString(),
      },
    });
  } catch (error) {
    handleServerError(res, error, "Error retrieving statistics summary");
  }
};

// Add this new function to the existing statsController.js

/**
 * Get comprehensive group statistics
 * Endpoint: GET /api/stats/group/:groupId
 * Access: Group members only
 */
exports.getGroupStatistics = async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID",
      });
    }

    // Check if group exists
    const group = await Group.findById(groupId).populate("members", "username");
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    // Get date range for last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // Generate all months for the last 12 months
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push({
        month: date.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        monthKey: date.toISOString().substring(0, 7), // YYYY-MM format
        posts: 0,
      });
    }

    // Get monthly posts data
    const monthlyPostsData = await Post.aggregate([
      {
        $match: {
          group: new mongoose.Types.ObjectId(groupId),
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$createdAt",
            },
          },
          posts: { $sum: 1 },
        },
      },
    ]);

    // Merge actual data with empty months
    const monthlyPosts = months.map((month) => {
      const found = monthlyPostsData.find(
        (data) => data._id === month.monthKey
      );
      return {
        month: month.month,
        posts: found ? found.posts : 0,
      };
    });

    // Get top contributors
    const topContributors = await Post.aggregate([
      {
        $match: {
          group: new mongoose.Types.ObjectId(groupId),
        },
      },
      {
        $group: {
          _id: "$author",
          postCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $unwind: "$userInfo",
      },
      {
        $project: {
          userId: "$_id",
          username: "$userInfo.username",
          postCount: 1,
        },
      },
      {
        $sort: { postCount: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    // Get total posts count
    const totalPosts = await Post.countDocuments({ group: groupId });

    // Get watchlist items count (if you have a watchlist collection)
    // For now, we'll set it to 0 or calculate from your watchlist logic
    const watchlistItems = 0; // TODO: Replace with actual watchlist count

    // Calculate days active
    const daysActive = Math.ceil(
      (Date.now() - new Date(group.createdAt)) / (1000 * 60 * 60 * 24)
    );

    res.status(200).json({
      success: true,
      message: "Group statistics retrieved successfully",
      monthlyPosts,
      topContributors,
      totalPosts,
      watchlistItems,
      daysActive,
      memberCount: group.members.length,
      groupName: group.name,
      groupId: groupId,
    });
  } catch (error) {
    handleServerError(res, error, "Error retrieving group statistics");
  }
};

exports.getSummaryStats = async (req, res) => {
  try {
    const reviewCount = await Post.countDocuments({ categories: "review" });
    const activeGroupsCount = await Group.countDocuments({});
    const discussionsCount = await Post.countDocuments({
      categories: "discussion",
    });
    res.json({
      reviewCount,
      activeGroupsCount,
      discussionsCount,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};
