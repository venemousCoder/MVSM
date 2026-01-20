const Order = require('../models/Order');
const Review = require('../models/Review');

// @desc    Get Consumer Orders
// @route   GET /orders
exports.getMyOrders = async (req, res) => {
    try {
        const rawOrders = await Order.find({ customer: req.user._id })
            .populate('business')
            .populate('operator')
            .populate({
                path: 'operator',
                populate: { path: 'user' }
            })
            .populate('items.product')
            .populate('items.service')
            .sort({ createdAt: -1 });

        // Enrich orders with queue info for services
        const orders = await Promise.all(rawOrders.map(async (order) => {
            const orderObj = order.toObject();
            
            // Check if it's a service order (has service items)
            const isService = order.items.some(item => item.service);
            
            if (isService && (order.status === 'pending' || order.status === 'processing')) {
                let query = {
                    business: order.business._id,
                    status: { $in: ['pending', 'processing'] },
                    createdAt: { $lt: order.createdAt }
                };

                if (order.operator) {
                    query.operator = order.operator._id;
                }

                const queueCount = await Order.countDocuments(query);
                const position = queueCount + 1;
                
                // Estimate wait (mock 15 mins per order if duration unavailable)
                let duration = 15;
                if(order.items[0] && order.items[0].service && order.items[0].service.duration) {
                    duration = order.items[0].service.duration;
                }

                orderObj.queueInfo = {
                    position: position,
                    estWait: position * duration
                };
            }
            
            return orderObj;
        }));

        res.render('orders/index', {
            title: 'My Orders',
            user: req.user,
            orders
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Get Single Order Details
// @route   GET /orders/:id
exports.getOrderDetails = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, customer: req.user._id })
            .populate('business')
            .populate('items.product')
            .populate('items.service');

        if (!order) {
            req.flash('error_msg', 'Order not found');
            return res.redirect('/orders');
        }

        const hasReviewed = await Review.exists({ order: order._id, user: req.user._id });

        res.render('orders/show', {
            title: `Order #${order._id}`,
            user: req.user,
            order,
            hasReviewed
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Cancel Order
// @route   POST /orders/:id/cancel
exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, customer: req.user._id });

        if (!order) {
            req.flash('error_msg', 'Order not found');
            return res.redirect('/orders');
        }

        if (order.status !== 'pending') {
            req.flash('error_msg', 'Cannot cancel order that is already processing or completed');
            return res.redirect(`/orders/${order._id}`);
        }

        order.status = 'cancelled';
        order.history.push({
            action: 'status_change',
            status: 'cancelled',
            note: 'Cancelled by customer',
            user: req.user._id
        });

        await order.save();

        req.flash('success_msg', 'Order cancelled successfully');
        res.redirect('/orders');
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Show Review Form
// @route   GET /orders/:id/review
exports.getReviewForm = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, customer: req.user._id })
            .populate('business')
            .populate('operator')
            .populate({
                path: 'operator',
                populate: { path: 'user' }
            })
            .populate('items.product')
            .populate('items.service');

        if (!order) {
            req.flash('error_msg', 'Order not found');
            return res.redirect('/orders');
        }

        if (order.status !== 'completed') {
            req.flash('error_msg', 'You can only review completed orders');
            return res.redirect(`/orders/${order._id}`);
        }

        // Check if already reviewed
        const existingReviews = await Review.find({ order: order._id, user: req.user._id });
        if (existingReviews.length > 0) {
            req.flash('info_msg', 'You have already reviewed this order. Submitting again will update your previous reviews.');
        }

        res.render('orders/review', {
            title: `Review Order #${order._id.toString().slice(-6)}`,
            user: req.user,
            order
        });

    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Process Review Submission
// @route   POST /orders/:id/review
exports.postReview = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, customer: req.user._id });
        if (!order || order.status !== 'completed') {
            return res.redirect('/orders');
        }

        const { product_reviews, service_reviews, operator_rating, operator_comment } = req.body;
        
        // Use a Set to avoid duplicate reviews for the same product in one order if quantity > 1 (though normally we review the 'line item' or 'product' once)
        // Actually, simplified: loop through items.
        
        let createdReviews = 0;

        // 1. Product/Service Reviews
        if (order.items && order.items.length > 0) {
            // We iterate over keys from body to match specific items or products
            // Expecting body like: product_reviews[product_id] = { rating: 5, comment: '...' }
            
            for (const item of order.items) {
                let reviewData = null;
                let targetType = '';
                let targetId = null;

                if (item.product && product_reviews && product_reviews[item.product.toString()]) {
                    reviewData = product_reviews[item.product.toString()];
                    targetType = 'product';
                    targetId = item.product;
                } else if (item.service && service_reviews && service_reviews[item.service.toString()]) {
                    reviewData = service_reviews[item.service.toString()];
                    targetType = 'service';
                    targetId = item.service;
                }

                if (reviewData && reviewData.rating) {
                    const existingReview = await Review.findOne({
                        user: req.user._id,
                        targetType: targetType,
                        [targetType]: targetId
                    });

                    if (existingReview) {
                        existingReview.rating = parseInt(reviewData.rating);
                        existingReview.comment = reviewData.comment || '';
                        existingReview.order = order._id; // Update to latest order
                        existingReview.createdAt = Date.now();
                        await existingReview.save();
                    } else {
                        await Review.create({
                            business: order.business,
                            user: req.user._id,
                            order: order._id,
                            targetType: targetType,
                            [targetType]: targetId, // Dynamic key: product or service
                            rating: parseInt(reviewData.rating),
                            comment: reviewData.comment || '',
                            status: 'active'
                        });
                    }
                    createdReviews++;
                }
            }
        }

        // 2. Operator Review
        if (order.operator && operator_rating) {
            const existingOpReview = await Review.findOne({
                user: req.user._id,
                targetType: 'operator',
                operator: order.operator
            });

            if (existingOpReview) {
                existingOpReview.rating = parseInt(operator_rating);
                existingOpReview.comment = operator_comment || '';
                existingOpReview.order = order._id;
                existingOpReview.createdAt = Date.now();
                await existingOpReview.save();
            } else {
                await Review.create({
                    business: order.business,
                    user: req.user._id,
                    order: order._id,
                    targetType: 'operator',
                    operator: order.operator,
                    rating: parseInt(operator_rating),
                    comment: operator_comment || '',
                    status: 'active'
                });
            }
            createdReviews++;
        }

        req.flash('success_msg', 'Thank you for your feedback!');
        res.redirect(`/orders/${order._id}`);

    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error submitting review');
        res.redirect(`/orders/${req.params.id}/review`);
    }
};

// @desc    Report a Review
// @route   POST /reviews/:id/report
exports.reportReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        
        if (!review) {
            req.flash('error_msg', 'Review not found');
            return res.redirect('back');
        }

        review.isReported = true;
        await review.save();

        req.flash('success_msg', 'Review reported to admin');
        res.redirect('back');
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};
