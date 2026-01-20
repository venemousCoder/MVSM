const Service = require('../models/Service');
const Review = require('../models/Review');
const Operator = require('../models/Operator');
const Order = require('../models/Order');

// @desc    Get Service Details
// @route   GET /services/:id
exports.getServiceDetails = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id).populate('business');

        if (!service || service.status !== 'active' || (service.business && service.business.status !== 'active')) {
             req.flash('error_msg', 'Service not found or unavailable');
             return res.redirect('/');
        }

        // Fetch Reviews for this service
        const reviews = await Review.find({ service: service._id, status: 'active' })
            .populate('user', 'name')
            .populate('order', '_id')
            .sort({ createdAt: -1 });

        // Calculate average rating
        let avgRating = 0;
        if (reviews.length > 0) {
            avgRating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
        }

        // Get related services from same business
        const relatedServices = await Service.find({ 
            business: service.business._id, 
            status: 'active',
            _id: { $ne: service._id } 
        }).limit(4);

        // Fetch Operators for this service
        // Operators must belong to the business AND have this service in their 'services' array
        const rawOperators = await Operator.find({
            business: service.business._id,
            status: 'active',
            services: service._id
        }).populate('user', 'name');

        // Enhance operators with queue info
        const operators = await Promise.all(rawOperators.map(async (op) => {
            const queueCount = await Order.countDocuments({
                operator: op._id,
                status: { $in: ['pending', 'processing'] }
            });

            // Fetch actual operator reviews
            const opReviews = await Review.find({ 
                operator: op._id, 
                targetType: 'operator', 
                status: 'active' 
            }).populate('user', 'name').populate('order', '_id').sort({ createdAt: -1 });

            let opRating = 0;
            if (opReviews.length > 0) {
                opRating = opReviews.reduce((acc, r) => acc + r.rating, 0) / opReviews.length;
            }
            
            return {
                _id: op._id,
                name: op.user.name,
                rating: opRating,
                reviews: opReviews,
                queueLength: queueCount,
                estWaitTime: queueCount * service.duration,
                isAvailable: queueCount === 0 // Simple logic: if no queue, available now? Or just status.
            };
        }));

        res.render('services/show', {
            title: service.name,
            user: req.user,
            service,
            reviews,
            avgRating,
            relatedServices,
            operators
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};
