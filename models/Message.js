const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    sender:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    group:{ // Optional: If message belongs to a specific group chat
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: false,
        index: true
    },
    recipient: { // Optional: For private messages (1-on-1)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // Not required for group messages
        index: true // Add index for faster recipient queries
    },
    chatIdentifier: { // For 1-on-1 chats: a unique ID for the conversation between two users
        type: String,
        required: function() {
            return !this.group && this.recipient; // Required only if it's a private message (no group, has recipient)
        },
        index: true, // Index for efficient conversation history retrieval
        unique: false // Not unique globally, but unique per sender/recipient pair (handled by application logic)
    },
    content: {
        type: String,
        required: [true, 'Message content cannot be empty'],
        trim: true,
        maxlength: [500, 'Message cannot exceed 500 characters']
    },
    readBy: [{ // For read receipts (optional)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
},{
    timestamps: true
}
)
// Add a custom validation to ensure a message is either group OR private, not both or neither
MessageSchema.pre('validate', function(next) {
    if ((this.group && this.recipient) || (!this.group && !this.recipient)) {
        next(new Error('A message must either belong to a group or be a private message to a recipient, but not both or neither.'));
    } else {
        next();
    }
});

module.exports = mongoose.model('Message', MessageSchema);
