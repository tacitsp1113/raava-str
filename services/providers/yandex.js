const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'catalog.sqlite');
let db = null;

function getDb() {
  if (!db && fs.existsSync(DB_PATH)) {
    try {
      db = new DatabaseSync(DB_PATH, { readOnly: true });
    } catch (e) {
      console.error('[Yandex Provider] Error opening database:', e.message);
    }
  }
  return db;
}

const YANDEX_API = 'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=';

async function resolveYandex(shareUrl) {
  try {
    const res = await axios.get(YANDEX_API + encodeURIComponent(shareUrl), { timeout: 4000 });
    return res.data && res.data.href ? res.data.href : null;
  } catch (_) {
    return null;
  }
}

async function getYandexStreams(media, season, episode, config) {
  const database = getDb();
  if (!database || !media || !media.tmdbId) return [];

  const isSeries = Boolean(season && episode);
  const tmdbId = media.tmdbId;

  try {
    let candidateLinks = [];

    if (!isSeries) {
      // Películas
      const row = database.prepare('SELECT files_json, title, year FROM movies WHERE tmdb_id = ?').get(tmdbId);
      if (row && row.files_json) {
        const files = JSON.parse(row.files_json);
        candidateLinks = files.filter(f => f.url && f.url.includes('yadi.sk'));
      }
    } else {
      // Series
      const row = database.prepare('SELECT seasons_json, title, year FROM series WHERE tmdb_id = ?').get(tmdbId);
      if (row && row.seasons_json) {
        const seasons = JSON.parse(row.seasons_json);
        const sNum = parseInt(season, 10);
        const eIdx = parseInt(episode, 10) - 1; // 0-indexed

        for (const s of seasons) {
          // Coincidencia de temporada
          const matchSeason = s.name.match(/\d+/);
          const currentSNum = matchSeason ? parseInt(matchSeason[0], 10) : 1;
          if (currentSNum === sNum && s.eps) {
            const foundEp = s.eps.find(e => e.idx === eIdx);
            if (foundEp && foundEp.url && foundEp.url.includes('yadi.sk')) {
              candidateLinks.push({
                quality: '1080p',
                size: foundEp.size ? `${(foundEp.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : null,
                url: foundEp.url
              });
            }
          }
        }
      }
    }

    if (!candidateLinks || candidateLinks.length === 0) return [];

    // Limitar a los mejores 3 enlaces para no saturar
    const targets = candidateLinks.slice(0, 3);

    const streams = await Promise.all(targets.map(async (item) => {
      const directUrl = await resolveYandex(item.url);
      if (!directUrl) return null;

      const qRaw = (item.quality || '1080p').toUpperCase();
      let qualityKey = '1080p';
      if (qRaw.includes('4K')) qualityKey = '4k';
      else if (qRaw.includes('720')) qualityKey = '720p';

      const epLabel = isSeries ? ` · T${season} E${episode}` : '';
      const sizeLabel = item.size ? ` | 💾 ${item.size}` : '';
      const line1 = `${media.title || 'Video'} (${media.year || ''})${epLabel}`;
      const line2 = `${qRaw} | TACIT Cloud${sizeLabel}`;
      const line3 = `⚡ Reproducción Directa Alta Velocidad`;

      return {
        provider: 'yandex',
        isDirect: true,
        qualityKey,
        server: 'TACIT Cloud',
        seeders: 1000,
        name: 'TACIT',
        title: `${line1}\n${line2}\n${line3}`,
        url: directUrl,
        behaviorHints: {
          notWebReady: false
        }
      };
    }));

    return streams.filter(Boolean);
  } catch (err) {
    console.error('[TACIT Error Yandex Provider]:', err.message);
    return [];
  }
}

module.exports = {
  getYandexStreams
};
