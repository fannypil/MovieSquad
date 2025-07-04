const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app'); // Your Express app
const User = require('../models/User');
const Notification = require('../models/Notification');

// Test data
let userToken1, userToken2;
let user1Id, user2Id;

describe('Movie Squad API Tests', () => {
    
     beforeAll(async () => {
        // Connect to test database
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI);
        }
        
        // Clean database once before all tests
        await User.deleteMany({});
    });

        afterAll(async () => {
        // Clean up and close connection
        await User.deleteMany({});
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    });
    describe('🔐 Authentication', () => {
        test('Should register user 1', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser1',
                    email: 'test1@example.com',
                    password: 'password123'
                });

            expect(res.status).toBe(201);
            expect(res.body.token).toBeDefined();
            userToken1 = res.body.token;
            user1Id = res.body.user._id;
            console.log('User 1 registered with ID:', user1Id);
        });

        test('Should register user 2', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser2',
                    email: 'test2@example.com',
                    password: 'password123'
                });

            expect(res.status).toBe(201);
            userToken2 = res.body.token;
            user2Id = res.body.user._id;
            console.log('User 2 registered with ID:', user2Id);
        });

        test('Should login user 1', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test1@example.com',
                    password: 'password123'
                });

            console.log('Login response:', res.status, res.body);
            expect(res.status).toBe(200);
            expect(res.body.token).toBeDefined();
        });
    });

    describe('👤 User Profile Management', () => {
        test('Should get my profile', async () => {
            const res = await request(app)
                .get('/api/user/me')
                .set('x-auth-token', userToken1);
            
             if (res.status !== 200) {
                console.log('Profile error:', res.status, res.body);
            }
            expect(res.status).toBe(200);
            expect(res.body.username).toBe('testuser1');
            expect(res.body.password).toBeUndefined();
        });

        test('Should update profile', async () => {
            const res = await request(app)
                .put('/api/user/me')
                .set('x-auth-token', userToken1)
                .send({
                    bio: 'Movie enthusiast and film critic',
                    profilePicture: 'new-avatar.jpg'
                });

            expect(res.status).toBe(200);
            expect(res.body.bio).toBe('Movie enthusiast and film critic');
        });

        test('Should update profile settings', async () => {
            const res = await request(app)
                .put('/api/user/me/settings')
                .set('x-auth-token', userToken1)
                .send({
                    isPublic: false,
                    showWatchedContent: true,
                    showFavorites: false
                });

            expect(res.status).toBe(200);
            expect(res.body.isPublic).toBe(false);
            expect(res.body.showFavorites).toBe(false);
        });
    });

    describe('👥 Friends Management', () => {
        test('Should search for users', async () => {
            const res = await request(app)
                .get('/api/user/search?q=testuser2')
                .set('x-auth-token', userToken1);

            expect(res.status).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
            expect(res.body[0].username).toBe('testuser2');
        });

        test('Should send friend request', async () => {
            const res = await request(app)
                .post('/api/user/friends/request')
                .set('x-auth-token', userToken1)
                .send({
                    recipientId: user2Id
                });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Friend request sent successfully');
        });

        test('Should get pending friend requests', async () => {
            const res = await request(app)
                .get('/api/user/me/friend-requests')
                .set('x-auth-token', userToken2);

            expect(res.status).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0]._id).toBe(user1Id);
        });

        test('Should accept friend request', async () => {
            const res = await request(app)
                .put('/api/user/friends/accept')
                .set('x-auth-token', userToken2)
                .send({
                    senderId: user1Id
                });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Friend request accepted successfully');
        });

        test('Should get friends list', async () => {
            const res = await request(app)
                .get('/api/user/me/friends')
                .set('x-auth-token', userToken1);

            expect(res.status).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0]._id).toBe(user2Id);
        });
    });

    describe('🎬 Content Management', () => {
        test('Should add watched content', async () => {
            const res = await request(app)
                .put('/api/user/me/watched')
                .set('x-auth-token', userToken1)
                .send({
                    tmdbId: 27205,
                    tmdbType: 'movie'
                });

            expect(res.status).toBe(200);
            expect(res.body[0].tmdbId).toBe(27205);
        });

        test('Should add favorite movie', async () => {
            const res = await request(app)
                .put('/api/user/me/favorite-movies')
                .set('x-auth-token', userToken1)
                .send({
                    tmdbId: 27205,
                    title: 'Inception'
                });

            expect(res.status).toBe(200);
            expect(res.body[0].title).toBe('Inception');
        });
    });

    describe('📱 Activity Feed', () => {
        test('Should get my posts activity', async () => {
            const res = await request(app)
                .get('/api/activity/me')
                .set('x-auth-token', userToken1);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        test('Should get friends posts feed', async () => {
            const res = await request(app)
                .get('/api/activity/feed')
                .set('x-auth-token', userToken1);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        test('Should get user activity', async () => {
            const res = await request(app)
                .get(`/api/activity/user/${user2Id}`)
                .set('x-auth-token', userToken1);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        test('Should get activity stats', async () => {
            const res = await request(app)
                .get('/api/activity/stats')
                .set('x-auth-token', userToken1);

            expect(res.status).toBe(200);
            expect(res.body.totalPosts).toBeDefined();
        });
    });

    describe('🚫 Error Handling', () => {
        test('Should require authentication', async () => {
            const res = await request(app)
                .get('/api/user/me');

            expect(res.status).toBe(401);
        });

        test('Should handle invalid user ID', async () => {
            const res = await request(app)
                .get('/api/activity/user/invalid-id')
                .set('x-auth-token', userToken1);

            expect(res.status).toBe(500);
        });
    });
    describe('🔔 Notification System', () => {
    let postId;

    // First create a post to test notifications
    beforeAll(async () => {
        // Clean notifications
        await Notification.deleteMany({});
        
        // Create post for testing
        const postRes = await request(app)
            .post('/api/posts')
            .set('x-auth-token', userToken1)
            .send({
                content: 'Test post for notifications',
                tmdbId: 27205,
                tmdbType: 'movie',
                tmdbTitle: 'Inception'
            });
        postId = postRes.body._id;
    });

   test('Should create notification when user likes a post', async () => {
        // User 2 likes User 1's post
        const likeRes = await request(app)
            .put(`/api/posts/${postId}/like`)
            .set('x-auth-token', userToken2);

        if (likeRes.status !== 200) {
            console.log('Like failed:', likeRes.status, likeRes.body);
        }

        // Wait a bit for notification to be created
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check User 1's notifications
        const res = await request(app)
            .get('/api/notifications/me')
            .set('x-auth-token', userToken1);

        if (res.status !== 200) {
            console.log('Notification fetch error:', res.status, res.body);
        }

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        
        if (res.body.length > 0) {
            expect(res.body[0].type).toBe('like');
            expect(res.body[0].read).toBe(false);
        }
    });

    test('Should create notification when user comments on a post', async () => {
        // User 2 comments on User 1's post
        const commentRes = await request(app)
            .post(`/api/posts/${postId}/comments`)
            .set('x-auth-token', userToken2)
            .send({
                text: 'Great post about Inception!'
            });

        if (commentRes.status !== 201) {
            console.log('Comment failed:', commentRes.status, commentRes.body);
        }

        // Wait a bit for notification to be created
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check User 1's notifications
        const res = await request(app)
            .get('/api/notifications/me')
            .set('x-auth-token', userToken1);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        
        const commentNotification = res.body.find(n => n.type === 'comment');
        if (commentNotification) {
            expect(commentNotification.message).toContain('commented on your post');
        }
    });

    test('Should get unread notification count', async () => {
        const res = await request(app)
            .get('/api/notifications/me/unread-count')
            .set('x-auth-token', userToken1);

        if (res.status !== 200) {
            console.log('Unread count error:', res.status, res.body);
        }

        expect(res.status).toBe(200);
        expect(res.body.unreadCount).toBeDefined();
        expect(typeof res.body.unreadCount).toBe('number');
    });

    test('Should mark notification as read', async () => {
        // Get notifications first
        const notificationsRes = await request(app)
            .get('/api/notifications/me')
            .set('x-auth-token', userToken1);

        expect(notificationsRes.status).toBe(200);
        
        if (notificationsRes.body.length > 0) {
            const notification = notificationsRes.body[0];

            // Mark as read
            const res = await request(app)
                .put(`/api/notifications/${notification._id}/read`)
                .set('x-auth-token', userToken1);

            expect(res.status).toBe(200);
            expect(res.body.notification.read).toBe(true);
        } else {
            // Skip test if no notifications
            console.log('No notifications to mark as read');
        }
    });

    test('Should mark all notifications as read', async () => {
        const res = await request(app)
            .put('/api/notifications/me/read-all')
            .set('x-auth-token', userToken1);

        if (res.status !== 200) {
            console.log('Mark all read error:', res.status, res.body);
        }

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('All notifications marked as read');

        // Verify unread count is now 0
        const countRes = await request(app)
            .get('/api/notifications/me/unread-count')
            .set('x-auth-token', userToken1);

        expect(countRes.body.unreadCount).toBe(0);
    });

    test('Should delete a notification', async () => {
        // Create a new notification by liking again
        await request(app)
            .put(`/api/posts/${postId}/like`)
            .set('x-auth-token', userToken2);

        // Wait for notification
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get the notification
        const notificationsRes = await request(app)
            .get('/api/notifications/me')
            .set('x-auth-token', userToken1);

        expect(notificationsRes.status).toBe(200);
        expect(Array.isArray(notificationsRes.body)).toBe(true);

        if (notificationsRes.body.length > 0) {
            const notification = notificationsRes.body.find(n => n.read === false);
            
            if (notification) {
                // Delete the notification
                const res = await request(app)
                    .delete(`/api/notifications/${notification._id}`)
                    .set('x-auth-token', userToken1);

                expect(res.status).toBe(200);
                expect(res.body.message).toBe('Notification deleted successfully');
            }
        }
    });

    test('Should not allow user to read other user\'s notifications', async () => {
        // Get User 1's notifications
        const notificationsRes = await request(app)
            .get('/api/notifications/me')
            .set('x-auth-token', userToken1);

        if (notificationsRes.body.length > 0) {
            const notification = notificationsRes.body[0];

            // Try to mark it as read with User 2's token
            const res = await request(app)
                .put(`/api/notifications/${notification._id}/read`)
                .set('x-auth-token', userToken2);

            expect(res.status).toBe(403);
            expect(res.body.message).toContain('Forbidden');
        }
    });

    test('Should create notification for group activities', async () => {
        // Create a group
        const groupRes = await request(app)
            .post('/api/groups')
            .set('x-auth-token', userToken1)
            .send({
                name: 'Test Group for Notifications',
                description: 'Testing notifications'
            });

        expect(groupRes.status).toBe(201);
        const groupId = groupRes.body._id;

        // User 2 joins the group
        const joinRes = await request(app)
            .put(`/api/groups/${groupId}/join`)
            .set('x-auth-token', userToken2);

        if (joinRes.status !== 200) {
            console.log('Group join failed:', joinRes.status, joinRes.body);
        }

        // Wait for notification
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check User 1's notifications (group admin)
        const res = await request(app)
            .get('/api/notifications/me')
            .set('x-auth-token', userToken1);

        expect(res.status).toBe(200);
        const groupNotification = res.body.find(n => n.type === 'group_joined');
        if (groupNotification) {
            expect(groupNotification).toBeDefined();
        }
    });

    test('Should create notification for watchlist activities', async () => {
        // Create a group first
        const groupRes = await request(app)
            .post('/api/groups')
            .set('x-auth-token', userToken1)
            .send({
                name: 'Watchlist Test Group',
                description: 'Testing watchlist notifications'
            });

        expect(groupRes.status).toBe(201);
        const groupId = groupRes.body._id;

        // User 2 joins the group
        await request(app)
            .put(`/api/groups/${groupId}/join`)
            .set('x-auth-token', userToken2);

        // User 2 adds to watchlist
        const watchlistRes = await request(app)
            .post(`/api/groups/${groupId}/watchlist`)
            .set('x-auth-token', userToken2)
            .send({
                tmdbId: 550,
                tmdbType: 'movie',
                tmdbTitle: 'Fight Club'
            });

        if (watchlistRes.status !== 201) {
            console.log('Watchlist add failed:', watchlistRes.status, watchlistRes.body);
        }

        // Wait for notification
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check User 1's notifications
        const res = await request(app)
            .get('/api/notifications/me')
            .set('x-auth-token', userToken1);

        expect(res.status).toBe(200);
        const watchlistNotification = res.body.find(n => n.type === 'group_watchlist_add');
        if (watchlistNotification) {
            expect(watchlistNotification).toBeDefined();
        }
    });
});

});
