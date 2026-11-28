const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const List = require('../../models/List');
const Film = require('../../models/Film');

// @route   POST /api/lists
// @desc    Créer une nouvelle liste
// @access  Public (ou à protéger plus tard)
router.post('/', async (req, res) => {
  try {
    const newList = new List(req.body);
    const savedList = await newList.save();
    res.status(201).json(savedList);
  } catch (error) {
    console.error('❌ Erreur lors de la création de la liste :', error.message);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/lists
// Description : Récupérer toutes les listes
router.get('/', async (req, res) => {
    try {
      const lists = await List.find().populate('films'); // Inclut les films si liés
      res.json(lists);
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des listes :', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
// @route   GET /api/lists/watchlist
// @access  Public
router.get('/watchlist', async (req, res) => {
  try {
    const list = await List.findOne({ listType: 'Watchlist' }).populate('films'); 

    if (!list) {
      return res.status(404).json({ error: 'Liste non trouvée' });
    }

    res.json(list);
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de la liste :', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/seenlist', async (req, res) => {
  try {
    const list = await List.findOne({ listType: 'SeenList' }).populate('films');
    if (!list) return res.status(404).json({ error: 'Liste non trouvée' });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/lists/rankings
// @desc    Classements enregistrés (listes Customised avec ranked: true), les plus récemment modifiés en premier.
//          Défini avant /:id, sinon « rankings » serait pris pour un id.
// @access  Public
router.get('/rankings', async (req, res) => {
  try {
    const rankings = await List.find({ listType: 'Customised', ranked: true })
      .sort({ updatedAt: -1 })
      .populate('films', 'title slug rating posterPath');
    res.json(rankings);
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des classements :', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

  // @route   GET /api/lists/:id
// @desc    Récupérer une seule liste par ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
      const list = await List.findById(req.params.id).populate('films');
  
      if (!list) {
        return res.status(404).json({ error: 'Liste non trouvée' });
      }
  
      res.json(list);
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de la liste :', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
  
  // @route   PUT /api/lists/add-to-watchlist
// @desc    Ajouter un film à la Watchlist
// @access  Public
router.put('/add-to-watchlist', async (req, res) => {

    const { filmId, title, slug } = req.body;
  
    try {
      // Chercher la liste de type "Watchlist"
      let watchlist = await List.findOne({ listType: 'Watchlist' });
  
      // Si elle n’existe pas, on la crée
      if (!watchlist) {
        watchlist = new List({
          title: 'Ma Watchlist',
          listType: 'Watchlist',
          films: [],
        });
      }
  
      // Éviter les doublons dans la watchlist
      if (watchlist.films.includes(filmId)) {
        return res.status(400).json({ error: 'Le film est déjà dans la Watchlist.' });
      }

      let filmToAdd = null;

    if (filmId) {
      // Cas classique
      filmToAdd = filmId;
    } else if (slug) {
      // Création automatique si film inexistant
  
      let film = await Film.findOne({ slug });

      if (!film) {
        film = new Film({ title, slug }); // tu peux ajouter d’autres champs par défaut ici
        await film.save();
      }

      filmToAdd = film._id;
    }

    if (filmToAdd && !watchlist.films.includes(filmToAdd)) {
      watchlist.films.push(filmToAdd);
      await watchlist.save();
    }
      
    res.status(200).json({ message: 'Film ajouté à la Watchlist', filmId: filmToAdd });
  } catch (error) {
    console.error('❌ Erreur :', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
  });

// @route   DELETE /api/lists/:listType/films/:slug
// @desc    Supprimer un film d'une liste (ex : DELETE /api/lists/watchlist/films/inception)
// @access  Public
const LIST_TYPES = {
  watchlist: 'Watchlist',
  seenlist: 'SeenList',
  likedlist: 'LikedList',
};

router.delete('/:listType/films/:slug', async (req, res) => {
  const listType = LIST_TYPES[req.params.listType.toLowerCase()];
  const { slug } = req.params;

  if (!listType) {
    return res.status(400).json({ error: 'Type de liste invalide' });
  }

  try {
    const list = await List.findOne({ listType });
    if (!list) {
      return res.status(404).json({ error: 'Liste non trouvée' });
    }

    const film = await Film.findOne({ slug });
    if (!film || !list.films.some((id) => id.equals(film._id))) {
      return res.status(404).json({ error: "Le film n'est pas dans cette liste." });
    }

    list.films.pull(film._id);
    await list.save();

    // Mise à jour du statut du film selon la liste quittée
    // (miroir de add-to-watchlist et mark-as-watched dans films.js)
    if (listType === 'Watchlist') {
      // to_rewatch : déjà vu, on ne veut plus le revoir -> redevient "vu"
      // to watch : jamais vu et retiré de la watchlist -> statut à définir
      film.status = film.status === 'to_rewatch' ? 'watched' : 'to_define';
    } else if (listType === 'SeenList') {
      // Le film n'est plus considéré comme vu -> statut à définir
      film.status = 'to_define';
    }
    if (film.isModified('status')) {
      await film.save();
    }

    res.status(200).json({ message: 'Film supprimé de la liste', listType, slug, film });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression du film :', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   PUT /api/lists/:id
// @desc    Mettre à jour un classement (liste Customised avec ranked: true) : titre et/ou ordre des films
// @access  Public
router.put('/:id', async (req, res) => {
  const { title, films } = req.body;

  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    return res.status(400).json({ error: 'Titre invalide' });
  }
  if (films !== undefined && (!Array.isArray(films) || films.some((id) => !mongoose.isValidObjectId(id)))) {
    return res.status(400).json({ error: 'Liste de films invalide' });
  }

  try {
    const list = await List.findById(req.params.id);
    if (!list) return res.status(404).json({ error: 'Liste non trouvée' });
    // Seuls les classements se modifient par cette route (pas la Watchlist ni les Films vus)
    if (list.listType !== 'Customised' || !list.ranked) {
      return res.status(403).json({ error: 'Seuls les classements sont modifiables ici' });
    }

    if (title !== undefined) list.title = title.trim().slice(0, 80);
    if (films !== undefined) list.films = films;
    await list.save();

    res.status(200).json(list);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de la liste :', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   DELETE /api/lists/:id
// @desc    Supprimer un classement (liste Customised avec ranked: true).
//          Les films eux-mêmes ne sont pas supprimés : seule la liste disparaît.
// @access  Public
router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  try {
    const list = await List.findById(req.params.id);
    if (!list) return res.status(404).json({ error: 'Liste non trouvée' });
    // Garde : on ne supprime jamais la Watchlist ou les Films vus par cette route
    if (list.listType !== 'Customised' || !list.ranked) {
      return res.status(403).json({ error: 'Seuls les classements peuvent être supprimés ici' });
    }

    await list.deleteOne();
    res.status(200).json({ message: 'Classement supprimé', id: req.params.id });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression du classement :', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
