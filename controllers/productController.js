const Product = require('../models/Product');
const Review = require('../models/Review');

// @desc    Get Product Details
// @route   GET /products/:id
exports.getProductDetails = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('business');

        if (!product || product.status !== 'active' || (product.business && product.business.status !== 'active')) {
             // In a real app, render a 404 page
             req.flash('error_msg', 'Product not found or unavailable');
             return res.redirect('/');
        }

        // Fetch Reviews for this product
        const reviews = await Review.find({ product: product._id, status: 'active' })
            .populate('user', 'name')
            .populate('order', '_id')
            .sort({ createdAt: -1 });

        // Calculate average rating
        let avgRating = 0;
        if (reviews.length > 0) {
            avgRating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
        }

        // Get related products from same business (optional, for "More from this store")
        const relatedProducts = await Product.find({ 
            business: product.business._id, 
            status: 'active',
            _id: { $ne: product._id } 
        }).limit(4);

        res.render('products/show', {
            title: product.name,
            user: req.user,
            product,
            reviews,
            avgRating,
            relatedProducts
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};
