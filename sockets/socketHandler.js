const jwt = require('jsonwebtoken');
const User = require('../models/User'); 
const Message = require('../models/Message'); 
const Group = require('../models/Group'); 
const { createNotification } = require('../utils/notificationService');

// Helper function to generate a consistent chat identifier for 1-on-1 chats
// Ensures 'userA_userB' is the same as 'userB_userA'
const getPrivateChatIdentifier = (userId1, userId2) => {
    return [userId1, userId2].sort().join('_');
};

// This function will be called from app.js, receiving the 'io' instance
module.exports = (io) => {
    io.use(async(socket, next)=>{
        const token=socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }
        try{
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Get user without password
            const user = await User.findById(decoded.user.id).select('-password');
            if(!user) {
                return next(new Error('Authentication error: User not found'));
            }
            socket.user = user; // Attach user to socket
            next();
        }catch(err){
            console.error('Socket.io Auth Error:', err.message);
            return next(new Error('Authentication error: Invalid token'));
        }
    })
    // main connection logic
    io.on('connection',(socket)=>{
        console.log(`User connected: ${socket.user.username} (${socket.user.id}) - Socket ID: ${socket.id}`);
        //join the user to their own private room for direct messages
        socket.join(socket.user.id.toString());
        console.log(`${socket.user.username} joined their personal room: ${socket.user.id}`);
        // Group Chat Events
        socket.on('joinGroup', async(groupId)=>{
            if(!groupId) {
                console.warn('Attempted to join group with no groupId provided.');
                return;
            }
            try{
                const group = await Group.findById(groupId);
                if(!group) {
                    console.warn(`Group not found: ${groupId}`);
                    return socket.emit('groupError', 'Group not found');
                }
                 // Optional but Recommended: Check if user is actually a member of the group
                if (!group.members.includes(socket.user.id.toString()) && group.admin.toString() !== socket.user.id.toString() && socket.user.role !== 'admin') {
                    socket.emit('groupError', 'You are not a member of this group or do not have access.');
                    return;
                }
                socket.join(groupId);
                console.log(`${socket.user.username} joined group: ${group.name} (${groupId})`);
                // Emit a success message back to the client that joined
                socket.emit('joinedGroup', { groupId: group._id, groupName: group.name, msg: `You have joined "${group.name}" chat.` });
                // Optionally, fetch and emit chat history for this group
                const chatHistory = await Message.find({group: groupId})
                    .populate('sender', 'username email')
                    .sort({ createdAt: 1 }) // Oldest first
                    .limit(50) // Limit to last 50 messages
                socket.emit('chatHistory',{ groupId, messages: chatHistory })
            }catch(error){
                 console.error(`Error joining group ${groupId}:`, error.message);
                    socket.emit('groupError', `Failed to join group ${groupId}`);
            }
        });
        // send message to group
        socket.on('sendGroupMessage', async({ groupId, content })=>{
            if(!groupId || !content) {
                return socket.emit('chatError', 'Group ID and message content are required.');
            }
            try{
                 // Re-check membership for security before sending
                const group = await Group.findById(groupId);
                if (!group || (!group.members.includes(socket.user.id.toString()) && group.admin.toString() !== socket.user.id.toString() && socket.user.role !== 'admin')) {
                    return socket.emit('chatError', 'You are not authorized to send messages to this group.');
                }
                const newMessage = new Message({
                    sender: socket.user._id,
                    group: groupId,
                    content:content
                });
                const savedMessage = await newMessage.save();
                // Populate sender details for the broadcast
                await savedMessage.populate('sender', 'username email');
                // Broadcast the message to all clients in that specific group room
                io.to(groupId).emit('groupMessage', savedMessage);
                console.log(`Message sent to  group ${groupId} by ${socket.user.username}: ${content}`);
            }catch(error){
                console.error(`Error sending message to group ${groupId}:`, error.message);
                socket.emit('chatError', 'Failed to send message.');
             }
        });
        // Private Messaging Events:

        // Event to join a private chat room between two specific users
        socket.on('joinPrivateChat', async (otherUserId) => {
            const currentUserId = socket.user.id;
            if (!otherUserId || currentUserId === otherUserId) {
                return socket.emit('privateChatError', 'Invalid recipient for private chat.');
            }

            try {
                // Optional: Check if users are friends or allowed to chat privately
                const currentUser = await User.findById(currentUserId);
                const otherUser = await User.findById(otherUserId);

                if (!currentUser || !otherUser) {
                    return socket.emit('privateChatError', 'One or both users not found.');
                }

                // Example: Only allow if they are friends
                if (!currentUser.friends.includes(otherUserId) && socket.user.role !== 'admin') {
                     return socket.emit('privateChatError', 'You can only chat privately with friends.');
                }

                const chatIdentifier = getPrivateChatIdentifier(currentUserId, otherUserId);
                socket.join(chatIdentifier); // Join the unique room for this 1-on-1 chat
                console.log(`${socket.user.username} joined private chat with ${otherUser.username} in room: ${chatIdentifier}`);

                socket.emit('joinedPrivateChat', {
                    chatIdentifier,
                    otherUser: { _id: otherUser._id, username: otherUser.username },
                    msg: `You have joined private chat with ${otherUser.username}.`
                });

                // Fetch and emit private chat history
                const privateChatHistory = await Message.find({ chatIdentifier })
                    .populate('sender', 'username email')
                    .populate('recipient', 'username email') // Populate recipient too
                    .sort({ createdAt: 1 })
                    .limit(50);
                socket.emit('privateChatHistory', { chatIdentifier, messages: privateChatHistory });

            } catch (error) {
                console.error(`Error joining private chat with ${otherUserId}:`, error.message);
                socket.emit('privateChatError', 'Failed to join private chat.');
            }
        });

        // Event to send a private message
        socket.on('sendPrivateMessage', async ({ recipientId, content }) => {
            const senderId = socket.user.id;
            if (!recipientId || !content) {
                return socket.emit('privateChatError', 'Recipient ID and message content are required.');
            }
            if (senderId === recipientId) {
                return socket.emit('privateChatError', 'Cannot send private message to yourself.');
            }

            try {
                // Optional: Re-check if users are friends before sending the message
                const senderUser = await User.findById(senderId);
                if (!senderUser.friends.includes(recipientId) && socket.user.role !== 'admin') {
                    return socket.emit('privateChatError', 'You can only send private messages to friends.');
                }

                const chatIdentifier = getPrivateChatIdentifier(senderId, recipientId);

                const newMessage = new Message({
                    sender: senderId,
                    recipient: recipientId,
                    chatIdentifier: chatIdentifier,
                    content: content
                });
                const savedMessage = await newMessage.save();

                // Populate sender and recipient details for broadcast
                await savedMessage.populate('sender', 'username email');
                await savedMessage.populate('recipient', 'username email');

                // Emit to both sender and recipient in their common chat room
                io.to(chatIdentifier).emit('privateMessage', savedMessage);
                console.log(`Private message sent from ${socket.user.username} to ${recipientId}: ${content}`);
                
                 // Only create if the recipient is NOT the sender and is NOT currently in the specific chat room
            const recipientSocket = io.sockets.sockets.get(recipientId.toString()); // Get recipient's personal socket
            const isInChatRoom = recipientSocket && recipientSocket.rooms.has(chatIdentifier);

            if (socket.user._id.toString() !== recipientId && !isInChatRoom) {
                await createNotification(
                    recipientId,
                    'new_private_message',
                    {
                        senderId: socket.user._id,
                        entityId: savedMessage._id,
                        entityType: 'Message',
                        message: `${socket.user.username} sent you a new message.`
                    }
                );
            }
                // Additionally, if the recipient is online and not in the chat room,
                // you might want to send a notification to their personal room (socket.user.id.toString())
                // Example: io.to(recipientId).emit('newPrivateMessageNotification', { from: savedMessage.sender, content: savedMessage.content });

            } catch (error) {
                console.error(`Error sending private message to ${recipientId}:`, error.message);
                socket.emit('privateChatError', 'Failed to send private message.');
            }
        });
        //  Common Events:
        socket.on('typing', ({ groupId, recipientId }) => {
            if (groupId) {
                socket.to(groupId).emit('userTyping', { 
                    userId: socket.user.id, 
                    username: socket.user.username, 
                    groupId 
                });
            } else if (recipientId) {
                const chatIdentifier = getPrivateChatIdentifier(socket.user.id, recipientId);
                socket.to(chatIdentifier).emit('userTyping', { 
                    userId: socket.user.id, 
                    username: socket.user.username, 
                    chatIdentifier 
                });
                console.log(`⌨️ ${socket.user.username} is typing to ${recipientId} in ${chatIdentifier}`);
            }
        });

        socket.on('stopTyping', ({ groupId, recipientId }) => {
            if (groupId) {
                socket.to(groupId).emit('userStoppedTyping', { 
                    userId: socket.user.id, 
                    username: socket.user.username, 
                    groupId 
                });
            } else if (recipientId) {
                const chatIdentifier = getPrivateChatIdentifier(socket.user.id, recipientId);
                socket.to(chatIdentifier).emit('userStoppedTyping', { 
                    userId: socket.user.id, 
                    username: socket.user.username, 
                    chatIdentifier 
                });
                console.log(`⌨️ ${socket.user.username} stopped typing to ${recipientId} in ${chatIdentifier}`);
            }
        });
        // Handle message read confirmation
        socket.on('messageRead', async (data) => {
            try {
                const { messageId, chatIdentifier } = data;
                
                // Update message as read in database
                await Message.findByIdAndUpdate(messageId, { 
                    $addToSet: { readBy: socket.user.id }
                });
                
                // Notify sender that message was read
                socket.to(chatIdentifier).emit('messageReadStatus', {
                    messageId,
                    status: 'read',
                    readAt: new Date(),
                    readBy: socket.user.username
                });
                
                console.log(`👁️ Message ${messageId} read by ${socket.user.username}`);
            } catch (error) {
                console.error('❌ Error handling message read:', error);
            }
        });
        // Handle Disconnect
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.username} (${socket.user.id}) - Socket ID: ${socket.id}`);
        });
    });
};