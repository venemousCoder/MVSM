const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Service = require('../models/Service');
const User = require('../models/User');

// @desc    Show Checkout Page
// @route   GET /checkout
exports.getCheckout = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id })
            .populate('items.product')
            .populate('items.service');

        if (!cart || cart.items.length === 0) {
            req.flash('error_msg', 'Your cart is empty');
            return res.redirect('/cart');
        }

        res.render('checkout/index', {
            title: 'Checkout',
            user: req.user,
            cart
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Process Checkout
// @route   POST /checkout
exports.postCheckout = async (req, res) => {
    try {
        const { address, phone } = req.body;
        
        // Validation
        if (!address || !phone) {
             req.flash('error_msg', 'Please provide delivery address and phone number');
             return res.redirect('/checkout');
        }

        const cart = await Cart.findOne({ user: req.user._id })
            .populate({
                path: 'items.product',
                select: 'business price name stock' 
            })
            .populate({
                path: 'items.service',
                select: 'business price name'
            });

        if (!cart || cart.items.length === 0) {
            req.flash('error_msg', 'Cart is empty');
            return res.redirect('/cart');
        }

        // Group items by Business
        const ordersByBusiness = {};

        for (const item of cart.items) {
            let businessId;
            let realItem;

            if (item.itemType === 'product' && item.product) {
                businessId = item.product.business.toString();
                realItem = item.product;
            } else if (item.itemType === 'service' && item.service) {
                businessId = item.service.business.toString();
                realItem = item.service;
            } else {
                continue; // Skip invalid items
            }

            if (!ordersByBusiness[businessId]) {
                ordersByBusiness[businessId] = {
                    items: [],
                    total: 0
                };
            }

            ordersByBusiness[businessId].items.push({
                product: item.itemType === 'product' ? item.product._id : undefined,
                service: item.itemType === 'service' ? item.service._id : undefined,
                name: realItem.name,
                quantity: item.quantity,
                price: item.price
            });

            ordersByBusiness[businessId].total += (item.price * item.quantity);

            // Optional: Stock check/update could happen here
            if (item.itemType === 'product' && item.product) {
                // Update stock (simple decrement)
                 await Product.findByIdAndUpdate(item.product._id, { 
                     $inc: { stock: -item.quantity } 
                 });
            }
        }

        // Create Orders
        const orderPromises = Object.keys(ordersByBusiness).map(async (businessId) => {
            const orderData = ordersByBusiness[businessId];
            const newOrder = new Order({
                business: businessId,
                customer: req.user._id,
                customerName: req.user.name,
                customerEmail: req.user.email,
                items: orderData.items,
                totalAmount: orderData.total,
                status: 'pending',
                history: [{
                    action: 'created',
                    status: 'pending',
                    note: `Order placed. Address: ${address}, Phone: ${phone}`,
                    user: req.user._id
                }]
                // In a real app, store shipping address separately in the order
            });
            return newOrder.save();
        });

        await Promise.all(orderPromises);

        // Clear Cart
        cart.items = [];
        await cart.save();

        res.render('checkout/success', {
            title: 'Order Placed',
            user: req.user
        });

    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'An error occurred during checkout');
        res.redirect('/checkout');
    }
};
