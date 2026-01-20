const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false
  },
  type: {
      type: String,
      enum: ['order', 'internal'],
      default: 'order'
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Operator'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'declined', 'ended'],
    default: 'pending'
  },
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User' // We will store the User ID here. For operators, we store their underlying User ID.
    },
    senderRole: {
        type: String,
        enum: ['customer', 'operator', 'system']
    },
    content: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Chat', ChatSchema);
