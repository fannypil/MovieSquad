const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Post = require("../models/Post");
const Group = require("../models/Group");

// Test data
let userToken1, userToken2, userToken3;
let user1Id, user2Id, user3Id;
let groupId;
let postIds = [];

describe("🔍 Post Search API Tests", () => {
  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Clean database
    await User.deleteMany({});
    await Post.deleteMany({});
    await Group.deleteMany({});

    // Create test users
    await createTestUsers();

    // Create test group
    await createTestGroup();

    // Create test posts
    await createTestPosts();
  });

  afterAll(async () => {
    // Clean up and close connection
    await User.deleteMany({});
    await Post.deleteMany({});
    await Group.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  // Helper function to create test users
  async function createTestUsers() {
    // User 1: moviecritic
    const user1Res = await request(app).post("/api/auth/register").send({
      username: "moviecritic",
      email: "critic@test.com",
      password: "password123",
    });
    userToken1 = user1Res.body.token;
    user1Id = user1Res.body.user._id;

    // User 2: horrorFan
    const user2Res = await request(app).post("/api/auth/register").send({
      username: "horrorFan",
      email: "horror@test.com",
      password: "password123",
    });
    userToken2 = user2Res.body.token;
    user2Id = user2Res.body.user._id;

    // User 3: actionLover
    const user3Res = await request(app).post("/api/auth/register").send({
      username: "actionLover",
      email: "action@test.com",
      password: "password123",
    });
    userToken3 = user3Res.body.token;
    user3Id = user3Res.body.user._id;
  }

  // Helper function to create test group
  async function createTestGroup() {
    const groupRes = await request(app)
      .post("/api/groups")
      .set("x-auth-token", userToken1)
      .send({
        name: "Movie Critics Club",
        description: "For serious movie discussions",
      });
    groupId = groupRes.body._id;

    // User 2 joins the group
    await request(app)
      .put(`/api/groups/${groupId}/join`)
      .set("x-auth-token", userToken2);
  }

  // Helper function to create test posts
  async function createTestPosts() {
    const testPosts = [
      {
        content:
          "Inception is a mind-bending masterpiece that explores dreams within dreams",
        tmdbId: 27205,
        tmdbType: "movie",
        tmdbTitle: "Inception",
        categories: ["review"],
        token: userToken1,
      },
      {
        content: "The Dark Knight changed superhero movies forever",
        tmdbId: 155,
        tmdbType: "movie",
        tmdbTitle: "The Dark Knight",
        categories: ["review"],
        token: userToken1,
      },
      {
        content: "Hereditary is the scariest horror movie I have ever seen!",
        tmdbId: 493922,
        tmdbType: "movie",
        tmdbTitle: "Hereditary",
        categories: ["review"],
        token: userToken2,
      },
      {
        content: "Breaking Bad is the greatest TV series of all time",
        tmdbId: 1396,
        tmdbType: "tv",
        tmdbTitle: "Breaking Bad",
        categories: ["recommendation"],
        token: userToken2,
      },
      {
        content: "John Wick action sequences are absolutely incredible",
        tmdbId: 245891,
        tmdbType: "movie",
        tmdbTitle: "John Wick",
        categories: ["discussion"],
        token: userToken3,
      },
      {
        content: "Looking forward to the new Marvel movie releases this year",
        tmdbId: 299536,
        tmdbType: "movie",
        tmdbTitle: "Avengers: Infinity War",
        categories: ["general"],
        token: userToken3,
        groupId: groupId, // This post is in the group
      },
    ];

    for (const postData of testPosts) {
      const postRes = await request(app)
        .post("/api/posts")
        .set("x-auth-token", postData.token)
        .send({
          content: postData.content,
          tmdbId: postData.tmdbId,
          tmdbType: postData.tmdbType,
          tmdbTitle: postData.tmdbTitle,
          categories: postData.categories,
          groupId: postData.groupId,
        });

      if (postRes.status === 201) {
        postIds.push(postRes.body._id);
      }
    }

    // Wait a bit for all posts to be created
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  describe("📝 Basic Search Tests", () => {
    test("Should search posts by text content", async () => {
      const res = await request(app).get("/api/posts/search?q=mind-bending");

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].content).toContain("mind-bending");
      expect(res.body.posts[0].tmdbTitle).toBe("Inception");
    });

    test("Should search posts by movie title", async () => {
      const res = await request(app).get("/api/posts/search?q=Dark Knight");

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].tmdbTitle).toBe("The Dark Knight");
    });

    test("Should return empty array for non-existent search", async () => {
      const res = await request(app).get(
        "/api/posts/search?q=nonexistentmovie"
      );

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(0);
    });
  });

  describe("👤 Author Search Tests", () => {
    test("Should search posts by author username", async () => {
      const res = await request(app).get(
        "/api/posts/search?author=moviecritic"
      );

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(2);
      expect(res.body.posts[0].author.username).toBe("moviecritic");
      expect(res.body.posts[1].author.username).toBe("moviecritic");
    });

    test("Should search posts by partial author username (case insensitive)", async () => {
      const res = await request(app).get("/api/posts/search?author=HORROR");

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(2);
      expect(res.body.posts[0].author.username).toBe("horrorFan");
    });

    test("Should return empty array for non-existent author", async () => {
      const res = await request(app).get(
        "/api/posts/search?author=nonexistentuser"
      );

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(0);
    });
  });

  describe("🎬 Movie/TV Filter Tests", () => {
    test("Should filter posts by specific TMDB ID", async () => {
      const res = await request(app).get("/api/posts/search?tmdbId=27205");

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].tmdbId).toBe(27205);
      expect(res.body.posts[0].tmdbTitle).toBe("Inception");
    });

    test("Should filter posts by movie type", async () => {
      const res = await request(app).get("/api/posts/search?tmdbType=movie");

      expect(res.status).toBe(200);
      expect(res.body.posts.length).toBeGreaterThan(3);
      res.body.posts.forEach((post) => {
        expect(post.tmdbType).toBe("movie");
      });
    });

    test("Should filter posts by TV type", async () => {
      const res = await request(app).get("/api/posts/search?tmdbType=tv");

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].tmdbType).toBe("tv");
      expect(res.body.posts[0].tmdbTitle).toBe("Breaking Bad");
    });

    test("Should combine TMDB ID and type filters", async () => {
      const res = await request(app).get(
        "/api/posts/search?tmdbId=27205&tmdbType=movie"
      );

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].tmdbId).toBe(27205);
      expect(res.body.posts[0].tmdbType).toBe("movie");
    });
  });

  describe("🏷️ Category Filter Tests", () => {
    test("Should filter posts by review category", async () => {
      const res = await request(app).get("/api/posts/search?category=review");

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(3);
      res.body.posts.forEach((post) => {
        expect(post.categories).toContain("review");
      });
    });

    test("Should filter posts by recommendation category", async () => {
      const res = await request(app).get(
        "/api/posts/search?category=recommendation"
      );

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].categories).toContain("recommendation");
    });

    test("Should filter posts by discussion category", async () => {
      const res = await request(app).get(
        "/api/posts/search?category=discussion"
      );

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].content).toContain("John Wick");
    });
  });

  describe("📅 Date Range Tests", () => {
    test("Should filter posts by date range (last 24 hours)", async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const res = await request(app).get(
        `/api/posts/search?dateFrom=${yesterday.toISOString()}&dateTo=${now.toISOString()}`
      );

      expect(res.status).toBe(200);
      expect(res.body.posts.length).toBeGreaterThan(0);

      res.body.posts.forEach((post) => {
        const postDate = new Date(post.createdAt);
        expect(postDate.getTime()).toBeGreaterThanOrEqual(yesterday.getTime());
        expect(postDate.getTime()).toBeLessThanOrEqual(now.getTime());
      });
    });

    test("Should return empty for future date range", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);

      const res = await request(app).get(
        `/api/posts/search?dateFrom=${tomorrow.toISOString()}&dateTo=${dayAfter.toISOString()}`
      );

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(0);
    });
  });

  describe("👥 Group Filter Tests", () => {
    test("Should filter posts by group ID", async () => {
      const res = await request(app).get(
        `/api/posts/search?groupId=${groupId}`
      );

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].group._id).toBe(groupId);
      expect(res.body.posts[0].content).toContain("Marvel");
    });

    test("Should return empty for non-existent group", async () => {
      const fakeGroupId = new mongoose.Types.ObjectId();
      const res = await request(app).get(
        `/api/posts/search?groupId=${fakeGroupId}`
      );

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(0);
    });
  });

  describe("🔄 Sorting and Pagination Tests", () => {
    test("Should sort posts by creation date (newest first)", async () => {
      const res = await request(app).get(
        "/api/posts/search?sortBy=createdAt&order=desc"
      );

      expect(res.status).toBe(200);
      expect(res.body.posts.length).toBeGreaterThan(1);

      // Check if posts are sorted by newest first
      for (let i = 0; i < res.body.posts.length - 1; i++) {
        const current = new Date(res.body.posts[i].createdAt);
        const next = new Date(res.body.posts[i + 1].createdAt);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    test("Should sort posts by creation date (oldest first)", async () => {
      const res = await request(app).get(
        "/api/posts/search?sortBy=createdAt&order=asc"
      );

      expect(res.status).toBe(200);
      expect(res.body.posts.length).toBeGreaterThan(1);

      // Check if posts are sorted by oldest first
      for (let i = 0; i < res.body.posts.length - 1; i++) {
        const current = new Date(res.body.posts[i].createdAt);
        const next = new Date(res.body.posts[i + 1].createdAt);
        expect(current.getTime()).toBeLessThanOrEqual(next.getTime());
      }
    });

    test("Should handle pagination correctly", async () => {
      const res = await request(app).get("/api/posts/search?limit=2&page=1");

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
      expect(res.body.pagination.pages).toBeGreaterThanOrEqual(1);
    });

    test("Should handle second page of pagination", async () => {
      const res = await request(app).get("/api/posts/search?limit=2&page=2");

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.limit).toBe(2);
    });
  });

  describe("🔀 Complex Search Combinations", () => {
    test("Should combine multiple filters (author + category + tmdbType)", async () => {
      const res = await request(app).get(
        "/api/posts/search?author=moviecritic&category=review&tmdbType=movie"
      );

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(2);

      res.body.posts.forEach((post) => {
        expect(post.author.username).toBe("moviecritic");
        expect(post.categories).toContain("review");
        expect(post.tmdbType).toBe("movie");
      });
    });

    test("Should combine text search with filters", async () => {
      const res = await request(app).get(
        "/api/posts/search?q=movie&tmdbType=movie&category=review"
      );

      expect(res.status).toBe(200);
      expect(res.body.posts.length).toBeGreaterThan(0);

      res.body.posts.forEach((post) => {
        expect(post.tmdbType).toBe("movie");
        expect(post.categories).toContain("review");
      });
    });

    test("Should handle complex search with pagination and sorting", async () => {
      const res = await request(app).get(
        "/api/posts/search?tmdbType=movie&sortBy=createdAt&order=desc&limit=3&page=1"
      );

      expect(res.status).toBe(200);
      expect(res.body.posts.length).toBeLessThanOrEqual(3);
      expect(res.body.pagination.limit).toBe(3);
      expect(res.body.pagination.page).toBe(1);

      res.body.posts.forEach((post) => {
        expect(post.tmdbType).toBe("movie");
      });
    });
  });

  describe("🛡️ Error Handling", () => {
    test("Should handle invalid tmdbType", async () => {
      const res = await request(app).get("/api/posts/search?tmdbType=invalid");

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(0);
    });

    test("Should handle invalid sortBy field gracefully", async () => {
      const res = await request(app).get(
        "/api/posts/search?sortBy=invalidField"
      );

      expect(res.status).toBe(200);
      expect(res.body.posts).toBeDefined();
    });

    test("Should handle invalid pagination values", async () => {
      const res = await request(app).get("/api/posts/search?page=-1&limit=0");

      expect(res.status).toBe(200);
      expect(res.body.posts).toBeDefined();
    });
  });

  describe("📊 Response Structure Tests", () => {
    test("Should return proper response structure", async () => {
      const res = await request(app).get("/api/posts/search?q=movie");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("posts");
      expect(res.body).toHaveProperty("pagination");
      expect(res.body.pagination).toHaveProperty("page");
      expect(res.body.pagination).toHaveProperty("limit");
      expect(res.body.pagination).toHaveProperty("total");
      expect(res.body.pagination).toHaveProperty("pages");
      expect(Array.isArray(res.body.posts)).toBe(true);
    });

    test("Should populate author and group information", async () => {
      const res = await request(app).get("/api/posts/search?limit=1");

      expect(res.status).toBe(200);
      if (res.body.posts.length > 0) {
        const post = res.body.posts[0];
        expect(post.author).toHaveProperty("username");
        expect(post.author).toHaveProperty("email");
        expect(post.author).not.toHaveProperty("password");

        if (post.group) {
          expect(post.group).toHaveProperty("name");
        }
      }
    });
  });
});
