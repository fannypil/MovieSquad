const mongoose = require('mongoose'); 
const Post = require('../models/Post');
const User = require('../models/User');

// Helper function for consistent error handling
const handleServerError = (res, err, message = 'Server error') => {
    console.error(err.message);
    res.status(500).json({ message: message });
};

// @desc    Get my recent posts activity
// @route   GET /api/activity/me
// @access  Private
exports.getMyPostsActivity = async (req, res) => {
    try {
        const myPosts = await Post.find({ author: req.user.id })
            .populate('author', 'username profilePicture')
            .populate('group', 'name')
            .sort({ createdAt: -1 })
            .limit(20)
            .select('content tmdbTitle tmdbType tmdbPosterPath groupId createdAt likes comments');

        res.json(myPosts);
    } catch (err) {
        handleServerError(res, err, 'Error fetching your posts activity');
    }
};

// @desc    Get friends' posts feed (main activity feed)
// @route   GET /api/activity/feed
// @access  Private
exports.getFriendsPostsFeed = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('friends');
        
        // Get posts from friends + own posts
        const friendsAndSelf = [...user.friends, req.user.id];
        
        const posts = await Post.find({ 
            author: { $in: friendsAndSelf }
        })
        .populate('author', 'username profilePicture')
        .populate('group', 'name')
        .populate('comments.user', 'username profilePicture')
        .sort({ createdAt: -1 })
        .limit(50);

        res.json(posts);
    } catch (err) {
        handleServerError(res, err, 'Error fetching friends posts feed');
    }
};

// @desc    Get a specific user's posts activity
// @route   GET /api/activity/user/:userId
// @access  Private
exports.getUserPostsActivity = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Check if profile is public or if users are friends
        const user = await User.findById(userId);
        const currentUser = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check privacy settings
        const isOwnProfile = userId === req.user.id;
        const isFriend = currentUser.friends.includes(userId);
        const isPublic = user.profileSettings?.isPublic !== false;

        if (!isOwnProfile && !isPublic && !isFriend) {
            return res.status(403).json({ message: 'Profile is private' });
        }

        const userPosts = await Post.find({ author: userId })
            .populate('author', 'username profilePicture')
            .populate('group', 'name')
            .sort({ createdAt: -1 })
            .limit(20)
            .select('content tmdbTitle tmdbType tmdbPosterPath group createdAt likes comments'); // Fixed: changed 'groupId' to 'group'

        res.json(userPosts);
    } catch (err) {
        handleServerError(res, err, 'Error fetching user posts activity');
    }
};

// @desc    Get activity statistics for a user
// @route   GET /api/activity/stats
// @access  Private
exports.getActivityStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const stats = await Post.aggregate([
            { $match: { author: new mongoose.Types.ObjectId(userId) } }, 
            {
                $group: {
                    _id: null,
                    totalPosts: { $sum: 1 },
                    totalLikes: { $sum: { $size: '$likes' } },
                    totalComments: { $sum: { $size: '$comments' } },
                    avgLikesPerPost: { $avg: { $size: '$likes' } }
                }
            }
        ]);

        const result = stats[0] || {
            totalPosts: 0,
            totalLikes: 0,
            totalComments: 0,
            avgLikesPerPost: 0
        };

        res.json(result);
    } catch (err) {
        handleServerError(res, err, 'Error fetching activity statistics');
    }
};