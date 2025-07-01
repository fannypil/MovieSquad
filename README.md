# MovieSquad Backend

A comprehensive Node.js backend application for a movie social platform where users can share, discuss, and discover movies with friends and groups.

## 🎬 About MovieSquad

MovieSquad is a social platform designed for movie enthusiasts to connect, share recommendations, and discuss their favorite films with friends and communities.

## 🚀 Features

- **User Authentication** - Secure registration and login with JWT tokens
- **User Profiles** - Manage personal movie preferences and social connections
- **Group Management** - Create and join movie discussion groups
- **Social Posts** - Share movie reviews, recommendations, and discussions
- **Real-time Chat** - Socket.io powered real-time messaging
- **Movie Integration** - TMDB API integration for movie data
- **Secure API** - Protected routes with middleware authentication

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Real-time Communication**: Socket.io
- **Validation**: express-validator
- **Environment Management**: dotenv
- **CORS**: cors middleware

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB installation
- TMDB API key (optional, for movie data)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd MovieSquadBackend
   ```

2. **Install dependencies**
   ```bash
   npm install express mongoose cors bcryptjs jsonwebtoken socket.io dotenv express-validator
   ```

3. **Environment Configuration**
   
   Create a `.env` file in the root directory:
   ```env
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   JWT_SECRET=your_jwt_secret_here
   PORT=5000
   TMDB_API_KEY=your_tmdb_api_key_here
   CLIENT_URL=http://localhost:3000
   ```

4. **Generate a secure JWT_SECRET**
   
   Run this command in your terminal to generate a strong JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'));"
   ```
   Copy the output and paste it as your `JWT_SECRET` value in the `.env` file.

5. **Start the server**
   ```bash
   node app.js 
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

## 🏗️ Project Structure

```
MovieSquadBackend/
├── config/
│   └── db.js                 # MongoDB connection configuration
├── controllers/
│   └── authController.js     # Authentication logic
├── middleware/
│   └── authMiddleware.js     # JWT authentication middleware
├── models/
│   ├── User.js              # User schema and model
│   ├── Group.js             # Group schema and model
│   └── Post.js              # Post schema and model
├── routes/
│   ├── auth.js              # Authentication routes
│   └── user.js              # User profile routes
├── .env                     # Environment variables (not in repo)
├── .gitignore              # Git ignore file
├── app.js                  # Main application file
└── package.json            # Project dependencies
```

## 📡 API Endpoints

### Authentication Routes
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user and get JWT token

### User Routes (Protected)
- `GET /api/user/me` - Get current user profile


## 🔒 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the `x-auth-token` header for protected routes.

**Token Format:**
```
x-auth-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🗄️ Database Models

### User Model
- Username, email, password (hashed)
- Role management (user, groupAdmin, admin)
- Movie tracking (watched, favorites)
- Social connections (groups, friends)

### Group Model
- Group information and privacy settings
- Member management with admin controls
- Pending member requests

### Post Model
- Content creation with TMDB integration
- Categorization and tagging
- Like and comment system

## 🔧 Development

### Testing with Postman

1. **Start the server**
2. **Register a user** via `POST /api/auth/register`
3. **Login** via `POST /api/auth/login` to get your JWT token
4. **Test protected routes** by including the token in `x-auth-token` header

---

**Happy coding! 🍿🎬**