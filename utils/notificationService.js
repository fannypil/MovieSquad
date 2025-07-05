
const Notification = require('../models/Notification');
const User = require('../models/User'); 
let ioInstance; 

// Function to set the Socket.IO instance
const setIoInstance = (io) => {
    ioInstance = io;
};

const createNotification = async (recipientId, type, { senderId = null, entityId = null, entityType = null, message = null } = {}) => {
    try {
        // Fetch sender/recipient usernames for a more descriptive message if 'message' is not provided
        let senderUsername = '';
        let recipientUsername = '';

        if (!message) {
            if (senderId) {
                const sender = await User.findById(senderId).select('username');
                if (sender) senderUsername = sender.username;
            }
            const recipient = await User.findById(recipientId).select('username');
            if (recipient) recipientUsername = recipient.username;
        }

        // Generate a default message if not provided
        if (!message) {
            switch (type) {
                case 'like':
                    message = `${senderUsername} liked your post.`;
                    break;
                case 'comment':
                    message = `${senderUsername} commented on your post.`;
                    break;
                case 'friend_request':
                    message = `${senderUsername} sent you a friend request.`;
                    break;
                case 'friend_accepted':
                    message = `${senderUsername} accepted your friend request.`;
                    break;
                case 'group_invite':
                    message = `${senderUsername} invited you to join a group.`;
                    break;
                case 'group_joined':
                    message = `${senderUsername} joined your group.`;
                    break;
                case 'group_watchlist_add':
                    message = `${senderUsername} added an item to your group's watchlist.`;
                    break;
                case 'new_private_message':
                    message = `${senderUsername} sent you a private message.`;
                    break;
                case 'admin_message':
                    message = `Admin: ${message || 'You have a new message.'}`; // Fallback if admin_message type used without specific message
                    break;
                case 'post_mentioned':
                    message = `${senderUsername} mentioned you in a post.`;
                    break;
                case 'shared_movie_recommendation':
                    message = `${senderUsername} recommended a movie to you.`;
                    break;
                case 'group_join_request':
                    message = `${senderUsername} requested to join your group.`;
                    break;
                case 'group_request_accepted':
                    message = `Your request to join the group was accepted.`;
                    break;
                case 'group_request_rejected':
                    message = `Your request to join the group was rejected.`;
                    break;
                case 'group_removed':
                    message = `You were removed from the group.`;
                    break;
                default:
                    message = 'You have a new notification.';
            }
        }


        const newNotification = new Notification({
            recipient: recipientId,
            sender: senderId,
            type: type,
            entityId: entityId,
            entityType: entityType,
            message: message,
            read: false // Always unread initially
        });

        const savedNotification = await newNotification.save();

        // Populate sender for real-time push
        await savedNotification.populate('sender', 'username profilePicture');

        // Real-time push if Socket.IO instance is available
        if (ioInstance) {
            // Emit to the recipient's personal room (which we set up in socketHandler)
            ioInstance.to(recipientId.toString()).emit('newNotification', savedNotification);
            console.log(`Pushed new notification to ${recipientId}: ${savedNotification.message}`);
        }

        return savedNotification;

    } catch (error) {
        console.error('Error creating notification:', error);
        // You might want to handle this error more gracefully, e.g., log to a file
        return null;
    }
};

module.exports = { createNotification, setIoInstance };