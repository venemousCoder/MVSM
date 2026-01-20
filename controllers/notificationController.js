const Notification = require('../models/Notification');

// @desc    Get My Notifications
// @route   GET /notifications
exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);
        
        // Mark all as read when viewing the full list? Or let user click?
        // Usually, viewing the list might not mark all read, but let's assume specific click does.
        // For now, just list them.

        res.render('users/notifications', {
            title: 'My Notifications',
            user: req.user,
            notifications
        });

    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Mark Notification as Read
// @route   POST /notifications/:id/read
exports.markAsRead = async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Mark All as Read
// @route   POST /notifications/read-all
exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
        res.redirect('/notifications');
    } catch (err) {
        console.error(err);
        res.redirect('/notifications');
    }
};

// Helper to create notification
exports.createNotification = async (userId, title, message, type, link) => {
    try {
        await Notification.create({
            user: userId,
            title,
            message,
            type,
            link
        });
        return true;
    } catch (err) {
        console.error("Error creating notification", err);
        return false;
    }
};
