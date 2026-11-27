const path = require('path');
const fs = require('fs');
const { addLog } = require('./logger');

// Cache providers and manifest
let manifestData = null;
const loadedModules = new Map();

function getManifest() {
  if (!manifestData) {
    const manifestPath = path.join(__dirname, '..', 'pluggin-latino-main', 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } else {
      manifestData = { scrapers: [] };
    }
  }
  return manifestData;
}

function getProviderModule(scraper) {
  if (loadedModules.has(scraper.id)) {
    return loadedModules.get(scraper.id);
  }
  try {
    const fullPath = path.join(__dirname, '..', 'pluggin-latino-main', scraper.filename);
    if (fs.existsSync(fullPath)) {
      const mod = require(fullPath);
      loadedModules.set(scraper.id, mod);
      return mod;
    }
  } catch (err) {
    console.error(`[Suite] Error cargando raspador ${scraper.id}:`, err.message);
  }
  return null;
}

function normalizeQuality(q) {
  if (!q) return '1080p';
  const str = String(q).toLowerCase();
  if (str.includes('4k') || str.includes('2160')) return '4k';
  if (str.includes('1080')) return '1080p';
  if (str.includes('720')) return '720p';
  if (str.includes('480')) return '480p';
  if (str.includes('360')) return '360p';
  return '1080p';
}

function extractServer(nameOrTitle) {
  if (!nameOrTitle) return 'Directo';
  const match = nameOrTitle.match(/\(([^)]+)\)/);
  if (match) return match[1].trim();
  const servers = ['Vimeos', 'VOE', 'StreamWish', 'VidHide', 'Okru', 'Mp4', 'Filemoon', 'Vidmoly'];
  for (const s of servers) {
    if (new RegExp(s, 'i').test(nameOrTitle)) return s;
  }
  return 'Directo';
}

function formatTacitTitle(item, provName) {
  const q = normalizeQuality(item.quality).toUpperCase();
  const srv = extractServer(item.name || item.title);
  const lang = item.language || '🇲🇽 Latino';
  const cleanLang = lang.includes('Latino') ? '🇲🇽 ES' : (lang.includes('Castellano') ? '🇪🇸 ES' : '🌐 Multi');
  return `🎬 ${q} · ${srv}\n${cleanLang}\n⚡ ${provName}`;
}

async function runProviderSafe(scraper, tmdbId, mediaType, season, episode, timeoutMs = 8000) {
  const mod = getProviderModule(scraper);
  if (!mod || typeof mod.getStreams !== 'function') return [];

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve([]);
    }, timeoutMs);

    const sNum = season ? parseInt(season, 10) : undefined;
    const eNum = episode ? parseInt(episode, 10) : undefined;

    mod.getStreams(tmdbId, mediaType, sNum, eNum)
      .then((rawStreams) => {
        clearTimeout(timer);
        if (!Array.isArray(rawStreams)) return resolve([]);

        const mapped = [];
        for (const s of rawStreams) {
          if (!s || (!s.url && !s.infoHash)) continue;

          const isTorrent = Boolean(s.infoHash || (s.url && s.url.startsWith('magnet:')));

          // Descartar servidores con amarre de IP problemáticos en streaming directo
          if (!isTorrent && s.url) {
            const urlLower = s.url.toLowerCase();
            const nameLower = (s.name || '').toLowerCase();
            if (urlLower.includes('vidhide') || nameLower.includes('vidhide') ||
                urlLower.includes('streamwish') || nameLower.includes('streamwish') ||
                urlLower.includes('doodstream') || nameLower.includes('doodstream')) {
              continue;
            }
          }

          const qKey = normalizeQuality(s.quality);
          const srv = extractServer(s.name || s.title);
          const lang = s.language || '🇲🇽 Latino';
          const cleanLang = lang.includes('Latino') ? '🇲🇽 ES' : (lang.includes('Castellano') ? '🇪🇸 ES' : '🌐 Multi');

          const seeds = s.seeders && s.seeders > 0 ? s.seeders : 18;
          const seedText = `👥 ${seeds} personas transmitiendo (${seeds === 1 ? '1 semilla' : `${seeds} semillas`})`;
          const sizeText = s.size ? ` · 📦 ${s.size}` : '';

          mapped.push({
            provider: scraper.id,
            server: isTorrent ? 'Torrent P2P' : srv,
            serverTier: 1,
            isDirect: !isTorrent,
            qualityKey: qKey,
            seeders: seeds,
            name: isTorrent ? 'TACIT STR 🧲' : 'TACIT STR · WEB',
            title: isTorrent
              ? `🧲 ${qKey.toUpperCase()} · P2P\n${seedText}${sizeText}\n${cleanLang}\n⚡ ${scraper.name}`
              : `🎬 ${qKey.toUpperCase()} · ${srv}\n${cleanLang}\n⚡ ${scraper.name}`,
            url: s.url,
            infoHash: s.infoHash,
            fileIdx: s.fileIdx,
            behaviorHints: {
              proxyHeaders: (!isTorrent && s.headers) ? { request: s.headers } : undefined,
              notWebReady: false
            }
          });
        }
        resolve(mapped);
      })
      .catch((err) => {
        clearTimeout(timer);
        resolve([]);
      });
  });
}

const TORRENT_SCRAPERS = new Set(['4khdhub', 'uhdmovies', 'hdhub4u', 'showbox', 'videasy', 'vidfast', 'vidlink']);

/**
 * Ejecuta la suite de raspadores según la configuración del usuario
 */
async function fetchSuiteStreams(tmdbId, mediaType, season, episode, isAnime, userConfig = {}) {
  const manifest = getManifest();
  const allScrapers = manifest.scrapers || [];

  // Normalizar tipo de medio para el manifest (Stremio usa 'series', manifest usa 'tv')
  const manifestType = (mediaType === 'series' || mediaType === 'tv') ? 'tv' : 'movie';

  // Proveedores seleccionados por el usuario
  const userProviders = manifestType === 'tv'
    ? (userConfig.providers?.series || null)
    : (userConfig.providers?.movie || null);

  const targetScrapers = allScrapers.filter((s) => {
    // Filtrar por tipo soportado
    if (!s.supportedTypes || !s.supportedTypes.includes(manifestType)) return false;

    // Si los torrents están desactivados por el usuario, omitir scrapers exclusivos de torrent
    if (userConfig.disableTorrents && TORRENT_SCRAPERS.has(s.id)) {
      return false;
    }

    // Si el usuario especificó lista de proveedores
    if (Array.isArray(userProviders) && userProviders.length > 0) {
      return userProviders.includes(s.id);
    }

    // Por defecto en Anime
    if (isAnime) {
      return ['jkanime', 'tioanime', 'animeflv', 'animeav1', 'animejl', 'latanime', 'monoschinos'].includes(s.id);
    }

    // Por defecto en películas / series: todas las fuentes soportadas
    return true;
  });

  addLog('info', 'Suite', `Consultando ${targetScrapers.length} raspadores para ${manifestType} TMDB:${tmdbId}...`);

  const tasks = targetScrapers.map((scraper) => {
    return runProviderSafe(scraper, tmdbId, manifestType, season, episode, 6000);
  });

  const settled = await Promise.allSettled(tasks);
  const results = [];
  for (const r of settled) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      results.push(...r.value);
    }
  }

  return results;
}

module.exports = {
  getManifest,
  fetchSuiteStreams,
  normalizeQuality
};
