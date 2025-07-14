// scripts/setDefaultAvatars.js
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const DEFAULT_AVATAR = 'https://www.w3schools.com/howto/img_avatar.png';

async function setDefaultAvatars() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find users without profile pictures or with null values
        const usersWithoutAvatars = await User.find({
            $or: [
                { profilePicture: null },
                { profilePicture: { $exists: false } },
                { profilePicture: '' }
            ]
        });

        console.log(`Found ${usersWithoutAvatars.length} users without profile pictures`);

        // Update all users without avatars
        const updateResult = await User.updateMany(
            {
                $or: [
                    { profilePicture: null },
                    { profilePicture: { $exists: false } },
                    { profilePicture: '' }
                ]
            },
            {
                $set: { profilePicture: DEFAULT_AVATAR }
            }
        );

        console.log(`Updated ${updateResult.modifiedCount} users with default avatar`);
        console.log(` Default avatar: ${DEFAULT_AVATAR}`);

        // Display updated users
        if (usersWithoutAvatars.length > 0) {
            console.log('\n📋 Updated Users:');
            usersWithoutAvatars.forEach(user => {
                console.log(`   ${user.username} (${user.email})`);
            });
        }

        console.log('\nSuccessfully set default avatars for all users!');
        
    } catch (error) {
        console.error('❌ Error setting default avatars:', error);
    } finally {
        await mongoose.disconnect();
        console.log(' Disconnected from MongoDB');
    }
}

// Run the script
if (require.main === module) {
    setDefaultAvatars()
        .then(() => {
            console.log('\= Migration completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error(' Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { setDefaultAvatars };