// server/routes/group.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware'); // Import auth middleware
const authorizeRoles = require('../middleware/authorizeRoles'); // Import RBAC middleware
const groupController = require('../controllers/groupController'); // Import the group controller

// @route   POST /api/groups
// @desc    Create a new group
// @access  Private (only authenticated users with 'user', 'groupAdmin', or 'admin' roles can create)
// Note: We use 'user' role as a default for any authenticated user.
router.post('/', auth, authorizeRoles('user', 'groupAdmin', 'admin'), groupController.createGroup);

// @route   GET /api/groups
// @desc    Get all groups
// @access  Public (anyone can view all groups)
router.get('/', groupController.getAllGroups);

// @route   GET /api/groups/:id
// @desc    Get group by ID
// @access  Public (anyone can view a specific group by ID)
router.get('/:id', groupController.getGroupById);


module.exports = router;