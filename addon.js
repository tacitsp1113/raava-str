const { addonBuilder } = require('stremio-addon-sdk');
const { getMediaDetails } = require('./services/tmdb');
const { getYandexStreams } = require('./services/providers/yandex');
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
  mode: 'balanced', // 'cloud' | 'balanced' | 'full'
  providers: {
    movie: [
      'cinecalidad',
      'cuevana',
      'pelisplus'
    ],
    series: [
      'seriesflix',
      'cinecalidad',
      'cuevana',
      'pelisplus'
    ]
  },
  qualities: ['4k', '1080p', '720p', '480p'],
  disableTorrents: true,
  priority: 'direct', // 'direct' | 'torrent'
  maxCloudStreams: 10,
  maxWebStreamsPerProvider: 3, // Límite por sitio
  maxTotalWebStreams: 6,       // Límite total web combinado
  minSeeders: 1
};

// In-memory cache for resolved streams (TTL: 30 minutes)
const streamCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCachedStreams(key) {
  const item = streamCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    streamCache.delete(key);
    return null;
  }
  return item.data;
}

function setCachedStreams(key, data) {
  if (streamCache.size > 500) {
    const oldestKey = streamCache.keys().next().value;
    streamCache.delete(oldestKey);
  }
  streamCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function parseConfig(raw) {
  if (!raw || typeof raw !== 'string') return DEFAULT_CONFIG;
  try {
    let parsed;
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      parsed = JSON.parse(decoded);
    } catch (_) {
      parsed = JSON.parse(decodeURIComponent(raw));
    }
    const cfg = { ...DEFAULT_CONFIG, ...parsed };

    // Asegurar estructura de providers { movie: [], series: [] }
    if (!cfg.providers || typeof cfg.providers !== 'object' || Array.isArray(cfg.providers)) {
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

    if (!cfg.mode) cfg.mode = 'balanced';
    return cfg;
  } catch (_) {
    return DEFAULT_CONFIG;
  }
}

const manifest = {
  id: 'org.tacit.str',
  version: '1.0.0',
  name: 'TACIT STR',
  description: 'Películas, series y anime en Español Latino. Enlaces híbridos (Torrents 4K/1080p y Directo Vimeos/VOE).',
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
  const cacheKey = `${config.mode}:${config.priority}:${config.disableTorrents}:${provKey}:${config.maxTotalWebStreams}:${type}:${id}`;

  const cached = getCachedStreams(cacheKey);
  if (cached) {
    console.log(`[TACIT Cache] Instant HIT for ${id}`);
    return cached;
  }

  console.log(`[TACIT Request] Resolving streams for type=${type}, id=${id}, mode=${config.mode}`);

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

    let finalStreams = [];

    // MODO 0: SOLO RASPADORES (Omite SQLite al 100% para pruebas puras de CineCalidad y SeriesFlix)
    if (config.mode === 'scrapers' || config.maxCloudStreams === 0) {
      addLog('info', 'Scrapers', `Modo Solo Raspadores activo. Omitiendo SQLite y consultando páginas web...`);
      const providerTasks = buildWebTasks(media, season, episode, isSeries, isAnime, config);
      const settled = await Promise.allSettled(providerTasks);
      const webStreams = [];
      for (const res of settled) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          webStreams.push(...res.value);
        }
      }
      finalStreams = processAndFilterStreams(webStreams, config, isSeries);
    }
    // MODO 1: SOLO NUBE (Exclusivamente biblioteca interna SQLite, cero peticiones web)
    else if (config.mode === 'cloud') {
      try {
        const cloudStreams = await getYandexStreams(media, season, episode, config);
        finalStreams = processAndFilterStreams(cloudStreams, config, isSeries);
        addLog('info', 'TACIT Cloud', `Entregados ${finalStreams.length} stream(s) desde SQLite`);
      } catch (e) {
        addLog('error', 'TACIT Cloud', `Error: ${e.message}`);
      }
    }
    // MODO 2: EQUILIBRADO (Nube primero; si no existe, activa contingencia de páginas web)
    else if (config.mode === 'balanced') {
      let cloudStreams = [];
      try {
        cloudStreams = await getYandexStreams(media, season, episode, config);
      } catch (e) {
        console.error('[TACIT Error Nube Equilibrado]:', e.message);
      }

      const filteredCloud = processAndFilterStreams(cloudStreams, config, isSeries);
      if (filteredCloud.length > 0) {
        addLog('success', 'TACIT Cloud', `Encontrado en nube (${filteredCloud.length} enlaces). Respondiendo instantáneo.`);
        finalStreams = filteredCloud;
      } else {
        addLog('info', 'Scrapers', `No encontrado en nube. Activando CineCalidad y SeriesFlix...`);
        const providerTasks = buildWebTasks(media, season, episode, isSeries, isAnime, config);
        const settled = await Promise.allSettled(providerTasks);
        const webStreams = [];
        for (const res of settled) {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            webStreams.push(...res.value);
          }
        }
        finalStreams = processAndFilterStreams(webStreams, config, isSeries);
      }
    }
    // MODO 3: CATÁLOGO COMPLETO (Nube y páginas web consultadas en paralelo a la par)
    else {
      addLog('info', 'Scrapers', `Consultando nube, CineCalidad y SeriesFlix en paralelo...`);
      const allTasks = [
        getYandexStreams(media, season, episode, config)
          .catch(e => { console.error('[TACIT Error Nube Full]:', e.message); return []; }),
        ...buildWebTasks(media, season, episode, isSeries, isAnime, config)
      ];
      const settled = await Promise.allSettled(allTasks);
      const combined = [];
      for (const res of settled) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          combined.push(...res.value);
        }
      }
      finalStreams = processAndFilterStreams(combined, config, isSeries);
    }

    addLog('success', 'TACIT', `Finalizado: entregando ${finalStreams.length} stream(s) para "${media.title}"`, finalStreams.map(f => ({ name: f.name, title: f.title?.split('\n')[0] })));
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

function taskWithTimeout(taskPromise, ms = 11000) {
  return Promise.race([
    taskPromise,
    new Promise(resolve => setTimeout(() => resolve([]), ms))
  ]);
}

/**
 * Genera las tareas de consulta para proveedores web externos según el tipo de contenido
 * [MODO AISLADO]: Únicamente SeriesFlix y CineCalidad activos. Los demás proveedores pausados temporalmente.
 */
function buildWebTasks(media, season, episode, isSeries, isAnime, config) {
  const providerTasks = [];

  // 1. SeriesFlix — Especialista en Series de TV en Audio Latino (VOE / StreamWish)
  if (isSeries) {
    providerTasks.push(
      taskWithTimeout(
        (async () => {
          const t0 = Date.now();
          addLog('info', 'SeriesFlix', `Buscando serie "${media.title}" T${season}E${episode}...`);
          const s = await getSeriesFlixStreams(media, season, episode, config);
          const elapsed = Date.now() - t0;
          if (s.length > 0) {
            addLog('success', 'SeriesFlix', `Encontrados ${s.length} streams en ${elapsed}ms`, s.map(x => ({ server: x.server, quality: x.qualityKey, audio: x.audio })));
          } else {
            addLog('warn', 'SeriesFlix', `Sin resultados en ${elapsed}ms`);
          }
          return s;
        })().catch(e => {
          addLog('error', 'SeriesFlix', `Error: ${e.message}`);
          return [];
        }),
        11000
      )
    );
  }

  // 2. CineCalidad — Películas y Series en 1080p (VOE / Vimeos)
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
      11000
    )
  );

  // 3. Cuevana — Respaldo general para Series y Películas (Vimeos / FileLions / StreamWish)
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
      11000
    )
  );

  // 4. PelisPlus — Respaldo para Series y Películas (StreamWish / Vidhide / Directo)
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
      11000
    )
  );

  // --- PROVEEDORES PAUSADOS TEMPORALMENTE ---
  // (LaMovie, Hackstore Direct, Hackstore Torrents, TioAnime, LACartoons)

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

  // C. Deduplicación por URL exacta
  const seenUrls = new Set();
  streams = streams.filter(s => {
    const targetUrl = s.url || s.infoHash;
    if (!targetUrl) return false;
    if (seenUrls.has(targetUrl)) return false;
    seenUrls.add(targetUrl);
    return true;
  });

  // D. Ordenamiento por prioridad, orden de proveedores y calidad
  const providerList = isSeries ? config.providers?.series : config.providers?.movie;
  const getProvRank = (p) => {
    if (p === 'yandex') return -1;
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
    // 0. Enlace recomendado de la nube primero
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;

    // 1. Prioridad: Directo primero vs Torrents primero
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

  // E. Límites numéricos: Límite por sitio + Límite total web combinado
  const maxCloud = Math.max(1, parseInt(config.maxCloudStreams, 10) || 10);
  const maxPerProvider = Math.max(1, parseInt(config.maxWebStreamsPerProvider, 10) || 2);
  const maxTotalWeb = Math.max(1, parseInt(config.maxTotalWebStreams, 10) || 6);

  const providerCounts = {};
  const finalStreams = [];
  let totalWebCount = 0;

  for (const s of streams) {
    const isCloud = s.provider === 'yandex';

    // Normalizar insignia del stream en Stremio
    if (isCloud) {
      s.name = 'TACIT STR';
    } else if (!s.isDirect) {
      s.name = 'TACIT STR 🧲';
    } else {
      s.name = 'TACIT STR · WEB';
    }

    if (isCloud) {
      providerCounts['yandex'] = (providerCounts['yandex'] || 0);
      if (providerCounts['yandex'] < maxCloud) {
        finalStreams.push(s);
        providerCounts['yandex']++;
      }
    } else {
      // Stream web (directo o torrent)
      const prov = s.provider || 'web_other';
      providerCounts[prov] = (providerCounts[prov] || 0);

      if (totalWebCount < maxTotalWeb && providerCounts[prov] < maxPerProvider) {
        finalStreams.push(s);
        providerCounts[prov]++;
        totalWebCount++;
      }
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
