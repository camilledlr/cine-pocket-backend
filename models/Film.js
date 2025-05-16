const mongoose = require('mongoose');

const filmSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  slug: { type: String, unique: true },
  status: {
    type: String,
    enum: ['to watch', 'watched', 'to_rewatch'],
    default: 'to watch',
  },
  shortReview: {
    type: String,
  },
  longReview: {
    type: String,
  },
  liked: {
    type: Boolean,
  },
  rating: {
    type: Number,
    min: 1,
    max: 10,
  },
  recommendations: {
    type: [String],
  },
  origin: {
    type: String,
  },
  platform: [
  {
    id: String,
    label: String
  }
],
  actors: {
    type: [String],
  },
  director: {
    type: String,
  },
  hyped: {
    type: Boolean,
  },
  watchedDate: {
    type: Date,
  },
  watchedDates: {
  type: [Date],
  default: [],
},
  tags: {
    type: [String],
  },
}, { timestamps: true });

module.exports = mongoose.model('Film', filmSchema);
