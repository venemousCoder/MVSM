const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { ensureAuthenticated } = require('../config/auth');

// Submit Report
router.post('/submit', ensureAuthenticated, reportController.submitReport);

module.exports = router;