
const mongoose = require('mongoose');

const userSchema= new mongoose.Schema({
   username:{
         type: String,
         required: true,
         unique: true,
         trim: true,
        minlength: 3
   },
    email:{
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please enter a valid email address']
    },
    password:{
        type: String,
        required: true,
        minlength: 6
    },
    role:{
        type: String,
        enum: ['user','groupAdmin', 'admin'],
        default: 'user'
    },
    // Optional: Add fields for tracking content, groups, etc.
    watchedMovies:[
        {
            tmdbId:{type: Number, required: true},
            title:{type: String}
        }
    ],
    favoriteMovies:[
        {
            tmdbId:{type: Number, required: true},
            title:{type: String}
        }
    ],
     // Add an array of ObjectIds referencing Group models, if a user can be part of many groups
    groups:[
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Group' // This will reference the 'Group' model
        }
    ],
    friends:[
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User' // This will reference the 'User' model
        }
    ]
},{
    timestamps: true // Adds `createdAt` and `updatedAt` fields automatically
});

// export the User model
module.exports = mongoose.model('User', userSchema);