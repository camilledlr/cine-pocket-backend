const mongoose = require('mongoose');

const listSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  listType: {
    type: String,
    enum: ['Watchlist', 'LikedList','SeenList', 'Customised'],
    default: 'Customised',
  },
  description: {
    type: String,
  },
  favorite: {
    type: Boolean,
    default: false,
  },
  films: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Film',
  }],
}, { timestamps: true });

module.exports = mongoose.model('List', listSchema);

