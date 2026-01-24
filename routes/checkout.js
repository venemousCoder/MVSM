const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const orderController = require('../controllers/orderController');

router.use(ensureAuthenticated);

router.get('/', orderController.getCheckout);
router.post('/', orderController.postCheckout);
router.get('/verify', orderController.verifyPayment);

module.exports = router;
