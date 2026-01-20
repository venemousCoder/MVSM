const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { forwardAuthenticated } = require('../config/auth');

// Login Page
router.get('/login', forwardAuthenticated, userController.loginPage);

// Register Page (Consumer)
router.get('/signup', forwardAuthenticated, userController.registerPage);

// Register Page (Business)
router.get('/business/register', forwardAuthenticated, userController.registerBusinessPage);

// Register Handle
router.post('/signup', userController.registerHandle);

// Register Business Handle
router.post('/business/register', userController.registerBusinessHandle);

// Login Handle
router.post('/login', userController.loginHandle);

// Forgot Password
router.get('/forgot-password', userController.forgotPasswordPage);
router.post('/forgot-password', userController.forgotPasswordHandle);

// Reset Password
router.get('/reset/:token', userController.resetPasswordPage);
router.post('/reset/:token', userController.resetPasswordHandle);

// Logout Handle
router.get('/logout', userController.logoutHandle);

const { ensureAuthenticated } = require('../config/auth');

// User Profile Routes
router.get('/profile', ensureAuthenticated, userController.getProfile);
router.post('/profile', ensureAuthenticated, userController.updateProfile);
router.post('/notifications', ensureAuthenticated, userController.updateNotifications);

module.exports = router;
