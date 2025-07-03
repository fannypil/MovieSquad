
const Group= require('../models/Group');
const User = require('../models/User');

// Helper function for consistent error handling
const handleServerError = (res, err, message = 'Server error') => {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid ID format' });
    }
    if (err.code === 11000) {
        return res.status(400).json({ message: 'Duplicate key error: A resource with this unique field already exists.' });
    }
    res.status(500).json({ message: message });
};

// @desc    Create a new group
// @route   POST /api/groups
// @access  Private (only authenticated users can create groups)
exports.createGroup = async (req, res) => {
    const { name, description , isPrivate } = req.body;

    // Validate input
    if (!name || !description) {
        return res.status(400).json({ message: 'Please enter all fields (name and description)' });
    }
    try{
        //Check if a group with the same name already exists
        let group = await Group.findOne({ name });
        if (group) {
            return res.status(400).json({ msg: 'Group with this name already exists' });
        }
        // Create a new group
        group = new Group({
            name,
            description,
            isPrivate: typeof isPrivate === 'boolean' ? isPrivate : false,
            admin: req.user.id, // The authenticated user becomes the admin
            members: [req.user.id] // The admin is also the first member
        });
        // Save the group to the database
        await group.save();
        // add the group to the user's groups list
        const user = await User.findById(req.user.id);
        // Ensure user exists
        if(user){
            if (!user.groups) {
                user.groups = [];
            }
            if (!user.groups.includes(group._id)) {
                user.groups.push(group._id);
                await user.save();
            }
        }
        res.status(201).json(group); // 201 Created

    }catch(err){
        handleServerError(res, err, 'Server Error creating group');
    }
}

// @desc    Get all groups
// @route   GET /api/groups
// @access  Public (anyone can view groups)
exports.getAllGroups = async (req, res) => {
    try{
        const groups = await Group.find().populate('admin', 'username email').populate('members', 'username email');
        res.json(groups);
    } catch(err) {
        handleServerError(res, err, 'Server Error fetching all groups');
    }
}

// @desc    Get group by ID
// @route   GET /api/groups/:id
// @access  Public (anyone can view a specific group)
exports.getGroupById = async (req, res) => {

    try{
        const group= await Group.findById(req.params.id)
            .populate('admin', 'username email')
            .populate('members', 'username email');
        if(!group) {
            return res.status(404).json({ message: 'Group not found' });
        }
        res.json(group);
    } catch(err) {
        handleServerError(res, err, 'Server Error fetching group by ID');
    }
}

// @desc    Update a group
// @route   PUT /api/groups/:id
// @access  Private (only group admin or global admin)
exports.updateGroup = async (req, res) => {
    const { name, description, isPrivate } = req.body;
    const groupId = req.params.id;
    try{
        let group= await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ msg: 'Group not found' });
        }
        // Check if the user is the admin of the group
        if (group.admin.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Forbidden: You are not authorized to update this group' });
        }
        if(name && name !== group.name){
            const existingGroup = await Group.findOne({ name });
            if (existingGroup && existingGroup._id.toString() !== groupId) {
                return res.status(400).json({ msg: 'Another group with this name already exists' });
            }
        }
        // Update group details
        if(name) group.name = name;
        if(description) group.description = description;
        if(typeof isPrivate === 'boolean') group.isPrivate = isPrivate;
        await group.save();
        res.json(group);
    }catch(err){
        handleServerError(res, err, 'Server Error updating group');
    }
}

// @desc    Delete a group
// @route   DELETE /api/groups/:id
// @access  Private (only group admin or global admin)
exports.deleteGroup = async (req, res) => {
    const groupId = req.params.id;
    try{
        let group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ msg: 'Group not found' });
        }
        // Check if the user is the admin of the group
        if (group.admin.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Forbidden: You are not authorized to delete this group' });
        }
        // Remove the group from the user's groups list
        await Group.deleteOne({ _id: groupId });
        //remove this group from all users
        await User.updateMany(
            { groups: groupId },
            { $pull: { groups: groupId } }
        );
        res.json({ msg: 'Group deleted successfully' });
    }catch(err){
        handleServerError(res, err, 'Server Error deleting group');
    }
}

// Add a movie/TV show to a group's shared watchlist,  POST /api/groups/:id/watchlist
exports.addToSharedWatchlist = async (req, res) => {
    const groupId = req.params.id;
    const userId = req.user.id;
    const { tmdbId, tmdbType, tmdbTitle, tmdbPosterPath } = req.body;

    // Validate input
    if (!tmdbId || !tmdbType || !tmdbTitle) {
        return res.status(400).json({ message: 'TMDB ID, type, and title are required.' });
    }
    if (!['movie', 'tv'].includes(tmdbType)) {
        return res.status(400).json({ message: 'Invalid TMDB type. Must be "movie" or "tv".' });
    }

    try {
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found.' });
        }

        // Authorization: Only group members or admins can add to watchlist
        if (!group.members.includes(userId) && group.admin.toString() !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: You must be a member or admin of this group to add to its watchlist.' });
        }

        // Check for duplicates in the shared watchlist
        const alreadyExists = group.sharedWatchlist.some(
            (item) => item.tmdbId === tmdbId && item.tmdbType === tmdbType
        );

        if (alreadyExists) {
            return res.status(400).json({ message: 'Content already exists in this group\'s shared watchlist.' });
        }

        const newItem = {
            tmdbId,
            tmdbType,
            tmdbTitle,
            tmdbPosterPath: tmdbPosterPath || null,
            addedBy: userId,
            addedAt: Date.now()
        };

        group.sharedWatchlist.unshift(newItem); // Add to the beginning (most recent first)
        await group.save();

        // Populate the addedBy field for the newly added item before sending response
        const updatedGroup = await Group.findById(groupId)
            .populate('sharedWatchlist.addedBy', 'username email');
        
        // Find the specific item we just added to return it
        const addedItem = updatedGroup.sharedWatchlist.find(item => item.tmdbId === tmdbId && item.tmdbType === tmdbType);

        res.status(201).json(addedItem);
    } catch (err) {
        handleServerError(res, err, 'Server Error adding to shared watchlist');
    }
};

//  Remove a movie/TV show from a group's shared watchlist,  DELETE /api/groups/:id/watchlist/:tmdbId/:tmdbType
exports.removeFromSharedWatchlist = async (req, res) => {
    const groupId = req.params.id;
    const userId = req.user.id;
    const { tmdbId, tmdbType } = req.params; // Get TMDB details from URL params

    if (!tmdbId || !tmdbType) {
        return res.status(400).json({ message: 'TMDB ID and type are required in params.' });
    }
    if (!['movie', 'tv'].includes(tmdbType)) {
        return res.status(400).json({ message: 'Invalid TMDB type. Must be "movie" or "tv".' });
    }

    try {
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found.' });
        }

        // Authorization: Group members or admins can remove, or global admin
        if (!group.members.includes(userId) && group.admin.toString() !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: You must be a member or admin of this group to remove from its watchlist.' });
        }
        
        // Check if the item exists in the watchlist
        const initialLength = group.sharedWatchlist.length;
        group.sharedWatchlist = group.sharedWatchlist.filter(
            (item) => !(item.tmdbId == tmdbId && item.tmdbType === tmdbType)
        );

        if (group.sharedWatchlist.length === initialLength) {
            return res.status(404).json({ message: 'Content not found in this group\'s shared watchlist.' });
        }

        await group.save();
        res.json({ msg: 'Content removed from shared watchlist successfully', sharedWatchlist: group.sharedWatchlist });
    } catch (err) {
        handleServerError(res, err, 'Server Error removing from shared watchlist');
    }
};

//  Get a group's shared watchlist,  GET /api/groups/:id/watchlist
exports.getSharedWatchlist = async (req, res) => {
    const groupId = req.params.id;
    const userId = req.user ? req.user.id : null; // User might not be authenticated for public groups

    try {
        const group = await Group.findById(groupId)
            .populate('sharedWatchlist.addedBy', 'username email'); // Populate who added the item

        if (!group) {
            return res.status(404).json({ message: 'Group not found.' });
        }

        // Authorization: If group is private, only members/admin (or global admin) can view
        if (group.isPrivate) {
            if (!userId || (!group.members.includes(userId) && group.admin.toString() !== userId && req.user.role !== 'admin')) {
                return res.status(403).json({ message: 'Forbidden: You must be a member or admin of this private group to view its watchlist.' });
            }
        }
        // For public groups, anyone can view, so no further check needed.

        res.json(group.sharedWatchlist);
    } catch (err) {
        handleServerError(res, err, 'Server Error fetching shared watchlist');
    }
};