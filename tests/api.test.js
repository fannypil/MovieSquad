const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app"); // Your Express app
const User = require("../models/User");
const Notification = require("../models/Notification");

// Test data
let userToken1, userToken2;
let user1Id, user2Id;

describe("Movie Squad API Tests", () => {
  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Clean database once before all tests
    await User.deleteMany({});
  });

  afterAll(async () => {
    // Clean up and close connection
    await User.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
  describe("🔐 Authentication", () => {
    test("Should register user 1", async () => {
      const res = await request(app).post("/api/auth/register").send({
        username: "testuser1",
        email: "test1@example.com",
        password: "password123",
      });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      userToken1 = res.body.token;
      user1Id = res.body.user._id;
      console.log("User 1 registered with ID:", user1Id);
    });

    test("Should register user 2", async () => {
      const res = await request(app).post("/api/auth/register").send({
        username: "testuser2",
        email: "test2@example.com",
        password: "password123",
      });

      expect(res.status).toBe(201);
      userToken2 = res.body.token;
      user2Id = res.body.user._id;
      console.log("User 2 registered with ID:", user2Id);
    });

    test("Should login user 1", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "test1@example.com",
        password: "password123",
      });

      console.log("Login response:", res.status, res.body);
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });
  });

  describe("👤 User Profile Management", () => {
    test("Should get my profile", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("x-auth-token", userToken1);

      if (res.status !== 200) {
        console.log("Profile error:", res.status, res.body);
      }
      expect(res.status).toBe(200);
      expect(res.body.username).toBe("testuser1");
      expect(res.body.password).toBeUndefined();
    });

    test("Should update profile", async () => {
      const res = await request(app)
        .put("/api/user/me")
        .set("x-auth-token", userToken1)
        .send({
          bio: "Movie enthusiast and film critic",
          profilePicture: "new-avatar.jpg",
        });

      expect(res.status).toBe(200);
      expect(res.body.bio).toBe("Movie enthusiast and film critic");
    });

    test("Should update profile settings", async () => {
      const res = await request(app)
        .put("/api/user/me/settings")
        .set("x-auth-token", userToken1)
        .send({
          isPublic: false,
          showWatchedContent: true,
          showFavorites: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.isPublic).toBe(false);
      expect(res.body.showFavorites).toBe(false);
    });
  });

  describe("👥 Friends Management", () => {
    test("Should search for users", async () => {
      const res = await request(app)
        .get("/api/user/search?q=testuser2")
        .set("x-auth-token", userToken1);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].username).toBe("testuser2");
    });

    test("Should send friend request", async () => {
      const res = await request(app)
        .post("/api/user/friends/request")
        .set("x-auth-token", userToken1)
        .send({
          recipientId: user2Id,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Friend request sent successfully");
    });

    test("Should get pending friend requests", async () => {
      const res = await request(app)
        .get("/api/user/me/friend-requests")
        .set("x-auth-token", userToken2);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0]._id).toBe(user1Id);
    });

    test("Should accept friend request", async () => {
      const res = await request(app)
        .put("/api/user/friends/accept")
        .set("x-auth-token", userToken2)
        .send({
          senderId: user1Id,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Friend request accepted successfully");
    });

    test("Should get friends list", async () => {
      const res = await request(app)
        .get("/api/user/me/friends")
        .set("x-auth-token", userToken1);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0]._id).toBe(user2Id);
    });
  });

  describe("🎬 Content Management", () => {
    test("Should add watched content", async () => {
      const res = await request(app)
        .put("/api/user/me/watched")
        .set("x-auth-token", userToken1)
        .send({
          tmdbId: 27205,
          tmdbType: "movie",
        });

      expect(res.status).toBe(200);
      expect(res.body[0].tmdbId).toBe(27205);
    });

    test("Should add favorite movie", async () => {
      const res = await request(app)
        .put("/api/user/me/favorite-movies")
        .set("x-auth-token", userToken1)
        .send({
          tmdbId: 27205,
          title: "Inception",
        });

      expect(res.status).toBe(200);
      expect(res.body[0].title).toBe("Inception");
    });
  });

  describe("📱 Activity Feed", () => {
    test("Should get my posts activity", async () => {
      const res = await request(app)
        .get("/api/activity/me")
        .set("x-auth-token", userToken1);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("Should get friends posts feed", async () => {
      const res = await request(app)
        .get("/api/activity/feed")
        .set("x-auth-token", userToken1);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("Should get user activity", async () => {
      const res = await request(app)
        .get(`/api/activity/user/${user2Id}`)
        .set("x-auth-token", userToken1);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("Should get activity stats", async () => {
      const res = await request(app)
        .get("/api/activity/stats")
        .set("x-auth-token", userToken1);

      expect(res.status).toBe(200);
      expect(res.body.totalPosts).toBeDefined();
    });
  });

  describe("🚫 Error Handling", () => {
    test("Should require authentication", async () => {
      const res = await request(app).get("/api/user/me");

      expect(res.status).toBe(401);
    });

    test("Should handle invalid user ID", async () => {
      const res = await request(app)
        .get("/api/activity/user/invalid-id")
        .set("x-auth-token", userToken1);

      expect(res.status).toBe(500);
    });
  });
});
