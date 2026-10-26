const { addonBuilder } = require('stremio-addon-sdk');
const { getMediaDetails } = require('./services/tmdb');
const { getHackstoreStreams } = require('./services/providers/hackstore');
const { getCinecalidadStreams } = require('./services/providers/cinecalidad');
const { getCuevanaStreams } = require('./services/providers/cuevana');
const { getPelisplusStreams } = require('./services/providers/pelisplus');
const { getTioanimeStreams } = require('./services/providers/tioanime');
const { getYandexStreams } = require('./services/providers/yandex');

const DEFAULT_CONFIG = {
  mode: 'balanced', // 'cloud' | 'balanced' | 'full'
  scraperScope: 'specialized', // 'specialized' | 'global'
  providers: ['yandex', 'hackstore_torrent', 'hackstore_direct', 'cinecalidad', 'cuevana', 'pelisplus', 'tioanime'],
  qualities: ['4k', '1080p', '720p', '480p'],
  disableTorrents: false,
  priority: 'direct', // 'direct' | 'torrent'
  maxCloudStreams: 10,
  maxWebStreams: 3,
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
    // Retrocompatibilidad inteligente
    if (parsed.universalSearch) cfg.scraperScope = 'global';
    if (!cfg.mode) cfg.mode = 'balanced';
    if (!cfg.scraperScope) cfg.scraperScope = 'specialized';
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
 * Core stream resolver supporting both IMDb (tt...) and TMDB (tmdb:...)
 */
async function resolveStreams(type, id, rawConfig = null) {
  const cacheKey = `${type}:${id}:${rawConfig || 'default'}`;
  const cached = getCachedStreams(cacheKey);
  if (cached) {
    console.log(`[TACIT Cache HIT] ${type}:${id} returning ${cached.streams.length} stream(s)`);
    return cached;
  }

  const config = parseConfig(rawConfig);
  console.log(`[TACIT Request] Type: ${type}, ID: ${id}, Providers: ${config.providers.join(',')}, Max: ${config.maxStreams}`);

  try {
    let mediaId = id;
    let season = null;
    let episode = null;

    if (id.startsWith('tmdb:')) {
      const parts = id.split(':');
      mediaId = `tmdb:${parts[1]}`;
      if (parts.length >= 4) {
        season = parts[2];
        episode = parts[3];
      }
    } else if (id.includes(':')) {
      const parts = id.split(':');
      mediaId = parts[0];
      season = parts[1];
      episode = parts[2];
    }

    const effectiveType = type === 'anime' ? (season && episode ? 'series' : 'movie') : type;
    const media = await getMediaDetails(effectiveType, mediaId);
    if (!media) {
      console.log(`[TACIT] Could not resolve media details for ID: ${id}`);
      return { streams: [] };
    }

    const isSeries = Boolean(season && episode);
    const isAnime = type === 'anime' || /anime/i.test(media.genres || '');

    let finalStreams = [];

    // MODO 1: SOLO NUBE (Exclusivamente biblioteca interna SQLite, cero peticiones web)
    if (config.mode === 'cloud') {
      try {
        const cloudStreams = await getYandexStreams(media, season, episode, config);
        finalStreams = processAndFilterStreams(cloudStreams, config);
        console.log(`[TACIT Solo Nube] ${finalStreams.length} enlace(s) entregados desde SQLite.`);
      } catch (e) {
        console.error('[TACIT Error Solo Nube]:', e.message);
      }
    }
    // MODO 2: EQUILIBRADO (Nube primero; si no existe, activa contingencia de páginas web)
    else if (config.mode === 'balanced' || config.smartMode) {
      let cloudStreams = [];
      if (config.providers.includes('yandex')) {
        try {
          cloudStreams = await getYandexStreams(media, season, episode, config);
        } catch (e) {
          console.error('[TACIT Error Nube Equilibrado]:', e.message);
        }
      }

      const filteredCloud = processAndFilterStreams(cloudStreams, config);
      if (filteredCloud.length > 0) {
        console.log(`[TACIT Equilibrado] Encontrado en la nube (${filteredCloud.length} enlaces). Respondiendo de inmediato sin consultar la web.`);
        finalStreams = filteredCloud;
      } else {
        console.log(`[TACIT Equilibrado] No encontrado en la nube. Activando páginas web de respaldo...`);
        const providerTasks = buildWebTasks(media, season, episode, isSeries, isAnime, config);
        const settled = await Promise.allSettled(providerTasks);
        const webStreams = [];
        for (const res of settled) {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            webStreams.push(...res.value);
          }
        }
        finalStreams = processAndFilterStreams(webStreams, config);
      }
    }
    // MODO 3: CATÁLOGO COMPLETO (Nube y todas las páginas web consultadas en paralelo a la par)
    else {
      console.log(`[TACIT Catálogo Completo] Consultando nube y todas las páginas web a la par...`);
      const allTasks = [];
      if (config.providers.includes('yandex')) {
        allTasks.push(
          getYandexStreams(media, season, episode, config)
            .catch(e => { console.error('[TACIT Error Nube Full]:', e.message); return []; })
        );
      }
      allTasks.push(...buildWebTasks(media, season, episode, isSeries, isAnime, config));
      const settled = await Promise.allSettled(allTasks);
      const combined = [];
      for (const res of settled) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          combined.push(...res.value);
        }
      }
      finalStreams = processAndFilterStreams(combined, config);
    }

    console.log(`[TACIT] Returning ${finalStreams.length} stream(s) for "${media.title}"`);
    const result = { streams: finalStreams };
    if (finalStreams.length > 0) {
      setCachedStreams(cacheKey, result);
    }
    return result;
  } catch (error) {
    console.error(`[TACIT Error] Failed to handle stream for ${id}:`, error);
    return { streams: [] };
  }
}

/**
 * Genera las tareas de consulta para proveedores web externos
 */
function buildWebTasks(media, season, episode, isSeries, isAnime, config) {
  const providerTasks = [];
  const allowTorrents = !config.disableTorrents;
  const wantTorrents = allowTorrents && config.providers.includes('hackstore_torrent');
  const wantDirect = config.providers.includes('hackstore_direct');
  const isGlobal = config.scraperScope === 'global';

  // 1. Hackstore (Películas o Modo Global)
  if ((!isSeries || isGlobal) && (wantTorrents || wantDirect)) {
    const hConfig = { ...config, allowTorrents };
    providerTasks.push(
      getHackstoreStreams(media, season, episode, hConfig)
        .catch(e => { console.error('[TACIT Error Hackstore]:', e.message); return []; })
    );
  }

  // 2. CineCalidad (Películas o Modo Global)
  if ((!isSeries || isGlobal) && config.providers.includes('cinecalidad')) {
    providerTasks.push(
      getCinecalidadStreams(media, season, episode, config)
        .catch(e => { console.error('[TACIT Error Cinecalidad]:', e.message); return []; })
    );
  }

  // 3. Cuevana (Series o Modo Global)
  if ((isSeries || isGlobal) && config.providers.includes('cuevana')) {
    providerTasks.push(
      getCuevanaStreams(media, season, episode, config)
        .catch(e => { console.error('[TACIT Error Cuevana]:', e.message); return []; })
    );
  }

  // 4. PelisPlus (Series o Modo Global)
  if ((isSeries || isGlobal) && config.providers.includes('pelisplus')) {
    providerTasks.push(
      getPelisplusStreams(media, season, episode, config)
        .catch(e => { console.error('[TACIT Error Pelisplus]:', e.message); return []; })
    );
  }

  // 5. TioAnime (Anime o Modo Global)
  if ((isAnime || isGlobal) && config.providers.includes('tioanime')) {
    providerTasks.push(
      getTioanimeStreams(media, season, episode, config)
        .catch(e => { console.error('[TACIT Error Tioanime]:', e.message); return []; })
    );
  }

  return providerTasks;
}

/**
 * Filtra, ordena y limita streams de forma uniforme
 */
function processAndFilterStreams(rawStreams, config) {
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

  // C. Ordenamiento por prioridad y estabilidad de servidor
  const qRank = (q) => {
    if (q === '4k') return 4;
    if (q === '1080p') return 3;
    if (q === '720p') return 2;
    return 1;
  };

  streams.sort((a, b) => {
    // 0. Enlace recomendado primero
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

    // 2. Servidores directos: Tier 1 (Vimeos/VOE) antes que Tier 2 (VidHide)
    if (a.isDirect && b.isDirect) {
      const tierA = a.serverTier || 1;
      const tierB = b.serverTier || 1;
      if (tierA !== tierB) return tierA - tierB;
    }

    // 3. Dentro de la misma categoría, ordenar por calidad
    const diffQ = qRank(b.qualityKey) - qRank(a.qualityKey);
    if (diffQ !== 0) return diffQ;

    // 4. Si son torrents, ordenar por seeders
    if (!a.isDirect && !b.isDirect) {
      return (b.seeders || 0) - (a.seeders || 0);
    }
    return 0;
  });

  // D. Límite de enlaces por proveedor (separando Cloud vs Web)
  const maxCloud = Math.max(1, parseInt(config.maxCloudStreams || config.maxStreams, 10) || 10);
  const maxWeb = Math.max(1, parseInt(config.maxWebStreams || config.maxStreams, 10) || 3);
  const providerCounts = {};
  const finalStreams = [];

  for (const s of streams) {
    // Normalizar la insignia en Stremio: TACIT STR (Nube), TACIT STR 🧲 (Torrents) o TACIT STR · WEB (Web)
    if (s.provider === 'yandex') {
      s.name = 'TACIT STR';
    } else if (!s.isDirect) {
      s.name = 'TACIT STR 🧲';
    } else {
      s.name = 'TACIT STR · WEB';
    }

    const prov = s.provider || 'default';
    const limit = prov === 'yandex' ? maxCloud : maxWeb;
    providerCounts[prov] = (providerCounts[prov] || 0);
    if (providerCounts[prov] < limit) {
      finalStreams.push(s);
      providerCounts[prov]++;
    }
  }

  return finalStreams;
}

const builder = new addonBuilder(manifest);
builder.defineStreamHandler(async ({ type, id }) => {
  return resolveStreams(type, id, null);
});

module.exports = {
  manifest,
  addonInterface: builder.getInterface(),
  resolveStreams,
  parseConfig,
  DEFAULT_CONFIG
};
