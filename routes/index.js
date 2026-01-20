const express = require('express');
const router = express.Router();

// Home and Static Pages
router.use('/', require('./home'));

// User Authentication Routes
router.use('/users', require('./users'));

// SME Specific Routes
router.use('/sme', require('./sme'));

// Operator Specific Routes
router.use('/operator', require('./operator'));

// Admin Routes
router.use('/admin', require('./admin'));

// Cart Routes
router.use('/cart', require('./cart'));

// Checkout Routes
router.use('/checkout', require('./checkout'));

// Order Routes (Customer View)
router.use('/orders', require('./orders'));

// Public Shop Routes
router.use('/shop', require('./shop'));

// Product Routes
router.use('/products', require('./products'));

// Service Routes
router.use('/services', require('./services'));

// Report Routes
router.use('/reports', require('./reports'));

// Notification Routes
router.use('/notifications', require('./notifications'));

module.exports = router;