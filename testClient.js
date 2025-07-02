
const io = require('socket.io-client');
const axios = require('axios'); // To get a JWT token first

const backendUrl = 'http://localhost:3001'; // Your backend URL

const testUser = {
    email: 'testjest@example.com', // Use an existing user's credentials
    password: 'password123'
};

let socket;

async function testChat() {
    try {
        // 1. Login to get a JWT token
        console.log('Logging in to get JWT token...');
        const loginRes = await axios.post(`${backendUrl}/api/auth/login`, testUser);
        const token = loginRes.data.token;
        console.log('Logged in. Token:', token.substring(0, 15) + '...'); // Show partial token

        // 2. Connect Socket.io with the token
        socket = io(backendUrl, {
            auth: {
                token: token
            }
        });

        socket.on('connect', () => {
            console.log('Socket.io connected:', socket.id);

            // 3. Try to join a group (replace with a real Group ID from your DB)
            //    First, get a group ID using Postman: GET http://localhost:3001/api/groups
            const groupIdToJoin = '6865007a8f90074bc67af6f3'; // <--- IMPORTANT: Replace this!

            if (groupIdToJoin === 'PASTE_YOUR_GROUP_ID_HERE') {
                console.error('\n*** IMPORTANT: Please replace "PASTE_YOUR_GROUP_ID_HERE" in testClient.js with a real Group ID from your database. ***\n');
                socket.disconnect();
                return;
            }

            socket.emit('joinGroup', groupIdToJoin);
        });

        socket.on('connect_error', (err) => {
            console.error('Socket.io Connection Error:', err.message);
        });

        socket.on('joinedGroup', (data) => {
            console.log(`Successfully joined group: ${data.groupName}`);
            // 4. Send a message to the group after joining
            setTimeout(() => { // Give a small delay to ensure join is processed
                const messageContent = `Hello from Node.js client! Current time: ${new Date().toLocaleTimeString()}`;
                console.log(`Sending message: "${messageContent}" to group ${data.groupName}`);
                socket.emit('sendGroupMessage', { groupId: data.groupId, content: messageContent });
            }, 1000);
        });

        socket.on('chatHistory', (data) => {
            console.log(`Chat history for group ${data.groupId}:`);
            if (data.messages.length > 0) {
                data.messages.forEach(msg => {
                    console.log(`  [${new Date(msg.createdAt).toLocaleTimeString()}] ${msg.sender.username}: ${msg.content}`);
                });
            } else {
                console.log('  No history yet.');
            }
        });

        socket.on('groupMessage', (message) => {
            console.log(`\nNew Group Message from ${message.sender.username} in group ${message.group}: "${message.content}"`);
        });

        socket.on('typing', (data) => {
            console.log(`${data.username} is typing...`);
        });

        socket.on('stopTyping', (data) => {
            console.log(`${data.username} stopped typing.`);
        });

        socket.on('groupError', (msg) => {
            console.error('Group Error:', msg);
        });

        socket.on('chatError', (msg) => {
            console.error('Chat Error:', msg);
        });

        socket.on('disconnect', () => {
            console.log('Socket.io disconnected.');
        });

    } catch (error) {
        console.error('Error during chat test:', error.message);
        if (error.response) {
            console.error('Login Error Response:', error.response.data);
        }
    }
}

testChat();

// To keep the client running and listen for messages, you might need to
// remove the process.exit() or setTimeout to disconnect.
// For a simple test, we can just let it run for a bit.
setTimeout(() => {
    if (socket) {
        console.log('Disconnecting client after 10 seconds...');
        socket.disconnect();
    }
}, 10000); // Disconnect after 10 seconds