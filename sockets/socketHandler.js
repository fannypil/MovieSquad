const jwt = require('jsonwebtoken');
const User = require('../models/User'); 
const Message = require('../models/Message'); 
const Group = require('../models/Group'); 

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
        // Join user to their own room
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
                 // Optional: Check if user is actually a member of the group
                // If the group is private, ensure the user is a member or admin
                // if (group.isPrivate && !group.members.includes(socket.user.id.toString()) && group.admin.toString() !== socket.user.id.toString()) {
                //     socket.emit('groupError', 'You are not a member of this private group');
                //     return;
                // }
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
                 // Check if the user is in the group's room (optional, but good for security)
                // You might also want to check if the user is still a member of the group here again.
                // if (!socket.rooms.has(groupId)) {
                //     return socket.emit('chatError', 'You are not in this group chat.');
                // }
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

        // 3. Handle Disconnect
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.username} (${socket.user.id}) - Socket ID: ${socket.id}`);
        });

        // You can add more events here, e.g., 'typing', 'readMessage', etc.
        socket.on('typing', ({ groupId }) => {
            // Broadcast to all other users in the room that this user is typing
            socket.to(groupId).emit('typing', { userId: socket.user.id, username: socket.user.username });
        });

        socket.on('stopTyping', ({ groupId }) => {
            socket.to(groupId).emit('stopTyping', { userId: socket.user.id, username: socket.user.username });
        });

    });
};
