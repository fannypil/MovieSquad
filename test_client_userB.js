
const io = require('socket.io-client');
const axios = require('axios'); // To get a JWT token first

const backendUrl = 'http://localhost:3001'; // Your backend URL

// --- IMPORTANT: CONFIGURE THESE FOR USER B ---
const userA_Credentials = { // These are now User B's credentials
    email: 'testjest@example.com', // e.g., 'userB@example.com'
    password: 'password123' // e.g., 'password123'
};
const userB_Id = '6863f27bfb66a11a4746f569'; // <--- IMPORTANT: Get User A's actual MongoDB _id
// ---------------------------------------------

let socket;

// Helper to generate consistent chat identifier (must match server)
function getPrivateChatIdentifier(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
}

async function startClient(clientName, userCredentials, otherUserIdForPrivateChat = null, groupIdForGroupChat = null) {
    try {
        console.log(`--- ${clientName}: Logging in to get JWT token...`);
        const loginRes = await axios.post(`${backendUrl}/api/auth/login`, userCredentials);
        const token = loginRes.data.token;
        const loggedInUser = loginRes.data.user; // Assuming your login returns user data
        console.log(`${clientName}: Logged in as ${loggedInUser.username} (${loggedInUser._id}). Token: ${token.substring(0, 15)}...`);

        socket = io(backendUrl, {
            auth: {
                token: token
            }
        });

        socket.on('connect', () => {
            console.log(`--- ${clientName}: Socket.io connected: ${socket.id} for user ${loggedInUser.username}`);

            // --- Group Chat Test (Optional, if groupIdForGroupChat is provided) ---
            if (groupIdForGroupChat && groupIdForGroupChat !== 'PASTE_YOUR_GROUP_ID_HERE') {
                console.log(`${clientName}: Attempting to join group: ${groupIdForGroupChat}`);
                socket.emit('joinGroup', groupIdForGroupChat);
            } else if (groupIdForGroupChat === 'PASTE_YOUR_GROUP_ID_HERE') {
                 console.warn(`\n*** ${clientName}: Group ID placeholder not replaced. Skipping group chat test. ***\n`);
            }

            // --- Private Chat Test (Optional, if otherUserIdForPrivateChat is provided) ---
            if (otherUserIdForPrivateChat && otherUserIdForPrivateChat !== 'USER_B_MONGO_ID_HERE') {
                console.log(`${clientName}: Attempting to join private chat with user ID: ${otherUserIdForPrivateChat}`);
                socket.emit('joinPrivateChat', otherUserIdForPrivateChat);
            } else if (otherUserIdForPrivateChat === 'USER_B_MONGO_ID_HERE') {
                 console.warn(`\n*** ${clientName}: User B ID placeholder not replaced. Skipping private chat test. ***\n`);
            }
        });

        socket.on('connect_error', (err) => {
            console.error(`--- ${clientName}: Socket.io Connection Error:`, err.message);
        });

        // --- Group Chat Listeners ---
        socket.on('joinedGroup', (data) => {
            console.log(`--- ${clientName}: Successfully joined group: ${data.groupName}`);
            setTimeout(() => {
                const messageContent = `Hello from ${clientName} in group ${data.groupName}! Time: ${new Date().toLocaleTimeString()}`;
                console.log(`${clientName}: Sending group message: "${messageContent}"`);
                socket.emit('sendGroupMessage', { groupId: data.groupId, content: messageContent });
                socket.emit('typing', { groupId: data.groupId });
                setTimeout(() => socket.emit('stopTyping', { groupId: data.groupId }), 2000);
            }, 1000);
        });

        socket.on('chatHistory', (data) => {
            console.log(`--- ${clientName}: Chat history for group ${data.groupId}:`);
            if (data.messages.length > 0) {
                data.messages.forEach(msg => {
                    console.log(`  [${new Date(msg.createdAt).toLocaleTimeString()}] ${msg.sender.username}: ${msg.content}`);
                });
            } else {
                console.log('  No group history yet.');
            }
        });

        socket.on('groupMessage', (message) => {
            if (message.sender._id !== loggedInUser._id) { // Avoid logging own sent message twice
                console.log(`--- ${clientName}: New Group Message from ${message.sender.username} in group ${message.group}: "${message.content}"`);
            }
        });

        socket.on('groupError', (msg) => {
            console.error(`--- ${clientName}: Group Error:`, msg);
        });

        // --- Private Chat Listeners ---
        socket.on('joinedPrivateChat', (data) => {
            console.log(`--- ${clientName}: Successfully joined private chat with ${data.otherUser.username} (${data.otherUser._id})`);
            // Send a message after joining
            setTimeout(() => {
                const messageContent = `Hi ${data.otherUser.username}, from ${clientName}! Direct message. Time: ${new Date().toLocaleTimeString()}`;
                console.log(`${clientName}: Sending private message: "${messageContent}" to ${data.otherUser.username}`);
                socket.emit('sendPrivateMessage', { recipientId: data.otherUser._id, content: messageContent });
                socket.emit('typing', { recipientId: data.otherUser._id });
                setTimeout(() => socket.emit('stopTyping', { recipientId: data.otherUser._id }), 2000);
            }, 2000); // Small delay
        });

        socket.on('privateChatHistory', (data) => {
            console.log(`--- ${clientName}: Private chat history with ${data.chatIdentifier}:`);
            if (data.messages.length > 0) {
                data.messages.forEach(msg => {
                    console.log(`  [${new Date(msg.createdAt).toLocaleTimeString()}] ${msg.sender.username} -> ${msg.recipient.username}: ${msg.content}`);
                });
            } else {
                console.log('  No private history yet.');
            }
        });

        socket.on('privateMessage', (message) => {
             // Only log if the message is from the other user in this specific private chat
            const currentChatIdentifier = getPrivateChatIdentifier(loggedInUser._id, message.recipient._id.toString() === loggedInUser._id.toString() ? message.sender._id.toString() : message.recipient._id.toString());
            if (message.chatIdentifier === currentChatIdentifier && message.sender._id !== loggedInUser._id) {
                console.log(`--- ${clientName}: New Private Message from ${message.sender.username}: "${message.content}"`);
            }
        });

        socket.on('privateChatError', (msg) => {
            console.error(`--- ${clientName}: Private Chat Error:`, msg);
        });

        // --- Common Listeners ---
        socket.on('typing', (data) => {
            if (data.userId !== loggedInUser._id) { // Only log if it's not our own typing
                const chatType = data.groupId ? `group ${data.groupId}` : `private chat ${data.chatIdentifier}`;
                console.log(`--- ${clientName}: ${data.username} is typing in ${chatType}...`);
            }
        });

        socket.on('stopTyping', (data) => {
            if (data.userId !== loggedInUser._id) {
                const chatType = data.groupId ? `group ${data.groupId}` : `private chat ${data.chatIdentifier}`;
                console.log(`--- ${clientName}: ${data.username} stopped typing in ${chatType}.`);
            }
        });

        socket.on('chatError', (msg) => {
            console.error(`--- ${clientName}: General Chat Error:`, msg);
        });

        socket.on('disconnect', () => {
            console.log(`--- ${clientName}: Socket.io disconnected.`);
        });

    } catch (error) {
        console.error(`--- ${clientName}: Error during chat test:`, error.message);
        if (error.response) {
            console.error(`--- ${clientName}: Login Error Response:`, error.response.data);
        }
    }
}

// --- Start Client B ---
console.log('Starting Client B...');
// Note: The arguments are (clientName, userCredentials, otherUserIdForPrivateChat, groupIdForGroupChat)
// For Client B, 'otherUserIdForPrivateChat' is User A's ID
// You can pass null for groupIdForGroupChat if you only want to test private chat
startClient('Client B', userA_Credentials, userB_Id, null); // Pass null if Client B isn't joining the group

// Disconnect client after a set duration
setTimeout(() => {
    if (socket) {
        console.log('Disconnecting Client B after 20 seconds...');
        socket.disconnect();
    }
}, 20000); // Keep client B running for 20 seconds