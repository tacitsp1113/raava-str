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

function parseSizeGB(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val / (1024 * 1024 * 1024);
  const clean = String(val).replace(',', '.');
  const m = clean.match(/([\d.]+)\s*(GB|MB)/i);
  if (!m) return 0;
  const num = parseFloat(m[1]);
  if (/MB/i.test(m[2])) return num / 1024;
  return num;
}

function parseQualityAndAudio(rawQuality = '', rawFile = '', rawSeason = '') {
  const combined = `${rawQuality} ${rawFile} ${rawSeason}`.toUpperCase();

  let qualityBadge = '1080P';
  let qualityKey = '1080p';

  if (/4K|2160P|UHD/.test(combined)) {
    qualityBadge = '4K';
    qualityKey = '4k';
  } else if (/1080P|FHD/.test(combined)) {
    qualityBadge = '1080P';
    qualityKey = '1080p';
  } else if (/720P/.test(combined)) {
    qualityBadge = '720P';
    qualityKey = '720p';
  } else if (/HD/.test(combined)) {
    qualityBadge = 'HD';
    qualityKey = '720p';
  } else {
    qualityBadge = 'HD';
    qualityKey = '720p';
  }

  // Codec
  let codec = '';
  if (/AV1/.test(combined)) codec = 'AV1';
  else if (/HEVC|X265|H\.?265|10BIT/.test(combined)) codec = 'HEVC';
  else if (/X264|H\.?264/.test(combined)) codec = 'H.264';

  // Dynamic Range
  let range = /HDR|DV|DOLBY/.test(combined) ? 'HDR' : 'SDR';

  const specs = [qualityBadge];
  if (codec) specs.push(codec);
  specs.push(range);
  const specLine = specs.join(' · ');

  // Audio / Flags
  let audioLine = '🇲🇽 ES';
  let isLatino = true;

  if (/TRIAL|MULTI/.test(combined)) {
    audioLine = '🇲🇽 ES · 🇪🇸 ES · 🇺🇸 EN';
    isLatino = true;
  } else if (/DUAL/.test(combined)) {
    audioLine = '🇲🇽 ES · 🇺🇸 EN';
    isLatino = true;
  } else if (/CAST|CASTELLANO|ESP\b/.test(combined)) {
    audioLine = '🇪🇸 ES';
    isLatino = false;
  } else if (/SUB|VOSE/.test(combined)) {
    audioLine = '🇺🇸 EN · Sub';
    isLatino = false;
  } else if (/JAP|JPN/.test(combined)) {
    audioLine = '🇯🇵 JA · 🇲🇽 ES Sub';
    isLatino = false;
  } else if (/LAT|LATINO/.test(combined)) {
    audioLine = '🇲🇽 ES';
    isLatino = true;
  }

  return { qualityBadge, qualityKey, specLine, audioLine, isLatino };
}

async function getYandexStreams(media, season, episode, config = {}) {
  const database = getDb();
  if (!database || !media) return [];

  const isSeries = Boolean(season && episode);
  const tmdbId = media.tmdbId ? Number(media.tmdbId) : null;
  const maxStreams = Math.max(1, parseInt(config.maxCloudStreams || config.maxStreams, 10) || 10);

  try {
    let candidateLinks = [];

    if (!isSeries) {
      // 1. Películas - Búsqueda por tmdb_id con fallback por título
      let row = tmdbId ? database.prepare('SELECT files_json, title, year FROM movies WHERE tmdb_id = ?').get(tmdbId) : null;

      if (!row && media.title) {
        row = database.prepare('SELECT files_json, title, year FROM movies WHERE LOWER(title) = ? LIMIT 1')
          .get(media.title.toLowerCase().trim());
      }

      if (row && row.files_json) {
        const files = JSON.parse(row.files_json);
        for (const f of files) {
          if (!f.url || !f.url.includes('yadi.sk')) continue;
          const sizeGB = parseSizeGB(f.size);
          const meta = parseQualityAndAudio(f.quality || '');
          candidateLinks.push({
            url: f.url,
            sizeGB,
            rawSize: f.size,
            ...meta
          });
        }
      }
    } else {
      // 2. Series - Búsqueda por tmdb_id con fallback por título
      let row = tmdbId ? database.prepare('SELECT seasons_json, title, year FROM series WHERE tmdb_id = ?').get(tmdbId) : null;

      if (!row && media.title) {
        row = database.prepare('SELECT seasons_json, title, year FROM series WHERE LOWER(title) = ? LIMIT 1')
          .get(media.title.toLowerCase().trim());
      }

      if (row && row.seasons_json) {
        const seasons = JSON.parse(row.seasons_json);
        const sNum = parseInt(season, 10);
        const eIdx = parseInt(episode, 10) - 1; // 0-indexed

        for (const s of seasons) {
          const matchSeason = s.name.match(/\d+/);
          const currentSNum = matchSeason ? parseInt(matchSeason[0], 10) : 1;

          if (currentSNum === sNum && Array.isArray(s.eps)) {
            const foundEp = s.eps.find(e => {
              if (e.idx === eIdx) return true;
              if (e.file) {
                const epRegex = new RegExp(`S0?${sNum}E0?${episode}\\b|E0?${episode}\\b`, 'i');
                return epRegex.test(e.file);
              }
              return false;
            });

            if (foundEp && foundEp.url && foundEp.url.includes('yadi.sk')) {
              const sizeGB = parseSizeGB(foundEp.size);
              const meta = parseQualityAndAudio(s.name || '', foundEp.file || '', s.name || '');
              candidateLinks.push({
                url: foundEp.url,
                sizeGB,
                rawSize: foundEp.size ? `${sizeGB.toFixed(2)} GB` : null,
                ...meta
              });
            }
          }
        }
      }
    }

    if (!candidateLinks || candidateLinks.length === 0) return [];

    // Deduplicar mirrors idénticos
    const uniqueMap = new Map();
    for (const item of candidateLinks) {
      const key = `${item.qualityBadge}-${item.sizeGB.toFixed(2)}-${item.audioLine}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }

    const uniqueCandidates = Array.from(uniqueMap.values());

    // Identificar la MEJOR opción recomendada
    // Criterio: 1080p, audio Latino/Dual, tamaño seguro (2.0 a 6.0 GB)
    let bestIdx = -1;
    let bestDiff = 999;
    uniqueCandidates.forEach((item, idx) => {
      if (item.qualityKey === '1080p' && item.isLatino && item.sizeGB >= 2.0 && item.sizeGB <= 6.0) {
        const diff = Math.abs(item.sizeGB - 4.0);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = idx;
        }
      }
    });

    uniqueCandidates.forEach((item, idx) => {
      item.isRecommended = (idx === bestIdx);
    });

    // Ordenar de forma óptima
    uniqueCandidates.sort((a, b) => {
      if (a.isRecommended) return -1;
      if (b.isRecommended) return 1;

      const qRank = (q) => (q === '4k' ? 400 : q === '1080p' ? 300 : 100);
      let scoreA = qRank(a.qualityKey) + (a.isLatino ? 50 : 0);
      let scoreB = qRank(b.qualityKey) + (b.isLatino ? 50 : 0);

      if (a.sizeGB > 10) scoreA -= 150;
      if (b.sizeGB > 10) scoreB -= 150;

      return scoreB - scoreA;
    });

    // Limitar al máximo configurado
    const targets = uniqueCandidates.slice(0, maxStreams);

    // Resolver enlaces contra Yandex Cloud API en paralelo
    const resolvedStreams = await Promise.all(targets.map(async (item) => {
      const directUrl = await resolveYandex(item.url);
      if (!directUrl) return null;

      const isRec = Boolean(item.isRecommended);

      // Formato estricto tipo Nuve+:
      // Línea 1: ⭐/🎬 Calidad · Códec · Rango
      // Línea 2: Idiomas y banderas
      // Línea 3: ⚡ Título o Episodio
      // Línea 4: 📦 Tamaño (solo si existe, nunca servidor)
      const line1 = `${isRec ? '⭐' : '🎬'} ${item.specLine}`;
      const line2 = item.audioLine;
      const line3 = isSeries
        ? `⚡ T${season} · E${episode}`
        : `⚡ ${media.title || 'Video'}`;

      const lines = [line1, line2, line3];
      if (item.sizeGB > 0) {
        lines.push(`📦 ${item.sizeGB.toFixed(2)} GB`);
      } else if (item.rawSize) {
        lines.push(`📦 ${item.rawSize}`);
      }

      return {
        provider: 'yandex',
        isDirect: true,
        qualityKey: item.qualityKey,
        server: 'TACIT Cloud',
        seeders: 1000,
        isRecommended: isRec,
        name: 'TACIT',
        title: lines.join('\n'),
        url: directUrl,
        behaviorHints: {
          notWebReady: false
        }
      };
    }));

    return resolvedStreams.filter(Boolean);
  } catch (err) {
    console.error('[TACIT Error Yandex Provider]:', err.message);
    return [];
  }
}

module.exports = {
  getYandexStreams
};
