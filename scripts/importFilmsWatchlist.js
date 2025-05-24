const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const Film = require('../models/Film');
const List = require('../models/List');

dotenv.config();

const jsonPath = './scripts/films_watchlist.json'; // ton fichier JSON avec les films

async function importFilms() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    const watchlist = await List.findOneAndUpdate(
      { listType: 'Watchlist' },
      { $setOnInsert: { title: 'Ma Watchlist', listType: 'Watchlist', films: [] } },
      { upsert: true, new: true }
    );

    for (const filmData of data) {
      const existing = await Film.findOne({ slug: filmData.slug });

      if (!existing) {
        const film = new Film(filmData);
        const saved = await film.save();
        watchlist.films.push(saved._id);
        console.log(`🎬 Film ajouté : ${saved.title}`);
      } else {
        console.log(`⚠️ Déjà en base : ${filmData.title}`);
      }
    }

    await watchlist.save();
    console.log('📥 Films ajoutés à la Watchlist');

    mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  } catch (error) {
    console.error('❌ Erreur lors de l’importation :', error);
    mongoose.disconnect();
  }
}

importFilms();