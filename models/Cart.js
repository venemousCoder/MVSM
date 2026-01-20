const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
    operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Operator'
    },
    itemType: {
      type: String,
      enum: ['product', 'service'],
      required: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    name: { // Store name snapshot for display if item is deleted
      type: String
    }
  }],
  totalPrice: {
    type: Number,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate total price before saving
CartSchema.pre('save', function() {
  this.totalPrice = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
  this.updatedAt = Date.now();
});

const Cart = mongoose.model('Cart', CartSchema);

module.exports = Cart;
