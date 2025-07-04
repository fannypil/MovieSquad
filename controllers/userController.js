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

// Update profile privacy settings,  PUT /api/user/me/settings
exports.updateProfileSettings = async (req, res) => {
    try {
        const { isPublic, showWatchedContent, showFavorites } = req.body;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Initialize profileSettings if it doesn't exist
        if (!user.profileSettings) {
            user.profileSettings = {};
        }

        if (isPublic !== undefined) user.profileSettings.isPublic = isPublic;
        if (showWatchedContent !== undefined) user.profileSettings.showWatchedContent = showWatchedContent;
        if (showFavorites !== undefined) user.profileSettings.showFavorites = showFavorites;

        await user.save();
        res.json(user.profileSettings);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

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
            (item) => item.tmdbId === parseInt(tmdbId) && item.tmdbType === tmdbType
        );
        if( alreadyWatched ) {
            return res.status(400).json({ message: 'Content already in watched list' });
        }
        user.watchedContent.unshift({
            tmdbId: parseInt(tmdbId), // Convert to number
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
// -- ROUTES FOR MANAGING MOVIE GENRES --
exports.addFavoriteMovie = async (req, res) => {
    const { tmdbId, title } = req.body;
    
    if (!tmdbId || !title) {
        return res.status(400).json({ message: 'TMDB ID and title are required for a favorite movie.' });
    }
    
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const alreadyFavorited = user.favoriteMovies.some(
            (item) => item.tmdbId === parseInt(tmdbId)
        );
        
        if (alreadyFavorited) {
            return res.status(400).json({ message: 'Movie already in favorite list.' });
        }
        
        user.favoriteMovies.unshift({
            tmdbId: parseInt(tmdbId),
            title
        });
        
        await user.save();
        res.json(user.favoriteMovies);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Remove a movie from user's favorite movies list
exports.removeFavoriteMovie = async (req, res) => {
    const { tmdbId } = req.params;
    
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const initialLength = user.favoriteMovies.length;
        user.favoriteMovies = user.favoriteMovies.filter(
            (item) => item.tmdbId !== parseInt(tmdbId)
        );
        
        if (user.favoriteMovies.length === initialLength) {
            return res.status(404).json({ message: 'Movie not found in favorite list.' });
        }
        
        await user.save();
        res.json(user.favoriteMovies);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

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
// Add a user to current user's friends list
exports.addFriend = async (req, res) => {
    const { friendId } = req.params;
    
    if (req.user.id === friendId) {
        return res.status(400).json({ message: 'Cannot add yourself as a friend.' });
    }
    
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Current user not found.' });
        }
        
        const friend = await User.findById(friendId);
        if (!friend) {
            return res.status(404).json({ message: 'Friend user not found.' });
        }
        
        if (user.friends.includes(friendId)) {
            return res.status(400).json({ message: 'Already friends with this user.' });
        }
        
        user.friends.push(friendId);
        await user.save();
        
        res.json(user.friends);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Remove a user from current user's friends list
exports.removeFriend = async (req, res) => {
    const { friendId } = req.params;
    
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        const initialLength = user.friends.length;
        user.friends = user.friends.filter(id => id.toString() !== friendId);
        
        if (user.friends.length === initialLength) {
            return res.status(404).json({ message: 'Friend not found in list.' });
        }
        
        await user.save();
        res.json(user.friends);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Get user's friends list, GET /api/user/me/friends
exports.getMyFriends = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('friends', 'username profilePicture bio')
            .select('friends');

        res.json(user.friends);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
// Get pending friend requests,  GET /api/user/me/friend-requests
exports.getPendingFriendRequests = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('friendRequests', 'username profilePicture bio')
            .select('friendRequests');

        res.json(user.friendRequests);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};


// Search users by username,GET /api/user/search?q=username
exports.searchUsers = async (req, res) => {
    try {
        const { q } = req.query;
        const currentUserId = req.user.id;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({ message: 'Search query must be at least 2 characters long' });
        }

        const users = await User.find({
            _id: { $ne: currentUserId }, // Exclude current user
            username: { $regex: q.trim(), $options: 'i' } // Case-insensitive search
        })
        .select('username email profilePicture bio')
        .limit(20); // Limit results

        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Get user profile by ID (for viewing other users), GET /api/user/profile/:userId
exports.getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;

        const user = await User.findById(userId)
            .select('-password -email') // Don't expose sensitive info
            .populate('friends', 'username profilePicture');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check friendship status
        const isFriend = user.friends.some(friend => friend._id.toString() === currentUserId);
        const hasPendingRequest = user.friendRequests && user.friendRequests.includes(currentUserId);

        res.json({
            ...user.toObject(),
            friendshipStatus: {
                isFriend,
                hasPendingRequest,
                canSendRequest: !isFriend && !hasPendingRequest
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};