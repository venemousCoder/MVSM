const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureRole } = require('../config/auth');
const operatorController = require('../controllers/operatorController');
const liveChatController = require('../controllers/liveChatController');

// All routes require authentication and 'operator' role
router.use(ensureAuthenticated);
router.use(ensureRole('operator'));

// Dashboard
router.get('/dashboard', operatorController.getDashboard);

// Queue Management
router.get('/queue', operatorController.getQueue);
router.get('/queue/:id', operatorController.getOrderDetails);
router.post('/queue/:id/status', operatorController.updateOrderStatus);

// Internal Chat / Direct Message
router.get('/chat/:chatId', liveChatController.getChatRoom);
router.post('/chat/:chatId/close', liveChatController.closeChat);

module.exports = router;
