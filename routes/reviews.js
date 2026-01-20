const express = require('express');
const router = express.Router();
const consumerController = require('../controllers/consumerController');
const { ensureAuthenticated } = require('../config/auth');

// Report Review
router.post('/:id/report', ensureAuthenticated, consumerController.reportReview);

module.exports = router;