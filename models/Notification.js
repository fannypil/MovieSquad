
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    recipient: { // The user who receives this notification
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // Index for efficient querying by recipient
    },
    sender: { // Optional: The user who triggered the notification (e.g., who liked, commented, sent request)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Not all notifications have a specific sender (e.g., system notifications)
    },
    type: { // Type of notification (e.g., 'like', 'comment', 'friend_request', 'group_invite', 'new_message', 'watchlist_add', 'admin_message')
        type: String,
        required: [true, 'Notification type is required'],
        enum: [
            'like', 'comment', 'friend_request', 'friend_accepted',
            'group_invite', 'group_joined', 'group_watchlist_add',
            'group_join_request', 'group_request_accepted', 'group_request_rejected', 'group_removed', // ✅ ADD THESE
            'new_private_message', 'admin_message', 'post_mentioned',
            'shared_movie_recommendation'
        ]
    },
    entityId: { // Optional: ID of the related entity (e.g., Post ID, Comment ID, Group ID, Message ID)
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        index: true // Index for direct lookup
    },
    entityType: { // Optional: Type of the related entity ('Post', 'Comment', 'Group', 'Message', etc.)
        type: String,
        required: function() {
            return !!this.entityId; // Required if entityId is present
        },
        enum: ['Post', 'Comment', 'Group', 'Message', 'User'] // Expand as needed
    },
    message: { // Custom message for the notification (e.g., "John Doe liked your post")
        type: String,
        trim: true,
        maxlength: [250, 'Notification message cannot exceed 250 characters']
    },
    read: { // Whether the notification has been read by the recipient
        type: Boolean,
        default: false,
        index: true // Index for efficient unread count
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

module.exports = mongoose.model('Notification', NotificationSchema);