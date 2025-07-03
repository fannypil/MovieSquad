const Notification = require('../models/Notification');

// Helper function for consistent error handling
const handleServerError = (res, err, message = 'Server error') => {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid ID format' });
    }
    res.status(500).json({ message: message });
};

// @desc    Get all notifications for the authenticated user
// @route   GET /api/notifications/me
// @access  Private
exports.getMyNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user.id })
            .populate('sender', 'username profilePicture')
            .sort({ createdAt: -1 }); // Most recent first

        res.json(notifications);
    } catch (err) {
        handleServerError(res, err, 'Server error fetching notifications');
    }
};

// @desc    Get unread notification count for the authenticated user
// @route   GET /api/notifications/me/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            recipient: req.user.id,
            read: false
        });

        res.json({ unreadCount: count });
    } catch (err) {
        handleServerError(res, err, 'Server error fetching unread count');
    }
};

// @desc    Mark a specific notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // Check if the notification belongs to the authenticated user
        if (notification.recipient.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden: This notification does not belong to you' });
        }

        notification.read = true;
        await notification.save();

        res.json({ message: 'Notification marked as read', notification });
    } catch (err) {
        handleServerError(res, err, 'Server error marking notification as read');
    }
};

// @desc    Mark all notifications for the authenticated user as read
// @route   PUT /api/notifications/me/read-all
// @access  Private
exports.markAllNotificationsAsRead =  async (req, res) => {
       try {
        await Notification.updateMany(
            { recipient: req.user.id, read: false },
            { read: true }
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        handleServerError(res, err, 'Server error marking all notifications as read');
    }
};

// @desc    Delete a specific notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res) => {
   try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // Check if the notification belongs to the authenticated user
        if (notification.recipient.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden: This notification does not belong to you' });
        }

        await Notification.deleteOne({ _id: req.params.id });

        res.json({ message: 'Notification deleted successfully' });
    } catch (err) {
        handleServerError(res, err, 'Server error deleting notification');
    }
}