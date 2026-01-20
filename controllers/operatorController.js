const Operator = require('../models/Operator');
const Activity = require('../models/Activity');
const Order = require('../models/Order'); // Assuming tasks/orders will be relevant later
const Chat = require('../models/Chat');
const notificationController = require('./notificationController');

exports.getDashboard = async (req, res) => {
    try {
        // Find the operator profile for the current user
        const operator = await Operator.findOne({ user: req.user._id })
            .populate('business')
            .populate('services');

        if (!operator) {
            // Fallback if role is operator but no operator record exists (edge case)
            req.flash('error_msg', 'Operator profile not found.');
            return res.redirect('/');
        }

        // Fetch recent activities or tasks relevant to this operator
        const recentActivities = await Activity.find({ business: operator.business._id })
            .sort({ createdAt: -1 })
            .limit(5);

        // Calculate real queue length
        const queueCount = await Order.countDocuments({
            operator: operator._id,
            status: { $in: ['pending', 'processing'] }
        });

        // Fetch Pending Chat Requests (Customer Orders)
        const pendingChats = await Chat.find({
            operator: operator._id,
            status: 'pending',
            type: { $ne: 'internal' } // Exclude internal chats from this list
        }).populate('customer', 'name createdAt role isActive');

        // Fetch Internal Chats (Direct Messages from Owner)
        const internalChats = await Chat.find({
            operator: operator._id,
            type: 'internal',
            status: { $in: ['active', 'pending'] }
        }).populate('customer', 'name createdAt role isActive');

        res.render('operator/dashboard', {
            title: 'Operator Dashboard',
            user: req.user,
            operator,
            recentActivities,
            queueCount,
            pendingChats,
            internalChats,
            layout: 'layouts/operator'
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Get Operator Queue
// @route   GET /operator/queue
exports.getQueue = async (req, res) => {
    try {
        const operator = await Operator.findOne({ user: req.user._id });
        if (!operator) {
            return res.redirect('/');
        }

        const activeOrders = await Order.find({
            operator: operator._id,
            status: { $in: ['pending', 'processing'] }
        })
        .populate('customer', 'name email createdAt role isActive')
        .populate('items.service', 'name duration')
        .sort({ createdAt: 1 });

        const completedOrders = await Order.find({
            operator: operator._id,
            status: { $in: ['completed', 'cancelled', 'refunded'] }
        })
        .populate('customer', 'name email createdAt role isActive')
        .populate('items.service', 'name')
        .sort({ createdAt: -1 })
        .limit(10);

        res.render('operator/queue', {
            title: 'Queue Management',
            user: req.user,
            activeOrders,
            completedOrders,
            layout: 'layouts/operator'
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

// @desc    Update Order Status
// @route   POST /operator/queue/:id/status
exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const orderId = req.params.id;
        
        const operator = await Operator.findOne({ user: req.user._id });
        if (!operator) return res.status(403).send('Unauthorized');

        const order = await Order.findOne({ _id: orderId, operator: operator._id });
        if (!order) {
            req.flash('error_msg', 'Order not found or not assigned to you');
            return res.redirect('/operator/queue');
        }

        order.status = status;
        if (status === 'completed') {
            order.completedAt = new Date();
        }
        order.history.push({
            action: 'status_change',
            status: status,
            note: `Status updated to ${status} by operator`,
            user: req.user._id
        });

        await order.save();

        if (order.customer) {
            await notificationController.createNotification(
                order.customer,
                'Order Update',
                `Your order #${order._id.toString().slice(-6).toUpperCase()} is now ${status}.`,
                'order',
                `/orders/${order._id}`
            );
        }

        req.flash('success_msg', `Order marked as ${status}`);
        res.redirect('/operator/queue');

    } catch (err) {
        console.error(err);
        res.redirect('/operator/queue');
    }
};

// @desc    Get Single Order Details
// @route   GET /operator/queue/:id
exports.getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const operator = await Operator.findOne({ user: req.user._id });
        
        if (!operator) {
            return res.redirect('/');
        }

        const order = await Order.findOne({ 
            _id: orderId, 
            operator: operator._id 
        })
        .populate('customer', 'name email phone createdAt role isActive')
        .populate('items.service')
        .populate('business');

        if (!order) {
            req.flash('error_msg', 'Order not found');
            return res.redirect('/operator/queue');
        }

        res.render('operator/show', {
            title: `Order #${order._id.toString().slice(-6).toUpperCase()}`,
            user: req.user,
            order,
            layout: 'layouts/operator'
        });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};
