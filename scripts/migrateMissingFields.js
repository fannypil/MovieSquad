// scripts/migrateMissingFields.js
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function migrateMissingFields() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Find users with missing fields
        const users = await User.find({
            $or: [
                { 'watchedContent.title': { $exists: false } },
                { 'favoriteMovies.tmdbType': { $exists: false } }
            ]
        });

        console.log(`Found ${users.length} users with missing fields`);

        for (const user of users) {
            let needsSave = false;

            // Fix watchedContent missing titles
            if (user.watchedContent && user.watchedContent.length > 0) {
                user.watchedContent.forEach((item, index) => {
                    if (!item.title) {
                        item.title = `Unknown Title ${item.tmdbId || index}`;
                        needsSave = true;
                        console.log(`Fixed watchedContent title for user ${user.username}: ${item.title}`);
                    }
                });
            }

            // Fix favoriteMovies missing tmdbType
            if (user.favoriteMovies && user.favoriteMovies.length > 0) {
                user.favoriteMovies.forEach((item, index) => {
                    if (!item.tmdbType) {
                        item.tmdbType = 'movie'; // Default to movie
                        needsSave = true;
                        console.log(`Fixed favoriteMovie tmdbType for user ${user.username}: ${item.title} -> movie`);
                    }
                });
            }

            if (needsSave) {
                await user.save({ validateBeforeSave: false }); // Skip validation during migration
                console.log(`✅ Updated user: ${user.username}`);
            }
        }

        console.log('🎉 Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run migration
migrateMissingFields();