const { addonBuilder } = require('stremio-addon-sdk');
const { getMediaDetails } = require('./services/tmdb');
const { getHackstoreStreams } = require('./services/providers/hackstore');
const { getCinecalidadStreams } = require('./services/providers/cinecalidad');
const { getCuevanaStreams } = require('./services/providers/cuevana');
const { getPelisplusStreams } = require('./services/providers/pelisplus');
const { getTioanimeStreams } = require('./services/providers/tioanime');

const DEFAULT_CONFIG = {
  providers: ['hackstore_torrent', 'hackstore_direct', 'cinecalidad', 'cuevana', 'pelisplus', 'tioanime'],
  qualities: ['4k', '1080p', '720p'],
  maxStreams: 2,
  priority: 'direct', // 'direct' or 'torrent'
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
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (_) {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch (_) {
      return DEFAULT_CONFIG;
    }
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

    // Launch active providers intelligently according to content type
    const providerTasks = [];

    // 1. Hackstore (Torrents + Direct)
    if (config.providers.includes('hackstore_torrent') || config.providers.includes('hackstore_direct')) {
      providerTasks.push(
        getHackstoreStreams(media, season, episode, config)
          .catch(e => { console.error('[TACIT Error Hackstore]:', e.message); return []; })
      );
    }

    // 2. CineCalidad (Especialista en Películas)
    if (!isSeries && config.providers.includes('cinecalidad')) {
      providerTasks.push(
        getCinecalidadStreams(media, season, episode, config)
          .catch(e => { console.error('[TACIT Error Cinecalidad]:', e.message); return []; })
      );
    }

    // 3. Cuevana (Especialista en Películas y Series completas)
    if (config.providers.includes('cuevana')) {
      providerTasks.push(
        getCuevanaStreams(media, season, episode, config)
          .catch(e => { console.error('[TACIT Error Cuevana]:', e.message); return []; })
      );
    }

    // 4. PelisPlus (Especialista en Series y Películas)
    if (config.providers.includes('pelisplus')) {
      providerTasks.push(
        getPelisplusStreams(media, season, episode, config)
          .catch(e => { console.error('[TACIT Error Pelisplus]:', e.message); return []; })
      );
    }

    // 5. TioAnime (Especialista exclusivo en Anime)
    if (isAnime && config.providers.includes('tioanime')) {
      providerTasks.push(
        getTioanimeStreams(media, season, episode, config)
          .catch(e => { console.error('[TACIT Error Tioanime]:', e.message); return []; })
      );
    }

    const settled = await Promise.allSettled(providerTasks);
    let allStreams = [];
    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allStreams.push(...res.value);
      }
    }

    // --- FILTRADO SEGÚN PREFERENCIAS DEL USUARIO ---

    // A. Filtro por calidad permitida
    const allowedQualities = config.qualities || ['4k', '1080p', '720p'];
    allStreams = allStreams.filter(s => {
      const q = (s.qualityKey || '1080p').toLowerCase();
      return allowedQualities.includes(q);
    });

    // B. Filtro por seeders mínimos en torrents
    const minSeeders = typeof config.minSeeders === 'number' ? config.minSeeders : 1;
    allStreams = allStreams.filter(s => {
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

    allStreams.sort((a, b) => {
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

    // D. Límite de enlaces por proveedor (distribución balanceada y diversa)
    const maxPerProvider = Math.max(1, parseInt(config.maxPerProvider || config.maxStreams, 10) || 2);
    const providerCounts = {};
    const finalStreams = [];

    for (const s of allStreams) {
      const prov = s.provider || 'default';
      providerCounts[prov] = (providerCounts[prov] || 0);
      if (providerCounts[prov] < maxPerProvider) {
        finalStreams.push(s);
        providerCounts[prov]++;
      }
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
