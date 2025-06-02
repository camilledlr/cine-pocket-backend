const express = require('express');
const router = express.Router();
const Film = require('../../models/Film');
const List = require('../../models/List');
const slugify = require('slugify');

// GET /api/films/all-titles
router.get('/all-titles', async (req, res) => {
  console.log("req body", req.body);
  try {
    const films = await Film.find({}, { _id: 1, title: 1, slug: 1, status :1 }).lean();
    res.json(films);
  } catch (err) {
    console.error('❌ Erreur récupération des titres :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /filters-data
router.get('/filters-data', async (req, res) => {
  try {
    const directors = await Film.distinct("director", { director: { $ne: null } });
    const origins = await Film.distinct("origin", { origin: { $ne: null } });
    const tags = await Film.distinct("tags", { tags: { $ne: null } });

    // Pour extraire tous les labels de plateforme
    const films = await Film.find({ "platform.label": { $exists: true } }, "platform.label");
    const platformLabels = [...new Set(
      films.flatMap(film => film.platform.map(p => p.label).filter(Boolean))
    )];

    res.json({
      directors: directors.sort(),
      origins: origins.sort(),
      platforms: platformLabels.sort(),
      tags: tags.sort(),
    });
  } catch (error) {
    console.error("Erreur récupération filtres :", error);
    res.status(500).json({ error: "Erreur lors du chargement des filtres" });
  }
});


// @route   POST /api/films
// @desc    Ajouter un nouveau film
// @access  Public (ou Private plus tard)
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    const slug = slugify(title, { lower: true, strict: true });
    const newFilm = new Film({ ...req.body, slug });
    const savedFilm = await newFilm.save();
    res.status(201).json(savedFilm);
  } catch (error) {
    console.error('Erreur lors de la création du film :', error);
    res.status(400).json({ error: error.message });
  }
});

// @route   GET /api/films/slug/:slug
// @desc    Récupérer un film par son slug
// @access  Public
router.get('/slug/:slug', async (req, res) => {
  try {
    const film = await Film.findOne({ slug: req.params.slug });

    if (!film) {
      return res.status(404).json({ error: 'Film non trouvé' });
    }

    res.json(film);
  } catch (error) {
    console.error('❌ Erreur lors de la recherche du film par slug :', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/films/id/:id
// @desc    Récupérer un film par son ID
// @access  Public
router.get('/id/:id', async (req, res) => {
  try {
    const film = await Film.findById(req.params.id);

    if (!film) {
      return res.status(404).json({ error: 'Film non trouvé' });
    }

    res.json(film);
  } catch (error) {
    console.error('❌ Erreur lors de la recherche du film par ID :', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   PUT /api/films/add-to-watchlist
// @desc    Ajoute un film à la Watchlist (le crée s’il n’existe pas)
// @access  Public
router.put('/add-to-watchlist', async (req, res) => {
  const { filmId, title, slug } = req.body;

  try {
    let film;

    // 1. Récupération ou création du film
    if (filmId) {
      film = await Film.findById(filmId);
    } else if (slug) {
      film = await Film.findOne({ slug });
      if (!film) {
        film = new Film({ title, slug, status:"to watch" });
        await film.save();
      }
    } else {
      return res.status(400).json({ error: 'Il faut fournir un identifiant de film (id ou slug).' });
    }

    // 2. On change le statut du film s’il n’est pas déjà "to watch"
    if (film.status === 'watched') {
      film.status = 'to_rewatch';
      await film.save();
    }

    // 3. Ajout à la watchlist
    let watchlist = await List.findOne({ listType: 'Watchlist' });
    if (!watchlist) {
      watchlist = new List({
        title: 'Ma Watchlist',
        listType: 'Watchlist',
        films: [],
      });
    }
// Éviter les doublons dans la watchlist
if (watchlist.films.includes(film._id)) {
  return res.status(400).json({ error: 'Le film est déjà dans la Watchlist.', film });
}
    if (!watchlist.films.includes(film._id)) {
      watchlist.films.push(film._id);
      await watchlist.save();
    }

    // 4. On renvoie le film mis à jour
    res.status(200).json({message: 'Film ajouté à la Watchlist', film});

  } catch (error) {
    console.error('❌ Erreur lors de l’ajout du film à la Watchlist :', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   PUT /api/films/toggle-hype/:id
// @desc    Toggle (inverse) l'attribut "hyped" d'un film
// @access  Public (ou Private selon ton projet)
router.put('/toggle-hype/:id', async (req, res) => {
  try {
    const filmId = req.params.id;

    // On récupère le film par son id
    let film = await Film.findById(filmId);

    if (!film) {
      return res.status(404).json({ error: 'Film non trouvé' });
    }

    // Si hyped est true -> false, sinon true (y compris si undefined)
    film.hyped = !film.hyped;
    await film.save();

    res.status(200).json({ message: 'Hyped modifié', film });
  } catch (error) {
    console.error('Erreur lors du changement de hyped :', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
// @route   PUT /api/films/toggle-like/:id
// @access  Public (ou Private selon ton projet)
router.put('/toggle-like/:id', async (req, res) => {
  try {
    const filmId = req.params.id;

    // On récupère le film par son id
    let film = await Film.findById(filmId);

    if (!film) {
      return res.status(404).json({ error: 'Film non trouvé' });
    }

    // Si hyped est true -> false, sinon true (y compris si undefined)
    film.liked = !film.liked;
    await film.save();

    res.status(200).json({ message: 'Like modifié', film });
  } catch (error) {
    console.error('Erreur lors du changement de like :', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:filmId/add-reco', async (req, res) => {
  const { filmId } = req.params;
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Le texte de la recommandation est requis.' });
  }

  try {
    const film = await Film.findById(filmId);
    if (!film) {
      return res.status(404).json({ error: 'Film non trouvé.' });
    }

    film.recommendations.push(text);
    await film.save();

    res.status(200).json({
      message: 'Recommandation ajoutée.',
      recommendations: film.recommendations,
    });
  } catch (error) {
    console.error('❌ Erreur lors de l’ajout de la recommandation :', error.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/:id/update-infos', async (req, res) => {
  console.log("req body", req.body);
  const { id } = req.params;
  const { director, actors, origin } = req.body;

  if (!director && !actors) {
    return res.status(400).json({ error: "Il faut fournir un réalisateur, des acteurs, ou les deux." });
  }

  try {
    const updatedFields = {};

    if (director !== undefined) {
      updatedFields.director = director;
    }
    if (origin !== undefined) {
      updatedFields.origin = origin;
    }
    if (director !== undefined) {
      updatedFields.director = director;
    }

    if (actors !== undefined) {
      if (!Array.isArray(actors)) {
        return res.status(400).json({ error: "Le champ 'actors' doit être un tableau." });
      }
      updatedFields.actors = actors;
    }

    const updatedFilm = await Film.findByIdAndUpdate(
      id,
      { $set: updatedFields },
      { new: true }
    );

    if (!updatedFilm) {
      return res.status(404).json({ error: "Film introuvable." });
    }

    res.status(200).json({
      message: "Infos réalisateur et/ou acteurs mises à jour.",
      film: updatedFilm,
    });
  
  } catch (error) {
    console.error("Erreur lors de la mise à jour du film :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Ajouter ou modifier les plateformes disponibles pour un film
router.put('/:filmId/update-platforms', async (req, res) => {
  const { filmId } = req.params;
  const { platforms } = req.body;
  console.log("req body", req.body);

  if (!platforms || !Array.isArray(platforms)) {
    return res.status(400).json({ error: "Le champ 'platforms' est requis et doit être un tableau." });
  }

  try {
    const film = await Film.findById(filmId);

    if (!film) {
      return res.status(404).json({ error: "Film introuvable." });
    }

    // Mise à jour complète du champ platform
    film.platform = platforms;
    await film.save();

    res.status(200).json({
      message: "Plateformes mises à jour.",
      platforms: film.platform,
    });
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour des plateformes :", error.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.put('/mark-as-watched', async (req, res) => {
  const { filmId, slug, title } = req.body;

  try {
    let film;

    // 1. Récupération ou création du film
    if (filmId) {
      film = await Film.findById(filmId);
    } else if (slug) {
      film = await Film.findOne({ slug });
      if (!film) {
        if (!title) {
          return res.status(400).json({ error: 'Le titre est requis pour créer un film.' });
        }
        film = new Film({ title, slug, status: 'watched' });
        film.watchedDates = [new Date()];
        await film.save();
      }
    } else {
      return res.status(400).json({ error: 'Il faut fournir un identifiant de film (filmId ou slug).' });
    }

    if (!film) {
      return res.status(404).json({ error: 'Film non trouvé.' });
    }

    // 2. Retirer de la Watchlist
    const watchlist = await List.findOne({ listType: 'Watchlist' });
    if (watchlist && watchlist.films.includes(film._id)) {
      watchlist.films = watchlist.films.filter(id => id.toString() !== film._id.toString());
      await watchlist.save();
    }

    // 3. Ajouter à la Seenlist
    let seenlist = await List.findOne({ listType: 'SeenList' });
    if (!seenlist) {
      seenlist = new List({
        title: 'Mes films vus',
        listType: 'SeenList',
        films: [],
      });
    }

    if (!seenlist.films.includes(film._id)) {
      seenlist.films.push(film._id);
      await seenlist.save();
    }

    // 4. Modifier le statut et ajouter la date
    film.status = 'watched';
    film.watchedDates = film.watchedDates || [];
    film.watchedDates.push(new Date());

    await film.save();

    res.status(200).json({
      message: 'Film marqué comme vu',
      film,
      timesWatched: film.watchedDates.length,
    });

  } catch (error) {
    console.error('❌ Erreur lors du marquage comme vu :', error.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});
// @route   PUT /api/films/:id/update-review
// @desc    Ajouter ou modifier une shortReview, longReview et/ou un rating
// @access  Public
router.put('/:id/update-review', async (req, res) => {
  const { id } = req.params;
  const { shortReview, longReview, rating } = req.body;

  // Vérification de base
  if (shortReview === undefined && longReview === undefined && rating === undefined) {
    return res.status(400).json({
      error: 'Veuillez fournir au moins une valeur à mettre à jour (shortReview, longReview ou rating).'
    });
  }

  try {
    const updatedFields = {};

    if (shortReview !== undefined) {
      updatedFields.shortReview = shortReview;
    }

    if (longReview !== undefined) {
      updatedFields.longReview = longReview;
    }

    if (rating !== undefined) {
      const numericRating = Number(rating);
      if (isNaN(numericRating) || numericRating < 1 || numericRating > 10) {
        return res.status(400).json({ error: 'Le rating doit être un nombre entre 1 et 10.' });
      }
      updatedFields.rating = numericRating;
    }

    const updatedFilm = await Film.findByIdAndUpdate(
      id,
      { $set: updatedFields },
      { new: true }
    );

    if (!updatedFilm) {
      return res.status(404).json({ error: 'Film introuvable.' });
    }

    res.status(200).json({
      message: 'Critiques et/ou note mises à jour.',
      film: updatedFilm,
    });
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des critiques :', error.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});



module.exports = router;

