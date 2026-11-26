// Recherche d'affiches sur TMDB (The Movie Database)
const TMDB_SEARCH_URL = 'https://api.themoviedb.org/3/search/movie';
// On ne fait jamais attendre une requête de l'app plus longtemps que ça
const TIMEOUT_MS = 4000;

// Renvoie le poster_path TMDB du premier résultat pour ce titre, ou null.
// Lève une erreur si TMDB répond mal ou ne répond pas à temps.
const fetchPosterPath = async (title) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey || !title) return null;

  const url = `${TMDB_SEARCH_URL}?query=${encodeURIComponent(title)}&language=fr-FR&api_key=${apiKey}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });

  if (!response.ok) {
    throw new Error(`TMDB ${response.status} : ${response.statusText}`);
  }

  const data = await response.json();
  return data.results?.[0]?.poster_path ?? null;
};

module.exports = { fetchPosterPath };
