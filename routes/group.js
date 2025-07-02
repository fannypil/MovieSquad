
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware'); 
const authorizeRoles = require('../middleware/authorizeRoles'); 
const groupController = require('../controllers/groupController'); 

// @route   POST /api/groups
// @desc    Create a new group
// @access  Private (only authenticated users with 'user', 'groupAdmin', or 'admin' roles can create)
router.post('/', auth, authorizeRoles('user', 'groupAdmin', 'admin'), groupController.createGroup);

// @route   GET /api/groups
// @desc    Get all groups
// @access  Public (anyone can view all groups)
router.get('/', groupController.getAllGroups);

// @route   GET /api/groups/:id
// @desc    Get group by ID
// @access  Public (anyone can view a specific group by ID)
router.get('/:id', groupController.getGroupById);

// PUT /api/groups/:id , Update a group (only groupAdmin or admin can update)
router.put('/:id', auth, authorizeRoles('groupAdmin', 'admin'), groupController.updateGroup);

// DELETE /api/groups/:id , Delete a group (only groupAdmin or admin can delete)
router.delete('/:id', auth, authorizeRoles('groupAdmin', 'admin'), groupController.deleteGroup);

module.exports = router;