const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware'); 
const authorizeRoles = require('../middleware/authorizeRoles'); 
const postController = require('../controllers/postController');

// Create a new post POST /api/posts
router.post('/', auth, authorizeRoles('user', 'groupAdmin', 'admin'), postController.createPost);

// Get all posts GET /api/posts
router.get('/', postController.getPosts);

// Get post by id GET /api/posts/:id
router.get('/:id', postController.getPostById);

// Update post by id PUT /api/posts/:id
router.put('/:id', auth, authorizeRoles('user', 'groupAdmin', 'admin'), postController.updatePost);

// Delete post by id DELETE /api/posts/:id
router.delete('/:id', auth, authorizeRoles('user', 'groupAdmin', 'admin'), postController.deletePost);

module.exports = router;
