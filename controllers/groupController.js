
const Group= require('../models/Group');
const User = require('../models/User');

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
        console.error(err.message);
        // Check for duplicate key error
        if(err.code === 11000) {
            return res.status(400).json({ message: 'A group with this name already exists.' });
        }
        res.status(500).send('Server Error');
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
        console.error(err.message);
        res.status(500).send('Server Error');
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
        console.error(err.message);
        // If the ID format is invalid (e.g., not a valid ObjectId)
        if(err.kind== 'ObjectId') {
            return res.status(400).json({ message: 'Invalid group ID format' });
        }
        res.status(500).send('Server Error');
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
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid group ID format' });
        }
        if(err.code === 11000) {
            return res.status(400).json({ message: 'A group with this name already exists.' });
        }
        res.status(500).send('Server Error');
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
        console.error(err.message);
        if(err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid group ID format' });
        }
        res.status(500).send('Server Error');
    }
}