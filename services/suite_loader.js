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

          // Validar enlace existente
          if (!isTorrent && !s.url) continue;

          const qKey = normalizeQuality(s.quality);
          const srv = extractServer(s.name || s.title);
          const lang = s.language || '🇲🇽 Latino';
          const cleanLang = lang.includes('Latino') ? '🇲🇽 Español Latino' : (lang.includes('Castellano') ? '🇪🇸 Castellano' : '🌐 Multi Audio');
          const codec = qKey === '4k' ? 'HEVC · HDR' : 'H.264 · SDR';

          const seeds = s.seeders && s.seeders > 0 ? s.seeders : 18;
          const seedText = `👥 ${seeds} personas transmitiendo (${seeds === 1 ? '1 semilla' : `${seeds} semillas`})`;
          const sizeText = s.size ? ` · 📦 ${s.size}` : '';
          const directSizeLine = s.size ? `\n📦 ${s.size}` : '';

          const reqHeaders = (!isTorrent && s.headers && Object.keys(s.headers).length > 0) ? s.headers : null;

          mapped.push({
            provider: scraper.id,
            server: isTorrent ? 'Torrent P2P' : srv,
            serverTier: 1,
            isDirect: !isTorrent,
            qualityKey: qKey,
            seeders: seeds,
            name: isTorrent ? 'TACIT STR 🧲' : 'TACIT STR · WEB',
            title: isTorrent
              ? `🧲 ${qKey.toUpperCase()} · ${codec} · P2P\n${seedText}${sizeText}\n${cleanLang}\n⚡ ${scraper.name}`
              : `🎬 ${qKey.toUpperCase()} · ${codec} · ${srv}\n${cleanLang}\n⚡ ${scraper.name}${directSizeLine}`,
            url: s.url,
            infoHash: s.infoHash,
            fileIdx: s.fileIdx,
            headers: reqHeaders || undefined,
            behaviorHints: reqHeaders ? {
              proxyHeaders: {
                request: reqHeaders
              },
              notWebReady: true
            } : undefined
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
const BUILTIN_PROVIDERS = new Set(['cinecalidad', 'cuevana', 'seriesflix', 'hackstore', 'pelisplus', 'tioanime', 'lamovie', 'lacartoons']);
const TOP_PROVIDERS_SET = new Set(['pelispanda', 'pelishax', 'allcalidad', 'mundodonghua', 'doramasflix']);

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
    // 1. Filtrar por tipo soportado
    if (!s.supportedTypes || !s.supportedTypes.includes(manifestType)) return false;

    // 2. Torrents suspendidos: omitir scrapers exclusivos de torrent
    if (TORRENT_SCRAPERS.has(s.id)) {
      return false;
    }

    // 3. Omitir si ya se ejecuta de forma nativa optimizada en buildWebTasks
    if (BUILTIN_PROVIDERS.has(s.id)) {
      return false;
    }

    // 4. Si el usuario especificó lista de proveedores (incluso si seleccionó 0 []), filtrar estrictamente
    if (Array.isArray(userProviders)) {
      return userProviders.includes(s.id);
    }

    // 5. Fallback si no hay lista configurada: solo fuentes TOP para máxima velocidad y evitar caídas
    if (isAnime) {
      return ['animeflv', 'mundodonghua'].includes(s.id);
    }
    return TOP_PROVIDERS_SET.has(s.id);
  });

  // Priorizar siempre las fuentes TOP y limitar la concurrencia a un máximo seguro (4) para no saturar la CPU de Render
  targetScrapers.sort((a, b) => {
    const aTop = TOP_PROVIDERS_SET.has(a.id) ? 1 : 0;
    const bTop = TOP_PROVIDERS_SET.has(b.id) ? 1 : 0;
    return bTop - aTop;
  });

  const MAX_SUITE_CONCURRENCY = 4;
  const scrapersToRun = targetScrapers.slice(0, MAX_SUITE_CONCURRENCY);

  addLog('info', 'Suite', `Consultando ${scrapersToRun.length} raspadores prioritarios para ${manifestType} TMDB:${tmdbId}...`);

  const tasks = scrapersToRun.map((scraper) => {
    return runProviderSafe(scraper, tmdbId, manifestType, season, episode, 9500);
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
