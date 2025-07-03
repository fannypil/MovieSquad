const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

// Route for getting all notifications for the authenticated user
router.get('/me', auth, notificationController.getMyNotifications);

// Route for getting the count of unread notifications
router.get('/me/unread-count', auth, notificationController.getUnreadCount);

// Route for marking a specific notification as read
router.put('/:id/read', auth, notificationController.markAsRead);

// Route for marking all notifications as read
router.put('/me/read-all', auth, notificationController.markAllNotificationsAsRead);

// Route for deleting a specific notification
router.delete('/:id', auth, notificationController.deleteNotification);


module.exports = router;