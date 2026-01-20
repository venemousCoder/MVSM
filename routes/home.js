const express = require('express');
const router = express.Router();
const { ensureAuthenticated, forwardAuthenticated } = require('../config/auth');
const homeController = require('../controllers/homeController');

// Welcome Page
router.get('/', homeController.getHomePage);

// Search Page
router.get('/search', homeController.search);

// About Page
router.get('/about', (req, res) => res.render('pages/about', { title: 'About' }));

// Contact Page
router.get('/contact', (req, res) => res.render('pages/contact', { title: 'Contact' }));

module.exports = router;
