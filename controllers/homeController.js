const Business = require('../models/Business');
const Product = require('../models/Product');
const Service = require('../models/Service');
const Operator = require('../models/Operator');
const Review = require('../models/Review');

exports.getHomePage = async (req, res) => {
    try {
        // Fetch Featured Businesses (e.g., limit 4)
        const businesses = await Business.find({ status: 'active' })
            .sort({ createdAt: -1 })
            .limit(4);

        // Fetch Latest Products (e.g., limit 8)
        let products = await Product.find({ status: 'active' })
            .sort({ createdAt: -1 })
            .limit(20)
            .populate('business');
        
        products = products.filter(p => p.business && p.business.status === 'active').slice(0, 8);

        // Fetch Popular Services (e.g., limit 8)
        let services = await Service.find({ status: 'active' })
            .sort({ createdAt: -1 })
            .limit(20)
            .populate('business');
        
        services = services.filter(s => s.business && s.business.status === 'active').slice(0, 8);

        res.render('pages/home', {
            title: 'Home',
            user: req.user,
            businesses,
            products,
            services
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

exports.search = async (req, res) => {
    try {
        const { q, category, type, minPrice, maxPrice, minRating, location, availability } = req.query;
        let products = [];
        let serviceBusinesses = [];

        const searchRegex = new RegExp(q, 'i');
        const locationRegex = location ? new RegExp(location, 'i') : null;
        const ratingFilter = minRating ? parseFloat(minRating) : 0;
        
        const showProducts = !type || type === 'all' || type === 'product' || category === 'Retail';
        const showServices = !type || type === 'all' || type === 'service' || category === 'Services';

        // --- 1. SEARCH PRODUCTS ---
        if (showProducts) {
             // Find Retail Businesses matching the query
             const matchingRetailBusinesses = await Business.find({
                type: 'retail',
                status: 'active',
                $or: [
                    { name: searchRegex },
                    { description: searchRegex }
                ]
             }).select('_id');
             const retailBusinessIds = matchingRetailBusinesses.map(b => b._id);

             let productQuery = {
                 status: 'active',
                 $or: [
                     { name: searchRegex },
                     { description: searchRegex },
                     { tags: searchRegex },
                     { category: searchRegex },
                     { business: { $in: retailBusinessIds } }
                 ]
             };
             
             if (category && category !== 'Retail' && category !== 'Services') {
                 productQuery.category = category; 
             }
             
             // Price Filter
             if (minPrice || maxPrice) {
                 productQuery.price = {};
                 if (minPrice) productQuery.price.$gte = parseFloat(minPrice);
                 if (maxPrice) productQuery.price.$lte = parseFloat(maxPrice);
             }

             // Availability Filter (Stock > 0)
             if (availability) {
                 productQuery.stock = { $gt: 0 };
             }

             let foundProducts = await Product.find(productQuery).populate('business');
             
             // Filter by Business Status (Active Only)
             foundProducts = foundProducts.filter(p => p.business && p.business.status === 'active');

             // Location Filter (on Business Address)
             if (locationRegex) {
                 foundProducts = foundProducts.filter(p => p.business && locationRegex.test(p.business.address));
             }

             // Attach ratings & Filter
             products = await Promise.all(foundProducts.map(async (p) => {
                 const reviews = await Review.find({ product: p._id, status: 'active' });
                 const count = reviews.length;
                 const avg = count > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / count) : 0;
                 return { ...p.toObject(), rating: avg, reviewCount: count };
             }));
             
             if (ratingFilter > 0) {
                 products = products.filter(p => p.rating >= ratingFilter);
             }
        }

        // --- 2. SEARCH SERVICE BUSINESSES ---
        if (showServices) {
            // A. Find Businesses matching text
            let businessQuery = {
                type: 'service',
                status: 'active',
                $or: [
                    { name: searchRegex },
                    { description: searchRegex },
                    { category: searchRegex }
                ]
            };

            // Location Filter
            if (locationRegex) {
                businessQuery.address = locationRegex;
            }
            
            const matchingBusinesses = await Business.find(businessQuery);
            let businessIds = matchingBusinesses.map(b => b._id.toString());

            // B. Find Businesses via Services matching text (if not already found)
            // (Only if text query is present, otherwise simple business list)
            if (q) {
                const matchingServices = await Service.find({
                    status: 'active',
                    $or: [
                        { name: searchRegex },
                        { description: searchRegex },
                        { tags: searchRegex }
                    ]
                });
                
                matchingServices.forEach(s => {
                    if (!businessIds.includes(s.business.toString())) {
                        businessIds.push(s.business.toString());
                    }
                });
            }

            // C. Fetch all unique businesses
            let finalBusinesses = await Business.find({ _id: { $in: businessIds }, status: 'active', type: 'service' });

            // Location Filter (Double check if added via Service text match)
            if (locationRegex) {
                finalBusinesses = finalBusinesses.filter(b => locationRegex.test(b.address));
            }

            // D. Attach details & Filter by Rating
            let enrichedBusinesses = await Promise.all(finalBusinesses.map(async (b) => {
                const opCount = await Operator.countDocuments({ business: b._id });
                
                // Availability Filter (Operators > 0)
                if (availability && opCount === 0) return null;

                const someServices = await Service.find({ business: b._id }).limit(3).select('name');
                const serviceNames = someServices.map(s => s.name).join(' • ');
                
                const reviews = await Review.find({ business: b._id, status: 'active' });
                const count = reviews.length;
                const avg = count > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / count) : 0;

                return { 
                    ...b.toObject(), 
                    operatorCount: opCount, 
                    serviceList: serviceNames,
                    rating: avg,
                    reviewCount: count,
                    waitTime: Math.floor(Math.random() * 30) + 5 
                };
            }));

            // Filter nulls (availability) and Rating
            serviceBusinesses = enrichedBusinesses.filter(b => b !== null && b.rating >= ratingFilter);
        }

        res.render('pages/search', {
            title: `Search Results`,
            user: req.user,
            query: q,
            products,
            serviceBusinesses,
            filters: {
                category,
                type: type || 'all',
                minPrice,
                maxPrice,
                minRating,
                location,
                availability
            }
        });

    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};
