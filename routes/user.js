const express = require('express');
const router = express.Router();
const auth= require('../middleware/authMiddleware');
const User = require('../models/User');
const authorizeRoles= require('../middleware/authorizeRoles');

// @route   GET /api/user/me
// @desc    Get current authenticated user's profile
// @access  Private (requires authentication)
router.get('/me', auth, async(req, res)=>{
    try{
        const user= await User.findById(req.user.id).select('-password');
        if(!user){
            return res.status(404).json({msg: 'User not found'});
        }
        res.json(user);
    }catch(err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET /api/user/admin-dashboard
// @desc    Access a protected admin-only resource
// @access  Private (requires 'admin' role)
// This route will only be reached if the user is authenticated AND has the 'admin' role
router.get('/admin-dashboard', auth, authorizeRoles('admin'), (req, res) => {
    // This route will only be reached if the user is authenticated AND has the 'admin' role
    res.json({ msg: `Welcome to the Admin Dashboard, ${req.user.id}!` });
});

module.exports = router;


