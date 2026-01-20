const Chat = require('../models/Chat');
const Order = require('../models/Order');
const Operator = require('../models/Operator');
const User = require('../models/User');
const notificationController = require('./notificationController');

// @desc    Request a chat with the operator
// @route   POST /orders/:id/chat/request
exports.requestChat = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId).populate('operator');

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check if chat already exists
        let chat = await Chat.findOne({ order: orderId });

        if (!chat) {
            chat = new Chat({
                order: orderId,
                customer: req.user._id,
                operator: order.operator ? order.operator._id : null,
                status: 'pending',
                messages: [{
                    senderRole: 'system',
                    content: 'Chat request sent. Waiting for operator...'
                }]
            });
            await chat.save();

            // Notify Operator via Socket
            const io = req.app.get('socketio');
            if (order.operator) {
                io.to(`operator_${order.operator._id}`).emit('new_chat_request', {
                    chatId: chat._id,
                    orderId: order._id,
                    customerName: req.user.name
                });
            }
        } else if (chat.status === 'ended' || chat.status === 'declined') {
             // Restart chat? For now, let's just re-open or create new if logic permits. 
             // Simplest: Reset status to pending
             chat.status = 'pending';
             chat.messages.push({
                 senderRole: 'system',
                 content: 'Chat request resent.'
             });
             await chat.save();
             
             const io = req.app.get('socketio');
             if (order.operator) {
                io.to(`operator_${order.operator._id}`).emit('new_chat_request', {
                    chatId: chat._id,
                    orderId: order._id,
                    customerName: req.user.name
                });
            }
        }

        res.redirect(`/orders/${orderId}/chat`);

    } catch (err) {
        console.error(err);
        res.status(500).render('error/500');
    }
};

// @desc    Get Chat Room
// @route   GET /orders/:id/chat
exports.getChatRoom = async (req, res) => {
    try {
        const identifier = req.params.id || req.params.chatId; // Support both param names
        
        let chat = null;
        let order = null;

        // Try to find by ID (Chat ID)
        if (identifier && identifier.match(/^[0-9a-fA-F]{24}$/)) {
            chat = await Chat.findById(identifier)
                .populate('customer')
                .populate({
                    path: 'operator',
                    populate: { path: 'user' }
                });
        }

        // If not found by ID, or if we want to support finding by Order ID (legacy/primary for orders)
        if (!chat) {
             chat = await Chat.findOne({ order: identifier })
                .populate('customer')
                .populate({
                    path: 'operator',
                    populate: { path: 'user' }
                });
        }

        if (chat && chat.order) {
            order = await Order.findById(chat.order);
        } else if (identifier && identifier.match(/^[0-9a-fA-F]{24}$/) && !chat) {
             // Check if identifier is order ID
             order = await Order.findById(identifier);
             if (order) {
                 // Chat doesn't exist for this order yet, or pending logic handled elsewhere?
                 // But here we are entering a room. If no chat, redirect.
                 return res.redirect(`/services/confirmation/${order._id}`);
             }
        }

        if (!chat) {
            return res.redirect('/');
        }
        
        // Security check
        const isCustomer = chat.customer._id.toString() === req.user._id.toString();
        
        let isOperator = false;
        if (chat.operator && chat.operator.user && chat.operator.user._id.toString() === req.user._id.toString()) {
            isOperator = true;
        }

        if (!isCustomer && !isOperator) {
             return res.redirect('/');
        }
        
        let apiPrefix = '';
        if (chat.type === 'internal') {
            if (isOperator) {
                apiPrefix = `/operator/chat/${chat._id}`;
            } else {
                apiPrefix = `/sme/chats/live/${chat._id}`;
            }
        } else {
            // Order chat
            apiPrefix = `/orders/${order ? order._id : identifier}/chat`;
        }

        res.render('chat/live', {
            title: chat.type === 'internal' ? 'Internal Chat' : 'Live Chat',
            chat,
            order,
            user: req.user,
            isOperator,
            isCustomer,
            roomId: chat._id, // Use chat ID as room for socket consistently? If view uses roomId for socket.emit('join_room', roomId).
            // NOTE: Existing order chats use orderId as room. Internal use chatId.
            // If I change roomId to chat._id, I break existing pending/active chats unless I migrate/change server logic.
            // Server socket: `socket.join(room)`. `saveMessage(room, ...)` -> finds chat by `room` (which is now either order or chat ID).
            // So if I use `chat._id` here, `saveMessage` works (it checks `_id`).
            // `join_room` works.
            // The only issue: Other participants (Operator) joining via `orderId` if they use old link?
            // Operator dashboard links: `/orders/ORDERID/chat`.
            // So they join `orderId` room.
            // If I change this to `chat._id`, they join `chat._id` room.
            // If both sides join same room, good.
            // If internal, room MUST be chat._id.
            // If order, let's KEEP `order._id` to be safe with existing links/logic unless I update ALL links.
            // Wait, saveMessage logic I updated handles both.
            // So if customer is in `orderId` room and operator in `orderId` room -> works.
            // If internal, customer in `chatId` room, operator in `chatId` room -> works.
            roomId: (chat.type === 'internal' || !order) ? chat._id : order._id,
            apiPrefix
        });

    } catch (err) {
        console.error(err);
        res.status(500).render('error/500');
    }
};

// @desc    Operator Respond to Chat (Accept/Decline)
// @route   POST /orders/:id/chat/respond
exports.respondChat = async (req, res) => {
    try {
        const { action } = req.body; // 'accept' or 'decline'
        const orderId = req.params.id;
        
        const chat = await Chat.findOne({ order: orderId });
        if (!chat) return res.status(404).json({ error: 'Chat not found' });

        if (action === 'accept') {
            chat.status = 'active';
            chat.messages.push({
                senderRole: 'system',
                content: 'Operator has joined the chat.'
            });
        } else if (action === 'decline') {
            chat.status = 'declined';
            chat.messages.push({
                senderRole: 'system',
                content: 'Operator is unavailable at the moment.'
            });
        }

        await chat.save();

        // Notify Customer
        if (chat.customer) {
            const msg = action === 'accept' ? 'Operator has joined your chat.' : 'Operator declined your chat request.';
            await notificationController.createNotification(
                chat.customer,
                'Chat Update',
                msg,
                'chat',
                `/orders/${orderId}/chat`
            );
        }

        const io = req.app.get('socketio');
        io.to(orderId).emit('chat_status_change', { status: chat.status });

        res.json({ success: true, status: chat.status });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Close Chat
// @route   POST /orders/:id/chat/close
exports.closeChat = async (req, res) => {
    try {
        const orderId = req.params.id;
        const chat = await Chat.findOne({ order: orderId });

        if (!chat) return res.status(404).json({ error: 'Chat not found' });

        chat.status = 'ended';
        chat.messages.push({
            senderRole: 'system',
            content: 'Chat ended by operator.'
        });

        await chat.save();

        const io = req.app.get('socketio');
        io.to(orderId).emit('chat_status_change', { status: chat.status });

        res.json({ success: true, status: chat.status });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Save Message (called via AJAX or handled via Socket if we do full socket)
// We will use this to persist messages sent via socket
exports.saveMessage = async (roomId, userId, content, role) => {
    try {
        // roomId could be a Chat ID (Internal) or an Order ID (Service)
        // We try to find the chat by ID first, then by Order.
        let chat = null;
        
        // Check if roomId is valid ObjectId
        if (roomId.match(/^[0-9a-fA-F]{24}$/)) {
            chat = await Chat.findOne({
                $or: [
                    { _id: roomId },
                    { order: roomId }
                ]
            });
        }

        if (chat) {
            chat.messages.push({
                sender: userId,
                senderRole: role,
                content: content
            });
            await chat.save();
            return true;
        }
        return false;
    } catch (err) {
        console.error("Error saving message", err);
        return false;
    }
};
