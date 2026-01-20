const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const notificationController = require('../controllers/notificationController');

router.use(ensureAuthenticated);

router.get('/', notificationController.getNotifications);
router.post('/:id/read', notificationController.markAsRead);
router.post('/read-all', notificationController.markAllAsRead);

module.exports = router;
