const express = require('express');
const router = express.Router();
const auth= require('../middleware/authMiddleware');
const User = require('../models/User');
const userController = require('../controllers/userController'); // Add this import

// Helper function for handling common database errors (e.g., 500 Server Error)
const handleServerError = (res, err) => {
    console.error(err.message);
    res.status(500).send('Server Error');
};

// @route   GET /api/user/me
// @desc    Get current authenticated user's profile
// @access  Private (requires authentication)
router.get('/me', auth, async(req, res)=>{
    try{
        let user = await User.findById(req.user.id).select('-password');
        if(!user){
            return res.status(404).json({msg: 'User not found'});
        }
        res.json(user);
    }catch(err){
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT /api/user/me
// @desc    Update current logged in user's profile (username, bio, profilePicture, email)
// @access  Private
router.put('/me', auth, async (req, res) => {
    // Only allow specific fields to be updated directly via this route for security
    const { username, email, bio, profilePicture } = req.body;

    const fieldsToUpdate = {};
    if (username) fieldsToUpdate.username = username;
    if (email) fieldsToUpdate.email = email;
    if (bio !== undefined) fieldsToUpdate.bio = bio; // Allow setting bio to empty string
    if (profilePicture !== undefined) fieldsToUpdate.profilePicture = profilePicture;

    try {
        const user = await User.findByIdAndUpdate(
            req.user.id, // ID from authenticated user
            { $set: fieldsToUpdate },
            { new: true, runValidators: true } // Return the updated document, run schema validators
        ).select('-password'); // Don't return password

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        // Handle unique field errors (e.g., duplicate username/email)
        if (err.code === 11000) {
            // Check if the duplicate key error is for email or username
            const field = Object.keys(err.keyValue)[0];
            return res.status(400).json({ msg: `A user with this ${field} already exists.` });
        }
        res.status(500).send('Server Error');
    }
});

// --ROUTES FOR MANAGING WATCHED CONTENT --
// @route   PUT /api/user/me/watched
router.put('/me/watched', auth, async (req, res) => {
    const { tmdbId, tmdbType, watchedDate } = req.body;
    if (!tmdbId || !tmdbType) {
        return res.status(400).json({ msg: 'TMDB ID and type are required' });
    }
    if (!['movie', 'tv'].includes(tmdbType)) {
        return res.status(400).json({ msg: 'tmdbType must be either "movie" or "tv".' });
    }
    try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ msg: 'User not found' });
            }
            // Check if content already exists in watchedContent list to avoid duplicates
            const alreadyWatched = user.watchedContent.some(
                (item) => item.tmdbId === tmdbId && item.tmdbType === tmdbType
            );
            if (alreadyWatched) {
                return res.status(400).json({ msg: 'Content already in watched list.' });
            }
            user.watchedContent.unshift({ // Add to the beginning of the array (most recent first)
                tmdbId,
                tmdbType,
                watchedDate: watchedDate || Date.now() // Use provided date or current date
            });
            await user.save();
            res.json(user.watchedContent); // Respond with the updated watched list
        } catch (err) {
            handleServerError(res, err);
        }
})

// DELETE /api/user/me/watched/:tmdbId/:tmdbType
router.delete('/me/watched/:tmdbId/:tmdbType', auth, async (req, res) => {
    const { tmdbId, tmdbType } = req.params;
    try{
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        // filter out the content to be removed
        const initialLength = user.watchedContent.length;
        user.watchedContent = user.watchedContent.filter(
            (item) => !(item.tmdbId == tmdbId && item.tmdbType === tmdbType)
        );
        if (user.watchedContent.length === initialLength) {
            return res.status(404).json({ msg: 'Content not found in watched list.' });
        }
        await user.save();
        res.json(user.watchedContent); // Respond with the updated watched list
    }catch(err){
        handleServerError(res, err);
    }

});

// --  ROUTES FOR MANAGING FAVORITE MOVIES --
// add a movie to user's favorite movies list , PUT /api/user/me/favorite-movies
router.put('/me/favorite-movies', auth, async (req, res) => {
    const { tmdbId, title}= req.body;
     if (!tmdbId || !title) {
        return res.status(400).json({ msg: 'TMDB ID and title are required for a favorite movie.' });
    }
    try{
        const user = await User.findById(req.user.id); 
        const alreadyFavorited = user.favoriteMovies.some(
            (item) => item.tmdbId == tmdbId
        );

        if (alreadyFavorited) {
            return res.status(400).json({ msg: 'Movie already in favorite list.' });
        }
        user.favoriteMovies.unshift({
            tmdbId,
            title
        })
        await user.save();
        res.json(user.favoriteMovies); // Respond with the updated favorite movies list
    }catch(err){
        handleServerError(res, err);
    }
})

//Remove a movie from user's favorite movies list , DELETE /api/user/me/favorite-movies/:tmdbId
router.delete('/me/favorite-movies/:tmdbId', auth, async (req, res) => {
    const { tmdbId } = req.params;
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        // filter out the movie to be removed
        const initialLength = user.favoriteMovies.length;
         user.favoriteMovies = user.favoriteMovies.filter(
            (item) => item.tmdbId != tmdbId
        );
         if (user.favoriteMovies.length === initialLength) {
            return res.status(404).json({ msg: 'Movie not found in favorite list.' });
        }

        await user.save();
        res.json(user.favoriteMovies); // Respond with the updated favorite movies list
    } catch (err) {
        handleServerError(res, err);
    }
})

// -- ROUTES FOR MANAGING FAVORITE GENRES -- 
//  Add a genre to user's favorite genres list , PUT /api/user/me/genres
router.put('/me/genres', auth, async (req, res) => {
    const { genre } = req.body;

    if (!genre || typeof genre !== 'string' || genre.trim() === '') {
        return res.status(400).json({ msg: 'Genre name is required and must be a non-empty string.' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Convert to lowercase and trim to ensure uniqueness regardless of case/whitespace
        const normalizedGenre = genre.trim().toLowerCase();

        // Check if genre already exists in list (case-insensitive)
        if (user.favoriteGenres.map(g => g.toLowerCase()).includes(normalizedGenre)) {
            return res.status(400).json({ msg: 'Genre already in favorite list.' });
        }

        user.favoriteGenres.push(genre.trim()); 
        await user.save();
        res.json(user.favoriteGenres); 
    } catch (err) {
        handleServerError(res, err);
    }
});

//Remove a genre from user's favorite genres list , DELETE /api/user/me/genres/:genreName
router.delete('/me/genres/:genreName', auth, async (req, res) => {
    const { genreName } = req.params; // Expect genre name directly in URL

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Filter out the genre to be removed (case-insensitive comparison)
        const initialLength = user.favoriteGenres.length;
        user.favoriteGenres = user.favoriteGenres.filter(
            (g) => g.toLowerCase() !== genreName.toLowerCase()
        );

        if (user.favoriteGenres.length === initialLength) {
            return res.status(404).json({ msg: 'Genre not found in favorite list.' });
        }

        await user.save();
        res.json(user.favoriteGenres); // Respond with the updated favorite genres
    } catch (err) {
        handleServerError(res, err);
    }
});

// -- ROUTES FOR MANAGING FRIENDS (simplified for now) --
// Add a user to current user's friends list, PUT /api/user/me/friends/:friendId
router.put('/me/friends/:friendId', auth, async (req, res) => {
    const { friendId } = req.params;

    if (req.user.id === friendId) {
        return res.status(400).json({ msg: 'Cannot add yourself as a friend.' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'Current user not found.' });
        }

        const friend = await User.findById(friendId);
        if (!friend) {
            return res.status(404).json({ msg: 'Friend user not found.' });
        }

        // Check if already friends
        if (user.friends.includes(friendId)) {
            return res.status(400).json({ msg: 'Already friends with this user.' });
        }

        user.friends.push(friendId);
        await user.save();

        // Optionally, add current user to friend's list as well for mutual friendship
        // friend.friends.push(req.user.id);
        // await friend.save();

        res.json(user.friends); // Respond with the updated friends list
    } catch (err) {
        handleServerError(res, err);
    }
});

//  Remove a user from current user's friends list, DELETE /api/user/me/friends/:friendId
router.delete('/me/friends/:friendId', auth, async (req, res) => {
    const { friendId } = req.params;

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        const initialLength = user.friends.length;
        user.friends = user.friends.filter(id => id.toString() !== friendId);

        if (user.friends.length === initialLength) {
            return res.status(404).json({ msg: 'Friend not found in list.' });
        }

        await user.save();

        // Optionally, remove current user from friend's list as well
        // const friend = await User.findById(friendId);
        // if (friend) {
        //     friend.friends = friend.friends.filter(id => id.toString() !== req.user.id);
        //     await friend.save();
        // }

        res.json(user.friends); // Respond with the updated friends list
    } catch (err) {
        handleServerError(res, err);
    }
});

// Friend request routes
router.post('/friends/request', auth, userController.sendFriendRequest);
router.put('/friends/accept', auth, userController.acceptFriendRequest);
router.put('/friends/reject', auth, userController.rejectFriendRequest);

module.exports = router;

