const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Film = require('../models/Film');

dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_SEARCH_URL = 'https://api.themoviedb.org/3/search/movie';
const DELAY_MS = 250;
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchPosterPath = async (title) => {
  const url = `${TMDB_SEARCH_URL}?query=${encodeURIComponent(title)}&language=fr-FR&api_key=${TMDB_API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDB ${response.status} : ${response.statusText}`);
  }

  const data = await response.json();
  const firstResult = data.results?.[0];
  return firstResult?.poster_path ?? null;
};

async function backfillPosters() {
  if (!TMDB_API_KEY) {
    console.error('❌ TMDB_API_KEY manquant dans .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');
    if (DRY_RUN) console.log('🧪 Mode DRY RUN : aucune modification ne sera enregistrée');
    if (FORCE) console.log('♻️  Mode FORCE : tous les films seront re-traités');

    const query = FORCE ? {} : { $or: [{ posterPath: { $exists: false } }, { posterPath: null }] };
    const films = await Film.find(query);

    console.log(`🎬 ${films.length} film(s) à traiter`);

    let success = 0;
    let notFound = 0;
    let errors = 0;

    for (const film of films) {
      try {
        const posterPath = await fetchPosterPath(film.title);

        if (!posterPath) {
          console.log(`❓ Pas de résultat TMDB : ${film.title}`);
          notFound++;
        } else {
          console.log(`✅ ${film.title} → ${posterPath}`);
          if (!DRY_RUN) {
            film.posterPath = posterPath;
            await film.save();
          }
          success++;
        }
      } catch (error) {
        console.error(`❌ Erreur pour "${film.title}" :`, error.message);
        errors++;
      }

      await sleep(DELAY_MS);
    }

    console.log('\n📊 Récapitulatif :');
    console.log(`   ✅ Trouvés et ${DRY_RUN ? 'simulés' : 'sauvegardés'} : ${success}`);
    console.log(`   ❓ Sans résultat TMDB : ${notFound}`);
    console.log(`   ❌ Erreurs : ${errors}`);

    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  } catch (error) {
    console.error('❌ Erreur fatale :', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

backfillPosters();