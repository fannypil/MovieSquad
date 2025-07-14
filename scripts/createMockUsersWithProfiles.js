const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

const mockUsers = [
    {
        username: 'jane_smith',
        email: 'jane@gmail.com', 
        password: 'password123',
        profile: {
            bio: 'Rom-com lover and Netflix binge-watcher.',
            favoriteGenres: ['Romance', 'Comedy', 'Drama'],
            favoriteMovies: [
                { tmdbId: 19404, title: 'Dilwale Dulhania Le Jayenge' },
                { tmdbId: 597, title: 'Titanic' }
            ]
        }
    },
    {
        username: 'mike_wilson',
        email: 'mike@gmail.com',
        password: 'password123',
        profile: {
            bio: 'Horror movie fanatic and film critic.',
            favoriteGenres: ['Horror', 'Mystery', 'Thriller'],
            favoriteMovies: [
                { tmdbId: 346, title: 'Seven' },
                { tmdbId: 694, title: 'The Shining' }
            ]
        }
    },
    {
        username: 'sarah_johnson',
        email: 'sarah@gmail.com',
        password: 'password123',
        profile: {
            bio: 'Animation and family movie lover.',
            favoriteGenres: ['Animation', 'Family', 'Adventure'],
            favoriteMovies: [
                { tmdbId: 862, title: 'Toy Story' },
                { tmdbId: 129, title: 'Spirited Away' }
            ]
        }
    },
    {
        username: 'david_brown',
        email: 'david@gmail.com',
        password: 'password123',
        profile: {
            bio: 'Documentary and indie film supporter.',
            favoriteGenres: ['Documentary', 'Drama', 'Independent'],
            favoriteMovies: [
                { tmdbId: 550, title: 'Fight Club' },
                { tmdbId: 680, title: 'Pulp Fiction' }
            ]
        }
    }
];

async function createUserWithProfile(userData) {
    try {
        // 1. Register user
        console.log(`📝 Creating user: ${userData.username}...`);
        const registerResponse = await axios.post(`${API_BASE_URL}/auth/register`, {
            username: userData.username,
            email: userData.email,
            password: userData.password
        });
        
        const { token, user } = registerResponse.data;
        console.log(`✅ User created: ${userData.username}`);
        
        // 2. Update profile with bio
        if (userData.profile.bio) {
            await axios.put(`${API_BASE_URL}/user/me`, 
                { bio: userData.profile.bio },
                { headers: { 'x-auth-token': token } }
            );
            console.log(`   📝 Bio updated for ${userData.username}`);
        }
        
        // 3. Add favorite genres
        if (userData.profile.favoriteGenres) {
            for (const genre of userData.profile.favoriteGenres) {
                await axios.put(`${API_BASE_URL}/user/me/genres`,
                    { genre },
                    { headers: { 'x-auth-token': token } }
                );
            }
            console.log(`   🎭 Added ${userData.profile.favoriteGenres.length} favorite genres`);
        }
        
        // 4. Add favorite movies
        if (userData.profile.favoriteMovies) {
            for (const movie of userData.profile.favoriteMovies) {
                await axios.put(`${API_BASE_URL}/user/me/favorite-movies`,
                    movie,
                    { headers: { 'x-auth-token': token } }
                );
            }
            console.log(`   🎬 Added ${userData.profile.favoriteMovies.length} favorite movies`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
        
        return { 
            success: true, 
            username: userData.username,
            userId: user._id,
            token 
        };
        
    } catch (error) {
        console.log(`❌ Failed to create: ${userData.username}`);
        console.log(`   Error: ${error.response?.data?.message || error.message}`);
        return { 
            success: false, 
            username: userData.username,
            error: error.response?.data?.message || error.message 
        };
    }
}

async function createMockUsersWithProfiles() {
    console.log('🎬 Creating Mock Users with Profiles for MovieSquad...');
    console.log('===================================================');
    
    const results = [];
    
    for (const userData of mockUsers) {
        const result = await createUserWithProfile(userData);
        results.push(result);
        
        // Delay between users
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log('\n🎯 Summary:');
    console.log(`✅ Successfully created: ${successful.length} users with profiles`);
    console.log(`❌ Failed to create: ${failed.length} users`);
    
    if (successful.length > 0) {
        console.log('\n📋 Created Users:');
        successful.forEach(user => {
            console.log(`   ${user.username} - ID: ${user.userId}`);
        });
        
        // Save successful users
        const fs = require('fs');
        fs.writeFileSync('./mockUsersWithProfiles.json', JSON.stringify(successful, null, 2));
        console.log('\n💾 User data saved to mockUsersWithProfiles.json');
    }
    
    return results;
}

// Run the script
if (require.main === module) {
    createMockUsersWithProfiles()
        .then(() => {
            console.log('\n🎉 Mock user creation with profiles completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = { createMockUsersWithProfiles, mockUsers };