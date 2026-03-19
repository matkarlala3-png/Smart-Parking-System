const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  feedback: { type: String, required: true },
  rating: { type: Number, default: 5 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Feedback', FeedbackSchema);
