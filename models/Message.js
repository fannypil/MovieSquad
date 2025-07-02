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
        required: false 
    },
     // recipient: { // Optional: For private messages if not using group chat model
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'User',
    //     required: false
    // },
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
module.exports = mongoose.model('Message', MessageSchema);
