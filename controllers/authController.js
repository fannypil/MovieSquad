const {validationResult} = require('express-validator');
const bycrypt = require('bcryptjs'); // password hashing library
const jwt = require('jsonwebtoken'); // JWT library for token generation
const User = require('../models/User');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public

exports.registerUser= async(req, res)=>{
    // validate the request body
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({errors: errors.array()});
    }
    const {username, email, password} = req.body;
    try{
        // Check if user already exists
        let userByEmail = await User.findOne({email})
        if(userByEmail){
            return res.status(400).json({ errors: [{ msg: 'User with this email already exists' }] });
        }
        let userByUsername = await User.findOne({username})
        if(userByUsername){
            return res.status(400).json({ errors: [{ msg: 'User with this username already exists' }] });
        }
        // Create a new user
        const user = new User({
            username,
            email,
            password
        });
        // Hash the password
        const salt = await bycrypt.genSalt(10);
        user.password = await bycrypt.hash(password, salt); // Hash the password before saving it

        // Save the user to the database
        await user.save();
        // Generate a JWT token
        const payload={
            user:{
                id: user.id, // Mongoose `id` is the `_id` field
                role: user.role //Include role in token for auth checks
            }
        }
        jwt.sign(
            payload,
            process.env.JWT_SECRET, // Use the secret from environment variables
            {expiresIn: '1h'}, // Token expires in 1 hour
            (err, token)=>{
                if(err) throw err; 
                res.status(201).json({msg: 'User registered successfully', token}); 
            }
        )
    }catch(error){
        console.error(error.message);
        res.status(500).json({msg: 'Server error'});
    }
}

// @desc    Authenticate user & get token (login)
// @route   POST /api/auth/login
// @access  Public

exports.loginUser= async(req, res)=>{
    // validate the request body
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({errors: errors.array()});
    }
    const {email, password} = req.body;
    try{
        // Check if user exists
        let user = await User.findOne({email})
        if(!user){
            return res.status(400).json({ errors: [{ msg: 'Invalid credentials' }] });
        }
        // Check if password matches
        const isMatch = await bycrypt.compare(password, user.password);
        if(!isMatch){
            return res.status(400).json({ errors: [{ msg: 'Invalid credentials' }] });
        }
        // Generate a JWT token
        const payload={
            user:{
                id: user.id,
                role: user.role 
            }
        }
        jwt.sign(
            payload,
            process.env.JWT_SECRET, 
            {expiresIn: '1h'}, 
            (err, token)=>{
                if(err) throw err; 
                res.status(200).json({msg: 'User logged in successfully', token}); 
            }
        )
    }catch(err){
        console.error(err.message);
        res.status(500).json({msg: 'Server error'});
    }
}