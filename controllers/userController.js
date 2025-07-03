const { getEventListeners } = require('supertest/lib/test');
const User = require('../models/User')
const jwt= require('jsonwebtoken');
const { createNotification } = require('../utils/notificationService'); // Add this import

// Get current logged in user (profile) , /api/user/me
exports.getMe = async (req, res) => {
    try{
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user)
    }catch(err){
        console.error(err.message);
        res.status(500).send('Server Error');
    }
}

//Update current logged in user's profile /api/user/me
exports.updateMe = async (req, res) => {
    const {username, email, bio, profilePicture} = req.body;
    const fieldsToUpdate ={};
    if (username) fieldsToUpdate.username = username;
    if (email) fieldsToUpdate.email = email;
    if (bio!==undefined) fieldsToUpdate.bio = bio;
    if (profilePicture!==undefined) fieldsToUpdate.profilePicture = profilePicture;

    try{
       const user = await User.findByIdAndUpdate(
            req.user.id, // ID from authenticated user
            { $set: fieldsToUpdate },
            { new: true, runValidators: true } // Return the updated document, run schema validators
        ).select('-password'); // Don't return password
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    }catch(err){
        console.error(err.message);
        // handle unique fields errors
        if(err.code === 11000){
            return res.status(400).json({ msg: 'User with this email or username already exists' });
        }
        res.status(500).send('Server Error');
    }
}

// -- ROUTES FOR MANAGING WATCHED CONTENT -- 

// Add a watched content to the user's profile, /api/user/me/watched
exports.addWatchedContent = async (req, res) => {
    const { tmdbId, tmdbType, watchedDate } = req.body;

    if(!tmdbId || !tmdbType) {
        return res.status(400).json({ message: 'TMDB ID and type are required' });
    }
    if( !['movie', 'tv'].includes(tmdbType)) {
        return res.status(400).json({ message: 'tmdbType must be either "movie" or "tv".' });
    }
    try{
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the content is already in the watched list
        const alreadyWatched = user.watchedContent.some(
            (item)=> item.tmbdId ===tmdbId && item.tmdbType === tmdbType)
        if( alreadyWatched ) {
            return res.status(400).json({ message: 'Content already in watched list' });
        }
        user.watchedContent.unshift({
            tmdbId,
            tmdbType,
            watchedDate: watchedDate || Date.now()
        });
        await user.save();
        res.json(user.watchedContent);

    }catch(err){
        console.error(err.message);
        res.status(500).send('Server Error');
    }
}

//Remove a movie/TV show from user's watched list /api/user/me/watched/:tmdbId/:tmdbType
exports.removeWatchedContent = async (req, res) =>{
    const { tmdbId, tmdbType } = req.params;
    try{
        const user= await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Filter out the content to be removed
        user.watchedContent = user.watchedContent.filter(
            (item) => !(item.tmdbId == tmdbId && item.tmdbType === tmdbType)
        );
        await user.save();
        res.json(user.watchedContent);
    }catch(err){
        console.error(err.message);
        res.status(500).send('Server Error');
    }
}

// -- ROUTES FOR MANAGING FAVORITE GENRES --
// Add a genre to user's favorite genres list /api/user/me/genres
exports.addFavoriteGenre = async (req, res) => {
    const { genre } = req.body;

    if(!genre|| typeof genre !== 'string' || genre.trim() === '') {
        return res.status(400).json({ message: 'Genre name is required and must be a non-empty string' });
    }
    try{
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        //Convert to lowercase and trim to ensure uniqueness regardless of case/whitespace
        const normalizedGenre = genre.trim().toLowerCase();
        // Check if genre already exists in list
        if (user.favoriteGenres.map(g => g.toLowerCase()).includes(normalizedGenre)) {
            return res.status(400).json({ msg: 'Genre already in favorite list' });
        }
        user.favoriteGenres.push(genre.trim());
        await user.save();
        res.json(user.favoriteGenres);        
    }catch(err){
        console.error(err.message);
        res.status(500).send('Server Error');
    }
}

//  Remove a genre from user's favorite genres list /api/user/me/genres/:genreName
exports.removeFavoriteGenre = async (req, res) => {
    const { genreName } = req.params; 
    try{
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Filter out the genre to be removed (case-insensitive comparison)
        user.favoriteGenres = user.favoriteGenres.filter(
            (g)=> g.toLowerCase() !== genreName.toLowerCase()
        );
        await user.save();
        res.json(user.favoriteGenres);
    }catch(err){
        console.error(err.message);
        res.status(500).send('Server Error');
    }
}

// -- ROUTES FOR MANAGING FRIENDS --

// Send a friend request, POST /api/user/friends/request
exports.sendFriendRequest = async (req, res) => {
    const { recipientId } = req.body; // The user to send request to
    const senderId = req.user.id; // Current authenticated user

    if (!recipientId) {
        return res.status(400).json({ message: 'Recipient ID is required' });
    }

    if (recipientId === senderId) {
        return res.status(400).json({ message: 'You cannot send a friend request to yourself' });
    }

    try {
        const sender = await User.findById(senderId);
        const recipient = await User.findById(recipientId);

        if (!recipient) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if they are already friends
        if (sender.friends.includes(recipientId)) {
            return res.status(400).json({ message: 'You are already friends with this user' });
        }

        // Check if request already sent
        if (recipient.friendRequests && recipient.friendRequests.includes(senderId)) {
            return res.status(400).json({ message: 'Friend request already sent' });
        }

        // Add to recipient's friend requests
        if (!recipient.friendRequests) recipient.friendRequests = [];
        recipient.friendRequests.push(senderId);
        await recipient.save();

        // CREATE NOTIFICATION: Notify recipient of friend request
        await createNotification(recipientId, 'friend_request', {
            senderId: senderId,
            entityId: senderId,
            entityType: 'User'
        });

        res.json({ message: 'Friend request sent successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Accept a friend request, PUT /api/user/friends/accept
exports.acceptFriendRequest = async (req, res) => {
    const { senderId } = req.body; // The user who sent the request
    const recipientId = req.user.id; // Current authenticated user

    if (!senderId) {
        return res.status(400).json({ message: 'Sender ID is required' });
    }

    try {
        const recipient = await User.findById(recipientId);
        const sender = await User.findById(senderId);

        if (!sender) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if friend request exists
        if (!recipient.friendRequests || !recipient.friendRequests.includes(senderId)) {
            return res.status(400).json({ message: 'No friend request found from this user' });
        }

        // Remove from friend requests
        recipient.friendRequests.pull(senderId);
        
        // Add to friends lists for both users
        if (!recipient.friends) recipient.friends = [];
        if (!sender.friends) sender.friends = [];
        
        recipient.friends.push(senderId);
        sender.friends.push(recipientId);

        await recipient.save();
        await sender.save();

        // CREATE NOTIFICATION: Notify sender that their request was accepted
        await createNotification(senderId, 'friend_accepted', {
            senderId: recipientId,
            entityId: recipientId,
            entityType: 'User'
        });

        res.json({ message: 'Friend request accepted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Reject a friend request, PUT /api/user/friends/reject
exports.rejectFriendRequest = async (req, res) => {
    const { senderId } = req.body;
    const recipientId = req.user.id;

    if (!senderId) {
        return res.status(400).json({ message: 'Sender ID is required' });
    }

    try {
        const recipient = await User.findById(recipientId);

        if (!recipient.friendRequests || !recipient.friendRequests.includes(senderId)) {
            return res.status(400).json({ message: 'No friend request found from this user' });
        }

        // Remove from friend requests
        recipient.friendRequests.pull(senderId);
        await recipient.save();

        res.json({ message: 'Friend request rejected successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};