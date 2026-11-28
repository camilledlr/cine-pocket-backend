// Alimente la base de DEV avec des films réalistes.
//
// Les films (titre, réalisateur, acteurs, pays, genres, affiche, recommandations)
// viennent de TMDB ; l'usage (statut, note, dates de visionnage, critiques, plateformes,
// hype, larmes...) est généré aléatoirement de façon vraisemblable.
//
// Usage :
//   npm run seed:dev                 → ajoute 150 films
//   npm run seed:dev -- --count=300  → ajoute 300 films
//   npm run seed:dev -- --dry-run    → affiche ce qui serait ajouté, sans rien écrire
//   npm run seed:dev -- --undo       → supprime les films ajoutés par les seeds précédents
//
// Le script est additif : il n'écrase jamais un film existant (même slug) et refuse
// de tourner sur une base qui n'est pas locale.

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const slugify = require('slugify');

dotenv.config();

const Film = require('../models/Film');
const List = require('../models/List');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const SEED_IDS_FILE = path.join(__dirname, '.seed-ids.json');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const UNDO = args.includes('--undo');
const COUNT = Number((args.find((a) => a.startsWith('--count=')) || '').split('=')[1]) || 150;

// ---------- Référentiels alignés sur les données existantes ----------

const PLATFORMS = [
  { id: 'netflix', label: 'Netflix' },
  { id: 'prime_video', label: 'Prime Video' },
  { id: 'disney_plus', label: 'Disney +' },
  { id: 'arte', label: 'Arte' },
  { id: 'm6', label: 'M6 +' },
  { id: 'universciné', label: 'Universciné' },
  { id: 'vod', label: 'VOD' },
  { id: 'cine', label: 'Au ciné' },
  { id: 'no_dispo', label: 'Indisponible' },
];

const GENRE_TAGS = {
  28: 'action', 12: 'adventure', 16: 'animation', 35: 'comedy', 80: 'crime',
  99: 'documentary', 18: 'drama', 10751: 'family', 14: 'fantasy', 36: 'history',
  27: 'horror', 10402: 'music', 9648: 'mystery', 10749: 'romance', 878: 'sci-fi',
  10770: 'tv-movie', 53: 'thriller', 10752: 'war', 37: 'western',
};

// Codes ISO TMDB → libellés déjà utilisés en base ("USA", "South Korea")
const COUNTRY_NAMES = { US: 'USA', GB: 'UK', KR: 'South Korea' };

const SHORT_REVIEWS = {
  high: [
    'Un chef-d’œuvre, rien à jeter.',
    'Claque monumentale, je ne m’en remets pas.',
    'Mise en scène sublime, acteurs incroyables.',
    'À revoir absolument, encore meilleur que dans mon souvenir.',
    'Le genre de film qui reste en tête des jours.',
  ],
  mid: [
    'Bon moment, quelques longueurs au milieu.',
    'Sympa mais un peu oubliable.',
    'Très beau visuellement, scénario plus convenu.',
    'Une bonne surprise, je ne m’attendais à rien.',
    'Correct, la fin rattrape le reste.',
  ],
  low: [
    'Déçue, trop long pour ce que ça raconte.',
    'Pas du tout accroché.',
    'Beaucoup de bruit pour pas grand-chose.',
    'Je n’ai pas compris l’engouement.',
  ],
};

const LONG_REVIEW_PARTS = [
  'La photographie est vraiment soignée et chaque plan semble pensé.',
  'Le rythme met un peu de temps à s’installer mais la deuxième moitié est haletante.',
  'Les dialogues sonnent juste et les personnages secondaires sont bien écrits.',
  'La bande originale porte énormément les scènes clés.',
  'Le dernier acte divise mais je l’ai trouvé cohérent avec le propos.',
  'L’interprétation principale est impressionnante, tout en retenue.',
  'Quelques facilités scénaristiques, mais rien qui gâche l’ensemble.',
  'Un film qui gagne à être vu au cinéma, sur grand écran.',
];

// ---------- Utilitaires aléatoires ----------

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const chance = (p) => Math.random() < p;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const pickMany = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Date aléatoire dans les 3 dernières années, jamais dans le futur
const randomPastDate = () => {
  const now = Date.now();
  const threeYears = 3 * 365 * 24 * 3600 * 1000;
  return new Date(now - Math.random() * threeYears);
};

const pickStatus = () => {
  const r = Math.random();
  if (r < 0.5) return 'watched';
  if (r < 0.85) return 'to watch';
  if (r < 0.95) return 'to_rewatch';
  return 'to_define';
};

// ---------- TMDB ----------

async function tmdb(endpoint, params = {}) {
  const query = new URLSearchParams({ api_key: TMDB_API_KEY, language: 'fr-FR', ...params });
  const response = await fetch(`${TMDB_BASE}${endpoint}?${query}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`TMDB ${response.status} sur ${endpoint}`);
  return response.json();
}

// Récupère des IDs TMDB variés : mélange des films les mieux notés et des films populaires
async function collectTmdbIds(target) {
  const ids = new Set();
  const sources = ['/movie/top_rated', '/movie/popular'];
  let page = 1;

  while (ids.size < target && page <= 50) {
    for (const source of sources) {
      const data = await tmdb(source, { page });
      data.results.forEach((m) => ids.add(m.id));
    }
    page++;
    await sleep(50);
  }
  return [...ids].sort(() => Math.random() - 0.5);
}

// ---------- Génération d'un film ----------

function buildFilm(details) {
  const status = pickStatus();
  const tags = details.genres.map((g) => GENRE_TAGS[g.id]).filter(Boolean);
  const country = details.production_countries?.[0];

  const film = {
    title: details.title,
    slug: slugify(details.title, { lower: true, strict: true }),
    status,
    director: details.credits?.crew?.find((c) => c.job === 'Director')?.name,
    actors: (details.credits?.cast || []).slice(0, rand(2, 4)).map((a) => a.name),
    origin: country ? COUNTRY_NAMES[country.iso_3166_1] || country.name : undefined,
    tags,
    releaseYear: Number(details.release_date?.slice(0, 4)) || undefined,
    posterPath: details.poster_path || undefined,
    recommendations: (details.recommendations?.results || []).slice(0, rand(0, 3)).map((m) => m.title),
    platform: chance(0.8) ? pickMany(PLATFORMS, rand(1, 2)) : [],
    hyped: false,
    watchedDates: [],
  };

  if (status === 'watched' || status === 'to_rewatch') {
    // Plusieurs visionnages pour certains films, du plus ancien au plus récent
    const views = chance(0.2) ? rand(2, 3) : 1;
    film.watchedDates = Array.from({ length: views }, randomPastDate).sort((a, b) => a - b);

    // Note corrélée à la note TMDB, avec un peu de subjectivité. ~15 % restent sans note
    // pour alimenter la route /to-review.
    if (chance(0.85)) {
      film.rating = clamp(Math.round(details.vote_average + rand(-2, 1)), 1, 10);
      film.liked = film.rating >= 8 ? chance(0.85) : chance(0.1);

      const tier = film.rating >= 8 ? 'high' : film.rating >= 5 ? 'mid' : 'low';
      if (chance(0.7)) film.shortReview = pick(SHORT_REVIEWS[tier]);
      if (chance(0.4)) film.longReview = pickMany(LONG_REVIEW_PARTS, rand(2, 4)).join(' ');
    }

    // Les drames font plus pleurer
    const tearsChance = tags.includes('drama') || tags.includes('romance') ? 0.7 : 0.25;
    if (chance(tearsChance)) film.tearsLevel = tags.includes('drama') ? rand(2, 5) : rand(1, 3);
  } else if (status === 'to watch') {
    film.hyped = chance(0.3);
  }

  return film;
}

// ---------- Listes ----------

async function getOrCreateList(listType, title) {
  return List.findOneAndUpdate(
    { listType },
    { $setOnInsert: { title, listType, films: [] } },
    { upsert: true, new: true }
  );
}

async function addToList(listId, filmIds) {
  if (filmIds.length) await List.updateOne({ _id: listId }, { $addToSet: { films: { $each: filmIds } } });
}

// ---------- Sécurité ----------

function assertLocalDatabase() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI manquant dans .env');
    process.exit(1);
  }
  const host = MONGODB_URI.replace(/^mongodb(\+srv)?:\/\/([^@/]*@)?/, '').split(/[/?]/)[0];
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
    console.error(`❌ Refusé : la base pointée (${host}) n'est pas locale. Ce script est réservé au dev.`);
    process.exit(1);
  }
}

// ---------- Undo ----------

async function undo() {
  if (!fs.existsSync(SEED_IDS_FILE)) {
    console.log('ℹ️  Aucun seed à annuler (fichier .seed-ids.json absent).');
    return;
  }
  const { filmIds = [], listIds = [] } = JSON.parse(fs.readFileSync(SEED_IDS_FILE, 'utf-8'));

  await List.updateMany({}, { $pull: { films: { $in: filmIds } } });
  const { deletedCount } = await Film.deleteMany({ _id: { $in: filmIds } });
  const lists = await List.deleteMany({ _id: { $in: listIds } });
  fs.unlinkSync(SEED_IDS_FILE);

  console.log(`🧹 ${deletedCount} film(s) et ${lists.deletedCount} liste(s) de seed supprimés.`);
}

// ---------- Seed ----------

async function seed() {
  if (!TMDB_API_KEY) {
    console.error('❌ TMDB_API_KEY manquant dans .env');
    process.exit(1);
  }
  if (DRY_RUN) console.log('🧪 Mode DRY RUN : rien ne sera écrit');

  const existingSlugs = new Set((await Film.find({}, { slug: 1 }).lean()).map((f) => f.slug));
  console.log(`📚 ${existingSlugs.size} film(s) déjà en base, objectif : +${COUNT}`);

  // On demande un peu plus d'IDs que nécessaire pour compenser les doublons
  const tmdbIds = await collectTmdbIds(COUNT + existingSlugs.size + 20);

  const films = [];
  for (const id of tmdbIds) {
    if (films.length >= COUNT) break;
    try {
      const details = await tmdb(`/movie/${id}`, { append_to_response: 'credits,recommendations' });
      const film = buildFilm(details);
      if (!film.slug || existingSlugs.has(film.slug)) continue;
      existingSlugs.add(film.slug);
      films.push(film);
      process.stdout.write(`\r🎬 ${films.length}/${COUNT} films préparés`);
    } catch (error) {
      console.error(`\n⚠️  Film TMDB ${id} ignoré : ${error.message}`);
    }
    await sleep(40);
  }
  console.log('');

  const byStatus = films.reduce((acc, f) => ({ ...acc, [f.status]: (acc[f.status] || 0) + 1 }), {});
  console.log('📊 Répartition :', byStatus);

  if (DRY_RUN) {
    console.log('Exemple :', JSON.stringify(films[0], null, 2));
    return;
  }

  // insertMany ne déclenche pas le hook pre('save') : pas d'appel TMDB en double pour les affiches
  const inserted = await Film.insertMany(films);
  const ids = (filter) => inserted.filter(filter).map((f) => f._id);

  const watchlist = await getOrCreateList('Watchlist', 'Ma Watchlist');
  const seenlist = await getOrCreateList('SeenList', 'Films vus');
  await addToList(watchlist._id, ids((f) => f.status === 'to watch' || f.status === 'to_rewatch'));
  await addToList(seenlist._id, ids((f) => f.status === 'watched' || f.status === 'to_rewatch'));

  // Quelques listes personnalisées pour tester l'affichage des listes
  const customLists = await List.insertMany([
    { title: 'Coups de cœur', description: 'Les films qui m’ont marquée', favorite: true, films: ids((f) => f.liked) },
    { title: 'Soirée frissons', description: 'Horreur et thrillers', films: ids((f) => f.tags.some((t) => ['horror', 'thriller'].includes(t))) },
    { title: 'Pour pleurer un bon coup', films: ids((f) => f.tearsLevel >= 4) },
  ]);

  // On garde la trace de ce qui a été ajouté pour pouvoir l'annuler avec --undo
  const previous = fs.existsSync(SEED_IDS_FILE) ? JSON.parse(fs.readFileSync(SEED_IDS_FILE, 'utf-8')) : {};
  fs.writeFileSync(SEED_IDS_FILE, JSON.stringify({
    filmIds: [...(previous.filmIds || []), ...inserted.map((f) => f._id.toString())],
    listIds: [...(previous.listIds || []), ...customLists.map((l) => l._id.toString())],
  }, null, 2));

  console.log(`✅ ${inserted.length} film(s) ajoutés, Watchlist/SeenList mises à jour, ${customLists.length} listes perso créées.`);
}

async function main() {
  assertLocalDatabase();
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');
    await (UNDO ? undo() : seed());
  } catch (error) {
    console.error('❌ Erreur fatale :', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

main();
