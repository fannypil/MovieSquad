const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

// Import db connection function
const connectDB = require('./config/db'); 

// Import Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const groupRoutes = require('./routes/group'); 
const postRoutes = require('./routes/post'); 
const tmdbRoutes = require('./routes/tmdb');
const adminRoutes = require('./routes/admin');

const socketHandler = require('./sockets/socketHandler');

// load environment variables
dotenv.config();

// create an express app
const app = express();
const server= http.createServer(app);
// effie:
// const io= new Server (server,{
//     cors:{origin:"*"}
// })

// Gemini:
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000", // Adjust this to your frontend URL
       methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Middleware
app.use(express.json());
app.use(cors());
// gemini , effie didnt show:
// app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// connect to MongoDB
connectDB();

// Define Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/tmdb', tmdbRoutes);
app.use('/api/admin', adminRoutes);

// define a simple route for testing
app.get('/',(req, res)=>{
    res.send('Welcome to the Movie Squad Backend!');
});

socketHandler(io)

// start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, ()=> console.log(`Server is running on port ${PORT}`));

