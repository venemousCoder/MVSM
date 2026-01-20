const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const consumerController = require('../controllers/consumerController');
const liveChatController = require('../controllers/liveChatController');

router.use(ensureAuthenticated);

// List Orders
router.get('/', consumerController.getMyOrders);

// Show Order Details
router.get('/:id', consumerController.getOrderDetails);

// Review Order
router.get('/:id/review', consumerController.getReviewForm);
router.post('/:id/review', consumerController.postReview);

// Cancel Order
router.post('/:id/cancel', consumerController.cancelOrder);

// Live Chat Routes
router.post('/:id/chat/request', liveChatController.requestChat);
router.get('/:id/chat', liveChatController.getChatRoom);
router.post('/:id/chat/respond', liveChatController.respondChat);
router.post('/:id/chat/close', liveChatController.closeChat);

module.exports = router;
