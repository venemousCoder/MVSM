const Service = require('../models/Service');
const Operator = require('../models/Operator');
const Cart = require('../models/Cart');
const Order = require('../models/Order');

// @desc    Get Chat Interface
// @route   GET /services/:id/chat
exports.getChat = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id).populate('business');
        if (!service) {
            return res.redirect('/');
        }

        let operator = null;
        if (req.query.operatorId) {
            operator = await Operator.findById(req.query.operatorId).populate('user');
        }

        let script = service.script;

        // Check if script is from Builder (Nodes is Array) and transform it
        if (script && Array.isArray(script.nodes)) {
            script = transformBuilderScript(script);
        }

        // Mock Script if invalid
        if (!script || Object.keys(script).length === 0 || !script.startNodeId) {
            script = {
                "startNodeId": "start",
                "nodes": {
                    "start": {
                        "text": `Welcome to ${service.business.name}! What specific service would you like today?`,
                        "options": [
                            { "label": "Printing", "next": "printing", "value": "Printing" },
                            { "label": "Scanning", "next": "scanning", "value": "Scanning" },
                            { "label": "Binding", "next": "binding", "value": "Binding" }
                        ]
                    },
                    "printing": {
                        "text": "What type of printing?",
                        "options": [
                            { "label": "Black & White ($0.10/page)", "next": "copies", "value": "BW", "priceMod": 0.10 },
                            { "label": "Color ($0.50/page)", "next": "copies", "value": "Color", "priceMod": 0.50 }
                        ]
                    },
                    "scanning": {
                         "text": "How many pages to scan?",
                         "inputType": "number",
                         "next": "upload"
                    },
                    "binding": {
                         "text": "Select binding type",
                         "options": [
                             { "label": "Spiral", "next": "finish", "value": "Spiral" },
                             { "label": "Hardcover", "next": "finish", "value": "Hardcover" }
                         ]
                    },
                    "copies": {
                        "text": "How many copies?",
                        "inputType": "number",
                        "next": "upload"
                    },
                    "upload": {
                        "text": "Please upload your document (Mock Upload)",
                        "inputType": "file",
                        "next": "finish"
                    },
                    "finish": {
                        "text": "Great! We have your details. Place Order Now?",
                        "isFinal": true
                    }
                }
            };
        }

        res.render('chat/interface', {
            title: 'Service Request',
            user: req.user,
            service,
            operator,
            script: script
        });

    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};

function transformBuilderScript(builderData) {
    const runtime = { startNodeId: null, nodes: {} };
    const nodes = builderData.nodes || [];
    const connections = builderData.connections || [];

    // 1. Process Nodes
    nodes.forEach(n => {
        if (n.type === 'start') return; // Start node in builder is just a trigger, not a chat step

        const node = {
            text: n.data.question_text || '...',
            inputType: n.data.input_type // multiple_choice, yes_no, number, file_upload
        };

        if (n.data.input_type === 'multiple_choice') {
            node.options = (n.data.answer_options || []).map(opt => ({ label: opt, value: opt }));
            delete node.inputType; // Handled via options
        } else if (n.data.input_type === 'yes_no') {
            node.options = [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
            ];
            delete node.inputType;
        } else if (n.data.input_type === 'file_upload') {
            node.inputType = 'file';
        }

        runtime.nodes[n.id] = node;
    });

    // 2. Process Connections to link nodes
    connections.forEach(conn => {
        const sourceNode = nodes.find(n => n.id === conn.source);
        if (!sourceNode) return;

        // Case A: Start Node connection sets the entry point
        if (sourceNode.type === 'start') {
            runtime.startNodeId = conn.target;
            return;
        }

        // Case B: Question Nodes
        const runtimeNode = runtime.nodes[conn.source];
        if (!runtimeNode) return;

        if (sourceNode.data.input_type === 'multiple_choice') {
            // port 'out_opt_0' -> index 0
            if (conn.sourcePort && conn.sourcePort.startsWith('out_opt_')) {
                const idx = parseInt(conn.sourcePort.split('_').pop());
                if (runtimeNode.options && runtimeNode.options[idx]) {
                    runtimeNode.options[idx].next = conn.target;
                }
            }
        } else if (sourceNode.data.input_type === 'yes_no') {
            // port 'out_yes' -> index 0 (Yes), 'out_no' -> index 1 (No)
            if (conn.sourcePort === 'out_yes') runtimeNode.options[0].next = conn.target;
            if (conn.sourcePort === 'out_no') runtimeNode.options[1].next = conn.target;
        } else {
            // number, file -> single output
            runtimeNode.next = conn.target;
        }
    });

    // 3. Ensure Completion
    // If a node expects input (options/inputType) but has no 'next', it implies the flow should end after that input.
    // Instead of marking the question node as Final (which hides inputs), we link it to a synthetic Final node.
    
    const FINISH_ID = 'generated_finish_node';
    let addedFinishNode = false;

    Object.values(runtime.nodes).forEach(node => {
        // Check Options (Yes/No, Multiple Choice)
        if (node.options) {
            node.options.forEach(opt => {
                if (!opt.next) {
                    opt.next = FINISH_ID;
                    addedFinishNode = true;
                }
            });
        }
        // Check Direct Next (Number, File)
        else if (node.inputType) {
             if (!node.next) {
                 node.next = FINISH_ID;
                 addedFinishNode = true;
             }
        }
        // Fallback for others (though Builder mainly produces questions)
        else if (!node.isFinal && !node.next) {
             // If it's a text node without a next link, make it final or link to finish
             // If it has no text, it's weird. But let's assume if it has no inputs, it's final.
             node.isFinal = true;
             if (!node.text) node.text = "Complete.";
        }
    });

    if (addedFinishNode) {
        runtime.nodes[FINISH_ID] = {
            text: "Thank you! Your request is ready to be placed.",
            isFinal: true
        };
    }

    return runtime;
}

// @desc    Process Chat Completion (Direct Order)
// @route   POST /services/:id/chat/complete
exports.postChatComplete = async (req, res) => {
    try {
        const { operatorId, transcript, summary, answers } = req.body;
        const service = await Service.findById(req.params.id);

        if (!service) return res.status(404).json({ error: 'Service not found' });

        // Check for existing active booking
        const existingOrder = await Order.findOne({
            customer: req.user._id,
            'items.service': service._id,
            status: { $in: ['pending', 'processing'] }
        });

        if (existingOrder) {
            return res.status(400).json({ error: 'You already have an active booking for this service. Please wait until it is completed.' });
        }

        let quantity = 1;
        let details = '';

        if (answers && Array.isArray(answers) && answers.length > 0) {
            // Process structured answers
            const detailsParts = [];
            
            for (const item of answers) {
                // Construct "Question: Answer" string
                // Clean up question text (remove extra whitespace)
                const question = item.question ? item.question.trim() : 'Question';
                const answer = item.answer;
                
                detailsParts.push(`${question}: ${answer}`);

                // Try to extract quantity if type is number or question asks for quantity/copies
                if (item.type === 'number' || (question.toLowerCase().includes('how many') || question.toLowerCase().includes('copies'))) {
                    const num = parseInt(answer);
                    if (!isNaN(num) && num > 0) {
                        quantity = num;
                    }
                }
            }
            details = detailsParts.join('; ');
        } else {
            // Fallback to legacy summary processing
            const summaryParts = summary.split(',');
            for (let part of summaryParts) {
                const num = parseInt(part.trim());
                if (!isNaN(num)) quantity = num;
            }
            details = summary || 'Custom Request';
        }

        const totalAmount = service.price * quantity;

        const newOrder = new Order({
            business: service.business,
            customer: req.user._id,
            customerName: req.user.name,
            customerEmail: req.user.email,
            operator: operatorId || undefined,
            items: [{
                service: service._id,
                name: `${service.name} (${details})`,
                quantity: quantity,
                price: service.price
            }],
            totalAmount: totalAmount,
            status: 'pending',
            history: [{
                action: 'created',
                status: 'pending',
                note: 'Order placed via Service Chat',
                user: req.user._id
            }]
        });

        const savedOrder = await newOrder.save();

        res.json({ success: true, redirect: `/services/confirmation/${savedOrder._id}` });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Service Confirmation Page
// @route   GET /services/confirmation/:orderId
exports.getServiceConfirmation = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate('business')
            .populate('operator')
            .populate({
                path: 'operator',
                populate: { path: 'user' } 
            })
            .populate('items.service');

        if (!order) {
            return res.redirect('/');
        }
        
        if (order.customer.toString() !== req.user._id.toString()) {
             return res.redirect('/');
        }

        // 1. Fetch Full Queue
        let query = {
            business: order.business._id,
            status: { $in: ['pending', 'processing'] }
        };

        if (order.operator) {
            query.operator = order.operator._id;
        }

        const fullQueue = await Order.find(query)
            .select('customerName items createdAt status')
            .sort({ createdAt: 1 });

        // 2. Find My Position
        const myIndex = fullQueue.findIndex(o => o._id.toString() === order._id.toString());
        const queuePosition = myIndex + 1;

        // 3. Build Display List (Focus on surrounding orders)
        // Let's show up to 2 before and 1 after, or just the whole list if small.
        // For privacy, mask names of others.
        
        let serviceDuration = 15;
        if (order.items.length > 0 && order.items[0].service && order.items[0].service.duration) {
            serviceDuration = order.items[0].service.duration;
        }

        const queueList = fullQueue.map((o, index) => {
            const isMe = index === myIndex;
            const relativePos = index - myIndex; // negative = ahead, positive = behind
            
            // Calculate est start based on position relative to now (assuming index 0 started "now" or earlier)
            // If index 0 is processing, maybe it started a while ago.
            // Simplified: Est start = index * duration.
            const minsFromNow = index * serviceDuration;
            
            let timeText = `Est. start: ${minsFromNow} mins`;
            if (o.status === 'processing') {
                timeText = 'Started: Recently';
            } else if (index === 0 && o.status === 'pending') {
                timeText = 'Starting soon';
            }

            return {
                id: o._id.toString().slice(-4),
                name: isMe ? 'YOU' : `Customer #${o._id.toString().slice(-4)}`,
                service: o.items[0] ? o.items[0].name.split('(')[0].trim() : 'Service',
                timeText: timeText,
                isMe: isMe,
                status: o.status
            };
        });

        // Filter to show relevant slice? Or show all if reasonable.
        // Let's show a slice around me to avoid huge lists.
        const start = Math.max(0, myIndex - 2);
        const end = Math.min(queueList.length, myIndex + 3);
        const displayQueue = queueList.slice(start, end);

        const estWait = myIndex * serviceDuration;

        // Extract Timestamps
        const startedEvent = order.history.find(h => h.status === 'processing');
        const startedAt = startedEvent ? startedEvent.createdAt : null;
        
        const completedEvent = order.history.find(h => h.status === 'completed');
        const completedAt = completedEvent ? completedEvent.createdAt : null;

        res.render('services/confirmation', {
            title: 'Service Status',
            user: req.user,
            order,
            queuePosition,
            estWait,
            queueList: displayQueue,
            startedAt,
            completedAt
        });

    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
};
