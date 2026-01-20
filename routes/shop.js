const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');

// Public Shop Page
router.get('/:id', shopController.getShop);

module.exports = router;
