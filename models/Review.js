const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Polymorphic reference pattern
  targetType: {
    type: String,
    enum: ['product', 'service', 'operator'],
    required: true
  },
  order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
  },
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
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true
  },
  reply: {
    type: String
    // Business owner's response
  },
  isReported: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'hidden'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Review = mongoose.model('Review', ReviewSchema);

module.exports = Review;
