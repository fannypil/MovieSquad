const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");
const adminController = require("../controllers/adminController");

// Access a protected admin-only dashboard,  GET /api/admin/dashboard
router.get("/dashboard", auth, authorizeRoles("admin"), adminController.getDashboard);

// Get all users, GET /api/admin/users
router.get("/users", auth, authorizeRoles("admin"), adminController.getAllUsers);

// Get a user by ID, GET /api/admin/users/:id
router.get("/users/:id", auth, authorizeRoles("admin"), adminController.getUserById);

// Update a user by ID, PUT /api/admin/users/:id
router.put("/users/:id", auth, authorizeRoles("admin"), adminController.updateUser);

// Delete a user by ID, DELETE /api/admin/users/:id
router.delete("/users/:id", auth, authorizeRoles("admin"), adminController.deleteUser);

module.exports = router;