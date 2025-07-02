const Post= require('../models/Post');
const User= require('../models/User');
const Group= require('../models/Group');

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private (authenticated users)
exports.createPost = async (req, res) => {
    console.log('Request body:', req.body); // Debug line
    console.log('User from req:', req.user); // Debug line
    
    const { content, groupId, tmdbId, tmdbType, tmdbTitle, tmdbPosterPath, categories } = req.body;

   // --- Validation for REQUIRED fields from YOUR Post Schema ---
    if (!content) {
        return res.status(400).json({ msg: 'Post content is required' });
    }
    if (!tmdbId || !tmdbType || !tmdbTitle) {
        return res.status(400).json({ msg: 'Post must be associated with a movie or TV show (tmdbId, tmdbType, tmdbTitle are required)' });
    }
    if (!['movie', 'tv'].includes(tmdbType)) {
        return res.status(400).json({ msg: 'tmdbType must be either "movie" or "tv"' });
    }
    try{
        // If a groupId is provided, check if the group exists and if the user is a member/admin of it
        // This is a common requirement for posting within a group.
        let group= null
        if (groupId) {
            group = await Group.findById(groupId);
            if (!group) {
                return res.status(404).json({ message: 'Group not found' });
            }
            // Optional: You might want to add a check here that only group members can post to a group.
            // For now, we'll allow any authenticated user to post to an existing group.
            // If group.isPrivate is true, you might want to enforce membership check:
            // if (group.isPrivate && !group.members.includes(req.user.id)) {
            //     return res.status(403).json({ msg: 'Forbidden: You are not a member of this private group' });
            // }
        }
        const newPost =new Post({
            author: req.user.id, // Assign the authenticated user as the author
            group: groupId || undefined, // Set group if provided, otherwise leave undefined
            content: content,
            tmdbId: tmdbId,
            tmdbType: tmdbType,
            tmdbTitle: tmdbTitle,
            tmdbPosterPath: tmdbPosterPath || null, // Use provided, or default to null
            categories: categories && Array.isArray(categories) && categories.length > 0
                        ? categories
                        : ['general'] // Use provided categories or default to ['general']
            // Likes and comments start empty by default
        });
        await newPost.save();
           // Optional: Update User and Group models to reference this post if you track posts there
        // This part depends on if your User/Group models have a 'posts' array.
        // For example, if User model has 'posts' array:
        // const user = await User.findById(req.user.id);
        // if (user) {
        //     user.posts.push(post._id);
        //     await user.save();
        // }
        // If Group model has 'posts' array:
        // if (group) {
        //     group.posts.push(post._id);
        //     await group.save();
        // }
        res.status(201).json(newPost);
    }catch(err){
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
}
// @desc    Get all posts (optionally by group or user)
// @route   GET /api/posts
// @access  Public
exports.getPosts = async (req, res) => {
    const { authorId, groupId, search } = req.query;
    try{
        let query = {};
        if (authorId) {
            query.author = authorId;
        }
        if (groupId) {
            query.group = groupId;
        }
         if (search) {
            // Use Mongoose's text search for content and tmdbTitle
            query.$text = { $search: search };
        }
        const posts = await Post.find(query).populate('author', 'username email')
            .populate('group', 'name')// Populate group details
            .sort({ createdAt: -1 }); // Sort by newest first
        res.json(posts);
    }catch(err){
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
}

// @desc    Get post by ID
// @route   GET /api/posts/:id
// @access  Public
exports.getPostById = async (req, res) => {
    try{
        const post = await Post.findById(req.params.id)
            .populate('author', 'username email')
            .populate('group', 'name'); 
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }
        res.json(post);
    } catch(err){
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid post ID format' });
        }
        res.status(500).json({ message: 'Server error' });
    }
}
// @desc    Update a post
// @route   PUT /api/posts/:id
// @access  Private (Post author or Global Admin)
exports.updatePost = async (req, res) => {
    const { content, tmdbId, tmdbType, tmdbTitle, tmdbPosterPath, categories, groupId } = req.body;
    const postId = req.params.id;
    try{
        let post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }
        // Check if the authenticated user is the post author or a global admin
        if(post.author.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: You are not authorized to update this post' });
        }
        // update post fields
        if (content) post.content = content;
        if (tmdbId) post.tmdbId = tmdbId;
        if (tmdbType) {
            if (!['movie', 'tv'].includes(tmdbType)) {
                return res.status(400).json({ msg: 'tmdbType must be either "movie" or "tv"' });
            }
            post.tmdbType = tmdbType;
        }
        if (tmdbTitle) post.tmdbTitle = tmdbTitle;
        if (tmdbPosterPath !== undefined) post.tmdbPosterPath = tmdbPosterPath; // Allow setting to null
        if (categories && Array.isArray(categories)) {
            // Optional: add validation for enum values for categories
            post.categories = categories;
        }
        if(groupId) {
            const group = await Group.findById(groupId);
            if (!group) {
                return res.status(404).json({ message: 'Target group not found' });
            }
            post.group = groupId;
        }else if(groupId === null) {
            post.group = undefined; 
        }
        await post.save();
        res.json(post);
    }catch(err){
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid post ID format' });
        }
        res.status(500).json({ message: 'Server error' });
    }
}

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private (Post author, Group Admin of post's group, or Global Admin)
exports.deletePost = async (req, res) => {
    const postId = req.params.id;
    try{
        let post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }
        // Check if the authenticated user is the post author, a group admin of the post's group, or a global admin
        let isAuthorized = false;
        if (post.author.toString() === req.user.id) {
            isAuthorized = true; // User is the post author
        }else if(req.user.role === 'admin') {
            isAuthorized = true; // Global admin
        }else if(post.group && req.user.role === 'groupAdmin') {
            const group = await Group.findById(post.group);
            if (group && group.admins.toString() === req.user.id) {
                isAuthorized = true; // User is a group admin of the post's group
            }
        }
        if (!isAuthorized) {
            return res.status(403).json({ message: 'Forbidden: You are not authorized to delete this post' });
        }
        // Delete the post
        await Post.deleteOne({ _id: postId });

        // Optional: Remove this post from any user's or group's 'posts' arrays if tracked
        // (Similar to how we handled group deletion)
        // const user = await User.findById(post.author);
        // if (user && user.posts) {
        //     user.posts.pull(postId); // Assuming 'posts' is an array of ObjectIds in User schema
        //     await user.save();
        // }
        // if (post.group) {
        //     const group = await Group.findById(post.group);
        //     if (group && group.posts) {
        //         group.posts.pull(postId); // Assuming 'posts' is an array of ObjectIds in Group schema
        //         await group.save();
        //     }
        // }
        res.json({ msg: 'Post removed successfully' });
    }catch(err){
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid post ID format' });
        }
        res.status(500).json({ message: 'Server error' });
    }
}