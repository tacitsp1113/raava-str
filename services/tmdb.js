const axios = require('axios');

const TMDB_KEY = process.env.TMDB_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const cache = new Map();

/**
 * Normalizes title for comparison
 */
function cleanTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetches media details by IMDb ID or TMDB ID (for Nuvio and Stremio)
 */
async function getMediaDetails(type, id) {
  const cacheKey = `${type}:${id}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const isMovie = type === 'movie';
  const isTmdb = typeof id === 'string' && (id.startsWith('tmdb:') || /^\d+$/.test(id));

  // 1. Direct TMDB ID lookup (Used heavily by Nuvio)
  if (isTmdb) {
    const tmdbId = id.replace('tmdb:', '');
    const endpoint = isMovie ? 'movie' : 'tv';
    try {
      const tmdbUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}&language=es-MX`;
      const res = await axios.get(tmdbUrl, { timeout: 8000 });
      const m = res.data;
      if (m) {
        const title = isMovie ? m.title : m.name;
        const originalTitle = isMovie ? m.original_title : m.original_name;
        const releaseDate = isMovie ? m.release_date : m.first_air_date;
        const result = {
          type: isMovie ? 'movie' : 'series',
          tmdbId: m.id,
          imdbId: m.imdb_id || null,
          title: title || originalTitle,
          originalTitle: originalTitle || title,
          year: releaseDate ? parseInt(releaseDate.split('-')[0]) : null,
          cleanTitle: cleanTitle(title),
          cleanOriginalTitle: cleanTitle(originalTitle)
        };
        cache.set(cacheKey, result);
        return result;
      }
    } catch (err) {
      console.error(`[TMDB] Direct lookup error for TMDB ID ${tmdbId}:`, err.message);
    }
  }

  // 2. IMDb ID lookup (Standard Stremio tt...)
  try {
    const imdbId = id;
    const tmdbUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=es-MX`;
    const res = await axios.get(tmdbUrl, { timeout: 8000 });
    const data = res.data;

    let result = null;

    if (isMovie && data.movie_results && data.movie_results.length > 0) {
      const m = data.movie_results[0];
      result = {
        type: 'movie',
        tmdbId: m.id,
        imdbId,
        title: m.title,
        originalTitle: m.original_title,
        year: m.release_date ? parseInt(m.release_date.split('-')[0]) : null,
        cleanTitle: cleanTitle(m.title),
        cleanOriginalTitle: cleanTitle(m.original_title)
      };
    } else if (!isMovie && data.tv_results && data.tv_results.length > 0) {
      const s = data.tv_results[0];
      result = {
        type: 'series',
        tmdbId: s.id,
        imdbId,
        title: s.name,
        originalTitle: s.original_name,
        year: s.first_air_date ? parseInt(s.first_air_date.split('-')[0]) : null,
        cleanTitle: cleanTitle(s.name),
        cleanOriginalTitle: cleanTitle(s.original_name)
      };
    }

    if (result) {
      cache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.error(`[TMDB] Error fetching details for ${id}:`, err.message);
  }

  // 3. Fallback to Cinemeta
  try {
    const cinemetaUrl = `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`;
    const res = await axios.get(cinemetaUrl, { timeout: 8000 });
    const meta = res.data?.meta;
    if (meta && meta.name) {
      const result = {
        type: isMovie ? 'movie' : 'series',
        tmdbId: meta.moviedb_id || null,
        imdbId: id,
        title: meta.name,
        originalTitle: meta.name,
        year: meta.year ? parseInt(meta.year) : null,
        cleanTitle: cleanTitle(meta.name),
        cleanOriginalTitle: cleanTitle(meta.name)
      };
      cache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.error(`[Cinemeta] Fallback error for ${id}:`, err.message);
  }

  return null;
}

module.exports = {
  getMediaDetails,
  cleanTitle
};
