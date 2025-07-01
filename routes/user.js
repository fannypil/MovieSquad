const express = require('express');
const router = express.Router();
const auth= require('../middleware/authMiddleware');
const User = require('../models/User');

// @route   GET /api/users/me
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

module.exports = router;


