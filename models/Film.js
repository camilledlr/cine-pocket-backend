const mongoose = require('mongoose');
const { fetchPosterPath } = require('../utils/tmdb');

const filmSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  slug: { type: String, unique: true },
  status: {
    type: String,
    enum: ['to watch', 'watched', 'to_rewatch', 'to_define' ],
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
  tearsLevel: {
    type: Number,
    min: 1,
    max: 5,
  },
  recommendations: {
    type: [String],
  },
  origin: {
    type: String,
  },
  // Année de sortie du film (ex. 2019)
  releaseYear: {
    type: Number,
    min: 1888,
    max: 2100,
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
  watchedDates: {
  type: [Date],
  default: [],
},
  tags: {
    type: [String],
  },
  posterPath: {
    type: String,
  },
}, { timestamps: true });

// Affiche automatique : à la création d'un film (sans affiche fournie) et quand son
// titre change, on cherche l'affiche sur TMDB avant d'enregistrer.
// Un échec (TMDB lent ou indisponible, clé absente) n'empêche jamais l'enregistrement.
filmSchema.pre('save', async function () {
  const isCreation = this.isNew && !this.posterPath;
  const titleChanged = !this.isNew && this.isModified('title');
  if (!isCreation && !titleChanged) return;

  try {
    const posterPath = await fetchPosterPath(this.title);
    // Renommage sans résultat : on garde l'ancienne affiche (souvent une simple correction)
    if (posterPath) this.posterPath = posterPath;
  } catch (error) {
    console.error(`⚠️ Affiche TMDB introuvable pour "${this.title}" :`, error.message);
  }
});

module.exports = mongoose.model('Film', filmSchema);
