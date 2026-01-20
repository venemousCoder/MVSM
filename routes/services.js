const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const chatController = require('../controllers/chatController');

router.get('/:id', serviceController.getServiceDetails);

// Chat Interface
router.get('/:id/chat', chatController.getChat);
router.post('/:id/chat/complete', chatController.postChatComplete);
router.get('/confirmation/:orderId', chatController.getServiceConfirmation);

module.exports = router;
