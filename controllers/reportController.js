const Report = require('../models/Report');

// @desc    Submit a Report
// @route   POST /reports/submit
exports.submitReport = async (req, res) => {
    try {
        const { targetType, targetId, reason } = req.body;

        if (!targetType || !targetId) {
            req.flash('error_msg', 'Invalid report data');
            return res.redirect(req.get('Referer') || '/');
        }

        await Report.create({
            reporter: req.user._id,
            targetType,
            targetId,
            reason: reason || 'Inappropriate content',
            status: 'pending'
        });

        req.flash('success_msg', 'Report submitted successfully. Thank you for your feedback.');
        res.redirect(req.get('Referer') || '/');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error submitting report');
        res.redirect(req.get('Referer') || '/');
    }
};
