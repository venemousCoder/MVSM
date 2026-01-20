const Business = require('../models/Business');
const Product = require('../models/Product');
const Service = require('../models/Service');
const Review = require('../models/Review');
const Operator = require('../models/Operator');

// @desc    Get Public Shop Page
// @route   GET /shop/:id
exports.getShop = async (req, res) => {
    try {
        const business = await Business.findById(req.params.id);

        if (!business || business.status !== 'active') {
            req.render('error/500'); // Should be 404 really, but reuse existing
            return;
        }

        // Fetch Products
        const products = await Product.find({ business: business._id, status: 'active' });

        // Fetch Services
        const services = await Service.find({ business: business._id, status: 'active' });

        // Fetch Reviews
        let reviewQuery = { business: business._id, status: 'active' };
        if (business.type === 'service') {
            reviewQuery.targetType = 'service';
        }

        const reviews = await Review.find(reviewQuery)
            .populate('user', 'name')
            .populate('order', '_id')
            .sort({ createdAt: -1 });

        // Calculate average rating
        let avgRating = 0;
        if (reviews.length > 0) {
            avgRating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
        }

        // Operator count (for service businesses)
        let operatorCount = 0;
        if (business.type === 'service') {
            operatorCount = await Operator.countDocuments({ business: business._id });
        }

        res.render('shop/show', {
            title: business.name,
            user: req.user,
            business,
            products,
            services,
            reviews,
            avgRating,
            operatorCount
        });

    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};
