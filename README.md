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
- **Notifications** — Real-time and persistent notifications
- **Role-Based Access Control** — User, groupAdmin, and admin permissions
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
- **HTTP Requests:** axios


## 📦 Installation 

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB installation
- TMDB API key (optional, for movie data)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/fannypil/MovieSquad.git
   cd MovieSquadBackend
   ```

2. **Install dependencies**
   ```bash
   npm install express mongoose cors bcryptjs jsonwebtoken socket.io dotenv express-validator axios
   ```

3. **Install development dependencies (for testing)**
   ```bash
   npm install --save-dev nodemon cross-env jest supertest
   ```

4. **Environment Configuration**
   
   Create a `.env` file in the root directory:
   ```env
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   JWT_SECRET=your_jwt_secret_here
   JWT_EXPIRE=1
   PORT=5000
   TMDB_API_KEY=your_tmdb_api_key_here
   CLIENT_URL=http://localhost:3000
   ```

5. **Generate a secure JWT_SECRET**
   
   Run this command in your terminal to generate a strong JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'));"
   ```
   Copy the output and paste it as your `JWT_SECRET` value in the `.env` file.

6. **Start the server**
   ```bash
   node app.js 
   ```

## 🏗️ Project Structure

```
MovieSquadBackend/
├── config/
│   ├── db.js                 # MongoDB connection configuration
│   └── avatars.js
├── controllers/
│   ├── authController.js     # Authentication logic
│   ├── userController.js
│   ├── groupController.js
│   ├── postController.js
│   ├── activityController.js
│   ├── avatarController.js
│   ├── conversationController.js
│   ├── notificationController.js
│   ├── statsController.js
│   └── tmdbController.js
├── middleware/
│   ├── authMiddleware.js     # JWT authentication middleware
│   └── authorizeRoles.js
├── models/
│   ├── User.js              # User schema and model
│   ├── Group.js             # Group schema and model
│   ├── Post.js              # Post schema and model
│   ├── Notification.js      
│   └── Message.js
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── user.js
│   ├── group.js
│   ├── post.js
│   ├── stats.js
│   ├── activity.js
│   ├── admin.js
│   ├── avatar.js
│   ├── conversation.js
│   ├── notification.js
│   └──tmdb.js
├── sockets/
│   └── socketHandler.js
├── utils/
│   └── notificationService.js
├── tests/
│   ├── api.test.js
│   ├── notifications.test.js
│   ├── post-search.test.js
│   └── setup.js
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
- `GET /api/user/me` — Get current user profile
- `PUT /api/user/me` — Update profile
- `PUT /api/user/me/settings` — Update privacy settings
- `PUT /api/user/me/watched` — Add watched content
- `PUT /api/user/me/favorite-movies` — Add favorite movie
- `PUT /api/user/me/genres` — Add favorite genre
- `GET /api/user/me/friends` — Get friends list
- `POST /api/user/friends/request` — Send friend request
### Groups

- `POST /api/groups` — Create group
- `GET /api/groups` — List groups
- `PUT /api/groups/:id/join` — Join public group
- `POST /api/groups/:id/request-join` — Request to join private group
- `POST /api/groups/:id/invite` — Invite user to group

### Posts

- `POST /api/posts` — Create post
- `GET /api/posts` — List posts
- `PUT /api/posts/:id/like` — Like/unlike post
- `POST /api/posts/:id/comments` — Add comment

### Stats

- `GET /api/stats/summary` — Get platform statistics

### Notifications

- `GET /api/notifications/me` — Get notifications
- `PUT /api/notifications/:id/read` — Mark notification as read

---

## 🔒 Authentication

All protected routes require a JWT token in the `x-auth-token` header:

```
x-auth-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---
**Token Format:**
```
x-auth-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🗄️ Database Models

### User Model
- Username, email, password (hashed)
- Role management (user, groupAdmin, admin)
- Watched content, favorite movies, favorite genres
- Groups, friends, friend requests

### Group Model
- Name, description, privacy
- Admin, members, pending requests

### Post Model
- Content, TMDB info, categories, likes, comments


## 🧪 Testing

Run all tests with:

```bash
npm test
```

---

## 🧑‍💻 Development Tips

- Use [Postman](https://www.postman.com/) or [Insomnia](https://insomnia.rest/) to test API endpoints.
- For real-time features, use [Socket.io Client](https://socket.io/docs/v4/client-api/) in your frontend.
- For production, build your frontend and serve `index.html` for all non-API routes.

---

**Happy coding! 🍿🎬**