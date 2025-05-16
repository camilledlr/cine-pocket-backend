const express = require('express');
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
    const list = await List.findOne({ listType: 'WatchList' }).populate('films'); 

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

module.exports = router;