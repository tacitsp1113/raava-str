const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'catalog.sqlite');
let db = null;

function getDb() {
  if (!db && fs.existsSync(DB_PATH)) {
    try {
      db = new DatabaseSync(DB_PATH, { readOnly: true });
    } catch (e) {
      console.error('[CloudStream API] Error opening SQLite database:', e.message);
    }
  }
  return db;
}

const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
const YANDEX_API = 'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=';

function fmtPoster(path) {
  if (!path) return null;
  return path.startsWith('http') ? path : `${TMDB_IMG}${path}`;
}

async function resolveYandex(shareUrl) {
  try {
    const res = await axios.get(YANDEX_API + encodeURIComponent(shareUrl), { timeout: 4000 });
    return res.data && res.data.href ? res.data.href : null;
  } catch (_) {
    return null;
  }
}

// 1. Catálogo principal / Explorar
function getHome(type = 'movie', page = 1, limit = 30) {
  const database = getDb();
  if (!database) return { page, has_next: false, results: [] };

  const table = type === 'series' ? 'series' : 'movies';
  const offset = (Math.max(1, page) - 1) * limit;

  const rows = database.prepare(`
    SELECT tmdb_id as id, title, year, poster, vote, genres
    FROM ${table}
    ORDER BY year DESC, vote DESC
    LIMIT ? OFFSET ?
  `).all(limit + 1, offset);

  const hasNext = rows.length > limit;
  const results = rows.slice(0, limit).map(r => ({
    id: r.id,
    title: r.title,
    year: r.year,
    poster: fmtPoster(r.poster),
    vote: r.vote,
    type: type === 'series' ? 'series' : 'movie'
  }));

  return { page: Number(page), has_next: hasNext, results };
}

// 2. Buscador
function searchCatalog(query, limit = 40) {
  const database = getDb();
  if (!database || !query) return [];

  const cleanQ = `%${query.trim().toLowerCase()}%`;

  const movies = database.prepare(`
    SELECT tmdb_id as id, title, year, poster, vote, 'movie' as type
    FROM movies
    WHERE LOWER(title) LIKE ?
    LIMIT ?
  `).all(cleanQ, Math.floor(limit / 2));

  const series = database.prepare(`
    SELECT tmdb_id as id, title, year, poster, vote, 'series' as type
    FROM series
    WHERE LOWER(title) LIKE ?
    LIMIT ?
  `).all(cleanQ, Math.floor(limit / 2));

  return [...movies, ...series].map(r => ({
    ...r,
    poster: fmtPoster(r.poster)
  }));
}

// 3. Ficha de detalle (Load)
function loadDetails(type, id) {
  const database = getDb();
  if (!database || !id) return null;

  const isSeries = type === 'series';
  const table = isSeries ? 'series' : 'movies';

  if (!isSeries) {
    const row = database.prepare(`
      SELECT tmdb_id as id, title, year, poster, vote, genres
      FROM movies WHERE tmdb_id = ?
    `).get(Number(id));

    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      year: row.year,
      poster: fmtPoster(row.poster),
      vote: row.vote,
      genres: row.genres,
      type: 'movie'
    };
  } else {
    const row = database.prepare(`
      SELECT tmdb_id as id, title, year, poster, vote, genres, seasons_json
      FROM series WHERE tmdb_id = ?
    `).get(Number(id));

    if (!row) return null;

    let seasons = [];
    let episodes = [];

    if (row.seasons_json) {
      try {
        const rawSeasons = JSON.parse(row.seasons_json);
        rawSeasons.forEach(s => {
          const matchSeason = s.name.match(/\d+/);
          const sNum = matchSeason ? parseInt(matchSeason[0], 10) : 1;

          (s.eps || []).forEach(e => {
            episodes.push({
              name: e.file ? e.file.replace(/\.(mkv|mp4)$/i, '') : `Episodio ${e.idx + 1}`,
              season: sNum,
              episode: e.idx + 1,
              size: e.size ? `${(e.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : null,
              data: `${sNum}:${e.idx + 1}`
            });
          });
        });
      } catch (_) {}
    }

    return {
      id: row.id,
      title: row.title,
      year: row.year,
      poster: fmtPoster(row.poster),
      vote: row.vote,
      genres: row.genres,
      type: 'series',
      episodes
    };
  }
}

// 4. Enlaces de reproducción (Links)
async function getStreams(type, id, season = null, episode = null) {
  const database = getDb();
  if (!database || !id) return [];

  const isSeries = type === 'series';
  let candidates = [];

  if (!isSeries) {
    const row = database.prepare('SELECT files_json, title FROM movies WHERE tmdb_id = ?').get(Number(id));
    if (row && row.files_json) {
      try {
        const files = JSON.parse(row.files_json);
        candidates = files.filter(f => f.url && f.url.includes('yadi.sk'));
      } catch (_) {}
    }
  } else {
    const row = database.prepare('SELECT seasons_json, title FROM series WHERE tmdb_id = ?').get(Number(id));
    if (row && row.seasons_json) {
      try {
        const rawSeasons = JSON.parse(row.seasons_json);
        const sNum = parseInt(season, 10);
        const eIdx = parseInt(episode, 10) - 1;

        for (const s of rawSeasons) {
          const matchSeason = s.name.match(/\d+/);
          const currentSNum = matchSeason ? parseInt(matchSeason[0], 10) : 1;
          if (currentSNum === sNum && s.eps) {
            const foundEp = s.eps.find(e => e.idx === eIdx);
            if (foundEp && foundEp.url && foundEp.url.includes('yadi.sk')) {
              candidates.push({
                quality: '1080p',
                size: foundEp.size ? `${(foundEp.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : null,
                url: foundEp.url
              });
            }
          }
        }
      } catch (_) {}
    }
  }

  const targets = candidates.slice(0, 3);
  const resolved = await Promise.all(targets.map(async (c) => {
    const directUrl = await resolveYandex(c.url);
    if (!directUrl) return null;

    return {
      name: 'Yandex Cloud',
      url: directUrl,
      quality: c.quality || '1080p',
      size: c.size || null
    };
  }));

  return resolved.filter(Boolean);
}

module.exports = {
  getHome,
  searchCatalog,
  loadDetails,
  getStreams
};
