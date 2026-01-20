const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const cartController = require('../controllers/cartController');

// All cart routes require authentication
router.use(ensureAuthenticated);

router.get('/', cartController.getCart);
router.post('/add', cartController.addToCart);
router.post('/update', cartController.updateCartItem);
router.post('/remove', cartController.removeFromCart);

module.exports = router;
