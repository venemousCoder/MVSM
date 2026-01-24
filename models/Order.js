const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Cache customer details for search/archive
  customerName: String,
  customerEmail: String,
  
  invoiceNumber: {
    type: String,
    // unique: true // sparse/unique index can be tricky if not set immediately, leaving as simple string for now
  },

  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    },
    name: String, 
    quantity: {
      type: Number,
      required: true,
      default: 1
    },
    price: {
      type: Number,
      required: true
    }
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'paystack'],
    default: 'cod'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  paymentReference: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Operator'
  },
  history: [{
      action: String, // 'created', 'status_change', 'note', 'email_sent'
      status: String,
      note: String,
      user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
      },
      createdAt: {
          type: Date,
          default: Date.now
      }
  }],
  completedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;
