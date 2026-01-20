const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureAuthenticated } = require('../config/auth');
const Report = require('../models/Report');

// Middleware to ensure user is admin
const ensureAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        req.flash('error_msg', 'Access Denied');
        return res.redirect('/');
    }
    next();
};

// Middleware to get global admin stats (like pending reports) for sidebar
const adminGlobalStats = async (req, res, next) => {
    try {
        const pendingReportCount = await Report.countDocuments({ status: 'pending' });
        res.locals.pendingReportCount = pendingReportCount;
        next();
    } catch (err) {
        console.error(err);
        next();
    }
};

// All routes protected
router.use(ensureAuthenticated, ensureAdmin, adminGlobalStats);

router.get('/dashboard', adminController.getDashboard);
router.get('/users', adminController.getUsers);
router.post('/users/bulk', adminController.bulkUserAction);
router.post('/users/:id/status', adminController.toggleUserStatus);
router.get('/businesses', adminController.getBusinesses);
router.post('/businesses/bulk', adminController.bulkBusinessAction);
router.post('/businesses/:id/status', adminController.toggleBusinessStatus);

// Report Management
router.get('/reports', adminController.getReports);
router.post('/reports/bulk', adminController.bulkReportAction);
router.post('/reports/:id/dismiss', adminController.dismissReport);
router.post('/reports/:id/delete', adminController.deleteReview);

module.exports = router;
