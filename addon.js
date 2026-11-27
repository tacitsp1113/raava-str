const { addonBuilder } = require('stremio-addon-sdk');
const { getMediaDetails } = require('./services/tmdb');
const { fetchSuiteStreams } = require('./services/suite_loader');
const { getSeriesFlixStreams } = require('./services/providers/seriesflix');
const { getLaMovieStreams } = require('./services/providers/lamovie');
const { getLACartoonsStreams } = require('./services/providers/lacartoons');
const { getCinecalidadStreams } = require('./services/providers/cinecalidad');
const { getCuevanaStreams } = require('./services/providers/cuevana');
const { getPelisplusStreams } = require('./services/providers/pelisplus');
const { getHackstoreStreams } = require('./services/providers/hackstore');
const { getTioanimeStreams } = require('./services/providers/tioanime');
const { addLog } = require('./services/logger');

const DEFAULT_CONFIG = {
  mode: 'scrapers',
  providers: {
    movie: [
      'pelispanda',
      'cinecalidad',
      'allcalidad',
      'cuevana',
      'pelispedia',
      'hackstore',
      'pelisplus'
    ],
    series: [
      'seriesflix',
      'pelispanda',
      'cuevana',
      'cinecalidad',
      'pelisplus',
      'tioanime',
      'jkanime'
    ]
  },
  qualities: ['4k', '1080p', '720p', '480p'],
  disableTorrents: false,
  priority: 'direct', // 'direct' | 'torrent'
  maxWebStreamsPerProvider: 4, // Límite por sitio
  maxTotalWebStreams: 25,      // Límite total web combinado
  minSeeders: 1
};

// Enlaces 100% en vivo: sin caché de streams para evitar tokens HLS caducados
function getCachedStreams(key) {
  return null;
}

function setCachedStreams(key, data) {
  // Desactivado intencionalmente para garantizar enlaces frescos en cada reproducción
}

function parseConfig(raw) {
  let fallback = DEFAULT_CONFIG;
  if (!raw || typeof raw !== 'string' || raw === 'manifest.json') return fallback;
  try {
    let parsed;
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      parsed = JSON.parse(decoded);
    } catch (_) {
      parsed = JSON.parse(decodeURIComponent(raw));
    }
    const cfg = { ...DEFAULT_CONFIG, ...parsed };

    if (Array.isArray(cfg.providers)) {
      cfg.providers = {
        movie: [...cfg.providers],
        series: [...cfg.providers]
      };
    } else if (!cfg.providers || typeof cfg.providers !== 'object') {
      cfg.providers = {
        movie: [...DEFAULT_CONFIG.providers.movie],
        series: [...DEFAULT_CONFIG.providers.series]
      };
    } else {
      cfg.providers = {
        movie: Array.isArray(cfg.providers.movie) ? cfg.providers.movie : [...DEFAULT_CONFIG.providers.movie],
        series: Array.isArray(cfg.providers.series) ? cfg.providers.series : [...DEFAULT_CONFIG.providers.series]
      };
    }

    return cfg;
  } catch (_) {
    return DEFAULT_CONFIG;
  }
}

const manifest = {
  id: 'org.tacit.str',
  version: '1.0.0',
  name: 'TACIT STR',
  description: 'Películas, series y anime en Español Latino. Enlaces híbridos (Directo Vimeos/VOE + Torrents 4K/1080p).',
  logo: 'https://raava-str-1.onrender.com/logo.png',
  background: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1920&q=80',
  resources: ['stream'],
  types: ['movie', 'series', 'anime'],
  idPrefixes: ['tt', 'tmdb'],
  catalogs: [],
  behaviorHints: {
    configurable: true,
    configurationRequired: false
  }
};

/**
 * Endpoint principal de resolución de streams para Stremio
 */
async function resolveStreams(type, id, rawConfig) {
  const config = parseConfig(rawConfig);
  const provKey = JSON.stringify(config.providers || {});
  const cacheKey = `${config.priority}:${config.disableTorrents}:${provKey}:${config.maxTotalWebStreams}:${type}:${id}`;

  const cached = getCachedStreams(cacheKey);
  if (cached) {
    console.log(`[TACIT Cache] Instant HIT for ${id}`);
    return cached;
  }

  console.log(`[TACIT Request] Resolving streams for type=${type}, id=${id}`);

  try {
    const isSeries = type === 'series';
    let imdbId = id;
    let season = null;
    let episode = null;

    if (isSeries && id.includes(':')) {
      const parts = id.split(':');
      imdbId = parts[0];
      season = parts[1];
      episode = parts[2];
    }

    const effectiveType = type === 'anime' ? (season && episode ? 'series' : 'movie') : type;
    const media = await getMediaDetails(effectiveType, imdbId);
    if (!media || !media.title) {
      console.warn(`[TACIT] No metadata resolved for ${id}`);
      return { streams: [] };
    }

    addLog('info', 'Stremio', `Petición: "${media.title}" (${isSeries ? 'T' + season + ' · E' + episode : 'Película'}) [ID: ${id}]`);

    const isAnime = Boolean(
      (media.genres && (media.genres.includes('Animación') || media.genres.includes('Animation'))) &&
      (media.country === 'JP' || media.originalLanguage === 'ja')
    );

    addLog('info', 'Scrapers', `Buscando en suite de raspadores para "${media.title}"...`);
    const collectedStreams = [];

    // 1. Ejecutar Suite completa de 54 raspadores
    if (media.tmdbId) {
      try {
        const suiteStreams = await fetchSuiteStreams(
          media.tmdbId,
          isSeries ? 'series' : 'movie',
          season,
          episode,
          isAnime,
          config
        );
        if (Array.isArray(suiteStreams) && suiteStreams.length > 0) {
          collectedStreams.push(...suiteStreams);
        }
      } catch (err) {
        addLog('warn', 'Suite', `Error en suite: ${err.message}`);
      }
    }

    // 2. Si se necesitan más resultados o como respaldo, ejecutar raspadores locales
    if (collectedStreams.length < 3) {
      const providerTasks = buildWebTasks(media, season, episode, isSeries, isAnime, config);
      const settled = await Promise.allSettled(providerTasks);
      for (const res of settled) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          collectedStreams.push(...res.value);
        }
      }
    }

    const finalStreams = processAndFilterStreams(collectedStreams, config, isSeries);

    addLog(
      finalStreams.length > 0 ? 'success' : 'warn',
      'TACIT',
      `Finalizado: entregando ${finalStreams.length} stream(s) para "${media.title}"`,
      finalStreams.map(f => ({ name: f.name, title: f.title?.split('\n')[0] }))
    );

    const result = { streams: finalStreams };
    if (finalStreams.length > 0) {
      setCachedStreams(cacheKey, result);
    }
    return result;
  } catch (error) {
    addLog('error', 'TACIT', `Error procesando stream para ${id}: ${error.message}`);
    return { streams: [] };
  }
}

function taskWithTimeout(taskPromise, ms = 10000) {
  return Promise.race([
    taskPromise,
    new Promise(resolve => setTimeout(() => resolve([]), ms))
  ]);
}

/**
 * Genera las tareas de consulta para proveedores web externos
 */
function buildWebTasks(media, season, episode, isSeries, isAnime, config) {
  const providerTasks = [];
  const activeProviders = isSeries
    ? (config.providers?.series || DEFAULT_CONFIG.providers.series)
    : (config.providers?.movie || DEFAULT_CONFIG.providers.movie);

  const shouldRun = (prov) => activeProviders.includes(prov);

  // 1. CineCalidad (Películas y Series - Directo Vimeos)
  if (shouldRun('cinecalidad')) {
    providerTasks.push(
      taskWithTimeout(
        (async () => {
          const t0 = Date.now();
          addLog('info', 'CineCalidad', `Buscando "${media.title}" ${isSeries ? `(T${season}E${episode})` : ''}...`);
          const s = await getCinecalidadStreams(media, season, episode, config);
          const elapsed = Date.now() - t0;
          if (s.length > 0) {
            addLog('success', 'CineCalidad', `Encontrados ${s.length} streams en ${elapsed}ms`, s.map(x => ({ server: x.server, quality: x.qualityKey })));
          } else {
            addLog('warn', 'CineCalidad', `Sin resultados en ${elapsed}ms`);
          }
          return s;
        })().catch(e => {
          addLog('error', 'CineCalidad', `Error: ${e.message}`);
          return [];
        }),
        10000
      )
    );
  }

  // 2. Cuevana (Películas y Series - Directo Vimeos)
  if (shouldRun('cuevana')) {
    providerTasks.push(
      taskWithTimeout(
        (async () => {
          const t0 = Date.now();
          addLog('info', 'Cuevana', `Buscando "${media.title}" ${isSeries ? `(T${season}E${episode})` : ''}...`);
          const s = await getCuevanaStreams(media, season, episode, config);
          const elapsed = Date.now() - t0;
          if (s.length > 0) {
            addLog('success', 'Cuevana', `Encontrados ${s.length} streams en ${elapsed}ms`, s.map(x => ({ server: x.server, quality: x.qualityKey })));
          } else {
            addLog('warn', 'Cuevana', `Sin resultados en ${elapsed}ms`);
          }
          return s;
        })().catch(e => {
          addLog('error', 'Cuevana', `Error: ${e.message}`);
          return [];
        }),
        10000
      )
    );
  }

  // 3. SeriesFlix (Series - Directo VOE)
  if (isSeries && shouldRun('seriesflix')) {
    providerTasks.push(
      taskWithTimeout(
        (async () => {
          const t0 = Date.now();
          addLog('info', 'SeriesFlix', `Buscando "${media.title}" (T${season}E${episode})...`);
          const s = await getSeriesFlixStreams(media, season, episode, config);
          const elapsed = Date.now() - t0;
          if (s.length > 0) {
            addLog('success', 'SeriesFlix', `Encontrados ${s.length} streams en ${elapsed}ms`, s.map(x => ({ server: x.server, quality: x.qualityKey })));
          } else {
            addLog('warn', 'SeriesFlix', `Sin resultados en ${elapsed}ms`);
          }
          return s;
        })().catch(e => {
          addLog('error', 'SeriesFlix', `Error: ${e.message}`);
          return [];
        }),
        10000
      )
    );
  }

  // 4. Hackstore (Películas - Torrents 4K/1080p + Directo Vimeos)
  if (!isSeries && shouldRun('hackstore')) {
    providerTasks.push(
      taskWithTimeout(
        (async () => {
          const t0 = Date.now();
          addLog('info', 'Hackstore', `Buscando "${media.title}"...`);
          const s = await getHackstoreStreams(media, season, episode, config);
          const elapsed = Date.now() - t0;
          if (s.length > 0) {
            addLog('success', 'Hackstore', `Encontrados ${s.length} streams en ${elapsed}ms`, s.map(x => ({ server: x.server, quality: x.qualityKey })));
          } else {
            addLog('warn', 'Hackstore', `Sin resultados en ${elapsed}ms`);
          }
          return s;
        })().catch(e => {
          addLog('error', 'Hackstore', `Error: ${e.message}`);
          return [];
        }),
        10000
      )
    );
  }

  // 5. PelisPlus (Películas y Series - Directo)
  if (shouldRun('pelisplus')) {
    providerTasks.push(
      taskWithTimeout(
        (async () => {
          const t0 = Date.now();
          addLog('info', 'PelisPlus', `Buscando "${media.title}" ${isSeries ? `(T${season}E${episode})` : ''}...`);
          const s = await getPelisplusStreams(media, season, episode, config);
          const elapsed = Date.now() - t0;
          if (s.length > 0) {
            addLog('success', 'PelisPlus', `Encontrados ${s.length} streams en ${elapsed}ms`, s.map(x => ({ server: x.server, quality: x.qualityKey })));
          } else {
            addLog('warn', 'PelisPlus', `Sin resultados en ${elapsed}ms`);
          }
          return s;
        })().catch(e => {
          addLog('error', 'PelisPlus', `Error: ${e.message}`);
          return [];
        }),
        10000
      )
    );
  }

  // 6. TioAnime (Para contenido de Anime)
  if (isAnime || shouldRun('tioanime')) {
    providerTasks.push(
      taskWithTimeout(
        (async () => {
          const t0 = Date.now();
          addLog('info', 'TioAnime', `Buscando "${media.title}" (E${episode || 1})...`);
          const s = await getTioanimeStreams(media, season, episode, config);
          const elapsed = Date.now() - t0;
          if (s.length > 0) {
            addLog('success', 'TioAnime', `Encontrados ${s.length} streams en ${elapsed}ms`, s.map(x => ({ server: x.server, quality: x.qualityKey })));
          } else {
            addLog('warn', 'TioAnime', `Sin resultados en ${elapsed}ms`);
          }
          return s;
        })().catch(e => {
          addLog('error', 'TioAnime', `Error: ${e.message}`);
          return [];
        }),
        10000
      )
    );
  }

  // 7. LaMovie (Respaldo opcional)
  if (shouldRun('lamovie')) {
    providerTasks.push(
      taskWithTimeout(
        (async () => {
          const s = await getLaMovieStreams(media, season, episode, config);
          return s;
        })().catch(() => []),
        10000
      )
    );
  }

  // 8. LACartoons (Respaldo para series animadas)
  if (isSeries && shouldRun('lacartoons')) {
    providerTasks.push(
      taskWithTimeout(
        (async () => {
          const s = await getLACartoonsStreams(media, season, episode, config);
          return s;
        })().catch(() => []),
        10000
      )
    );
  }

  return providerTasks;
}

/**
 * Filtra, ordena y limita streams de forma uniforme
 */
function processAndFilterStreams(rawStreams, config, isSeries = false) {
  if (!Array.isArray(rawStreams) || rawStreams.length === 0) return [];

  // A. Filtro por calidad permitida
  const allowedQualities = config.qualities || ['4k', '1080p', '720p', '480p'];
  let streams = rawStreams.filter(s => {
    const q = (s.qualityKey || '1080p').toLowerCase();
    return allowedQualities.includes(q);
  });

  // A2. Filtro de torrents deshabilitados
  if (config.disableTorrents) {
    streams = streams.filter(s => s.isDirect);
  }

  // B. Filtro por seeders mínimos en torrents
  const minSeeders = typeof config.minSeeders === 'number' ? config.minSeeders : 1;
  streams = streams.filter(s => {
    if (!s.isDirect) {
      if (minSeeders <= 1) return true;
      return (s.seeders || 0) >= minSeeders;
    }
    return true;
  });

  // C. Deduplicación por URL o InfoHash exacto
  const seenUrls = new Set();
  streams = streams.filter(s => {
    const targetUrl = s.url || s.infoHash;
    if (!targetUrl) return false;
    if (seenUrls.has(targetUrl)) return false;
    seenUrls.add(targetUrl);
    return true;
  });

  // D. Ordenamiento por prioridad y calidad
  const providerList = isSeries ? config.providers?.series : config.providers?.movie;
  const getProvRank = (p) => {
    if (!providerList || !Array.isArray(providerList)) return 999;
    const idx = providerList.indexOf(p);
    return idx === -1 ? 999 : idx;
  };

  const qRank = (q) => {
    if (q === '4k') return 4;
    if (q === '1080p') return 3;
    if (q === '720p') return 2;
    return 1;
  };

  streams.sort((a, b) => {
    // 1. Prioridad Directo primero vs Torrents primero
    if (config.priority === 'direct') {
      if (a.isDirect && !b.isDirect) return -1;
      if (!a.isDirect && b.isDirect) return 1;
    } else if (config.priority === 'torrent') {
      if (!a.isDirect && b.isDirect) return -1;
      if (a.isDirect && !b.isDirect) return 1;
    }

    // 2. Orden de prioridad de proveedores definido por el usuario
    const rankA = getProvRank(a.provider);
    const rankB = getProvRank(b.provider);
    if (rankA !== rankB) return rankA - rankB;

    // 3. Calidad más alta primero
    const diffQ = qRank(b.qualityKey) - qRank(a.qualityKey);
    if (diffQ !== 0) return diffQ;

    // 4. En torrents, ordenar por mayor número de seeders
    if (!a.isDirect && !b.isDirect) {
      return (b.seeders || 0) - (a.seeders || 0);
    }
    return 0;
  });

  // E. Límites numéricos: por proveedor y total combinado
  const maxPerProvider = Math.max(1, parseInt(config.maxWebStreamsPerProvider, 10) || 4);
  const maxTotalWeb = Math.max(1, parseInt(config.maxTotalWebStreams, 10) || 25);

  const providerCounts = {};
  const finalStreams = [];
  let totalCount = 0;

  for (const s of streams) {
    if (!s.isDirect) {
      s.name = 'TACIT STR 🧲';
      const seeds = s.seeders && s.seeders > 0 ? s.seeders : 20;
      if (s.title && !s.title.includes('personas transmitiendo') && !s.title.includes('semillas')) {
        const lines = s.title.split('\n');
        lines.splice(1, 0, `👥 ${seeds} personas transmitiendo (${seeds === 1 ? '1 semilla' : `${seeds} semillas`})`);
        s.title = lines.join('\n');
      }
    } else {
      s.name = 'TACIT STR · WEB';
    }

    const prov = s.provider || 'web_other';
    providerCounts[prov] = (providerCounts[prov] || 0);

    if (totalCount < maxTotalWeb && providerCounts[prov] < maxPerProvider) {
      finalStreams.push(s);
      providerCounts[prov]++;
      totalCount++;
    }
  }

  return finalStreams;
}

const builder = new addonBuilder(manifest);
builder.defineStreamHandler(async ({ type, id, config }) => {
  return resolveStreams(type, id, config);
});

module.exports = {
  manifest,
  addonInterface: builder.getInterface(),
  resolveStreams,
  parseConfig,
  DEFAULT_CONFIG
};
