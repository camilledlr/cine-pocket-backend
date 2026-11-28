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
  // true : liste personnalisée dont l'ordre des films est un classement (« Mes Tops »)
  ranked: {
    type: Boolean,
    default: false,
  },
  films: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Film',
  }],
}, { timestamps: true });

module.exports = mongoose.model('List', listSchema);

