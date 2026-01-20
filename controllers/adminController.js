const User = require('../models/User');
const Business = require('../models/Business');
const Order = require('../models/Order');
const Report = require('../models/Report');
const Review = require('../models/Review');

// @desc    Admin Dashboard
// @route   GET /admin/dashboard
exports.getDashboard = async (req, res) => {
    try {
        const userCount = await User.countDocuments({ role: 'consumer' });
        const businessCount = await Business.countDocuments();
        const orderCount = await Order.countDocuments();
        const reportCount = await Report.countDocuments({ status: 'pending' });
        const revenueAgg = await Order.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        const totalRevenue = revenueAgg[0] ? revenueAgg[0].total : 0;

        // Recent Businesses
        const recentBusinesses = await Business.find().sort({ createdAt: -1 }).limit(5).populate('owner', 'name email');

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            user: req.user,
            stats: {
                users: userCount,
                businesses: businessCount,
                orders: orderCount,
                revenue: totalRevenue,
                reports: reportCount
            },
            recentBusinesses,
            layout: 'layouts/admin'
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// ... existing code ...

// @desc    Manage Reports
// @route   GET /admin/reports
exports.getReports = async (req, res) => {
    try {
        const reports = await Report.find({ status: 'pending' })
            .populate('reporter', 'name email')
            .populate('targetId') // Dynamic population
            .sort({ createdAt: -1 });

        res.render('admin/reports', {
            title: 'Manage Reports',
            user: req.user,
            reports,
            layout: 'layouts/admin'
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Dismiss Report
// @route   POST /admin/reports/:id/dismiss
exports.dismissReport = async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) {
            req.flash('error_msg', 'Report not found');
            return res.redirect('/admin/reports');
        }

        report.status = 'dismissed';
        await report.save();

        req.flash('success_msg', 'Report dismissed');
        res.redirect('/admin/reports');
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Delete Target (Review/Product/etc) - Optional, simplified to Resolve for now
// @route   POST /admin/reports/:id/delete
exports.deleteReview = async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) return res.redirect('/admin/reports');

        // Logic to delete the target would go here based on report.targetType
        // For safety, just resolving it now.
        report.status = 'resolved';
        await report.save();
        
        req.flash('success_msg', 'Report marked as resolved');
        res.redirect('/admin/reports');
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Manage Users
// @route   GET /admin/users
exports.getUsers = async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};
        
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const users = await User.find(query).sort({ createdAt: -1 });
        
        res.render('admin/users', {
            title: 'Manage Users',
            user: req.user,
            users,
            search,
            layout: 'layouts/admin'
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Bulk User Action
// @route   POST /admin/users/bulk
exports.bulkUserAction = async (req, res) => {
    try {
        const { userIds, action } = req.body;
        const ids = Array.isArray(userIds) ? userIds : [userIds];

        if (!ids || ids.length === 0) {
            req.flash('error_msg', 'No users selected');
            return res.redirect('/admin/users');
        }

        if (action === 'activate') {
            await User.updateMany({ _id: { $in: ids } }, { isActive: true });
            req.flash('success_msg', 'Selected users activated');
        } else if (action === 'ban') {
            // Prevent banning self
            const safeIds = ids.filter(id => id !== req.user._id.toString());
            await User.updateMany({ _id: { $in: safeIds } }, { isActive: false });
            req.flash('success_msg', 'Selected users banned');
        }

        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Bulk Business Action
// @route   POST /admin/businesses/bulk
exports.bulkBusinessAction = async (req, res) => {
    try {
        const { businessIds, action } = req.body;
        const ids = Array.isArray(businessIds) ? businessIds : [businessIds];

        if (!ids || ids.length === 0) {
            req.flash('error_msg', 'No businesses selected');
            return res.redirect('/admin/businesses');
        }

        if (action === 'activate') {
            await Business.updateMany({ _id: { $in: ids } }, { status: 'active' });
            req.flash('success_msg', 'Selected businesses activated');
        } else if (action === 'suspend') {
            await Business.updateMany({ _id: { $in: ids } }, { status: 'suspended' });
            req.flash('success_msg', 'Selected businesses suspended');
        }

        res.redirect('/admin/businesses');
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Bulk Report Action
// @route   POST /admin/reports/bulk
exports.bulkReportAction = async (req, res) => {
    try {
        const { reportIds, action } = req.body;
        const ids = Array.isArray(reportIds) ? reportIds : [reportIds];

        if (!ids || ids.length === 0) {
            req.flash('error_msg', 'No reports selected');
            return res.redirect('/admin/reports');
        }

        if (action === 'dismiss') {
            await Report.updateMany({ _id: { $in: ids } }, { status: 'dismissed' });
            req.flash('success_msg', 'Selected reports dismissed');
        } else if (action === 'resolve') {
            await Report.updateMany({ _id: { $in: ids } }, { status: 'resolved' });
            req.flash('success_msg', 'Selected reports resolved');
        }

        res.redirect('/admin/reports');
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Toggle User Status (Ban/Unban)
// @route   POST /admin/users/:id/status
exports.toggleUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/admin/users');
        }
        
        // Prevent banning self
        if (user._id.toString() === req.user._id.toString()) {
            req.flash('error_msg', 'Cannot ban yourself');
            return res.redirect('/admin/users');
        }

        user.isActive = !user.isActive;
        await user.save();
        
        req.flash('success_msg', `User ${user.isActive ? 'activated' : 'deactivated'}`);
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Manage Businesses
// @route   GET /admin/businesses
exports.getBusinesses = async (req, res) => {
    try {
        const businesses = await Business.find().populate('owner', 'name email').sort({ createdAt: -1 });
        res.render('admin/businesses', {
            title: 'Manage Businesses',
            user: req.user,
            businesses,
            layout: 'layouts/admin'
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Toggle Business Status
// @route   POST /admin/businesses/:id/status
exports.toggleBusinessStatus = async (req, res) => {
    try {
        const business = await Business.findById(req.params.id);
        if (!business) {
            req.flash('error_msg', 'Business not found');
            return res.redirect('/admin/businesses');
        }

        // Admin forces 'suspended' instead of 'inactive'
        if (business.status === 'suspended') {
            business.status = 'active';
        } else {
            business.status = 'suspended';
        }
        
        await business.save();

        req.flash('success_msg', `Business ${business.status}`);
        res.redirect('/admin/businesses');
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};
