const axios = require('axios');
const { cleanTitle } = require('../tmdb');
const { scrapeSeeders } = require('../tracker');
const { resolveVimeos } = require('../extractors/vimeos');
const { resolveVoe } = require('../extractors/voe');
const { isStreamAlive } = require('../extractors/validator');

const API_BASE = 'https://hackstore2.com/api/rest';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://hackstore2.com/',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'es-MX,es-ES;q=0.9,es;q=0.8,en;q=0.7'
};

const DEFAULT_TRACKERS = [
  'tracker:udp://tracker.opentrackr.org:1337/announce',
  'tracker:udp://open.demonii.com:1337/announce',
  'tracker:udp://open.stealth.si:80/announce',
  'tracker:udp://tracker.torrent.eu.org:451/announce',
  'tracker:udp://tracker.openbittorrent.com:80/announce',
  'tracker:udp://explodie.org:6969/announce'
];

// In-memory cache con TTL de 15 minutos para evitar baneos de IP y peticiones duplicadas
const apiCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCached(key) {
  const item = apiCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    apiCache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data) {
  if (apiCache.size > 500) {
    const oldest = apiCache.keys().next().value;
    apiCache.delete(oldest);
  }
  apiCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function parseMagnet(magnetUrl) {
  if (!magnetUrl || typeof magnetUrl !== 'string') return null;
  const xtMatch = magnetUrl.match(/xt=urn:btih:([a-fA-F0-9]{40})/i);
  if (!xtMatch) return null;
  const infoHash = xtMatch[1].toLowerCase();

  const trackers = [];
  const trMatches = magnetUrl.matchAll(/tr=([^&]+)/g);
  for (const m of trMatches) {
    try {
      const decoded = decodeURIComponent(m[1]);
      if (decoded && !trackers.includes(`tracker:${decoded}`)) {
        trackers.push(`tracker:${decoded}`);
      }
    } catch (_) {}
  }

  for (const dt of DEFAULT_TRACKERS) {
    if (!trackers.includes(dt)) {
      trackers.push(dt);
    }
  }

  return { infoHash, trackers };
}

async function queryHackstoreApi(query, postType = 'movies') {
  if (!query) return [];
  const cacheKey = `search_${postType}_${query.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE}/search?post_type=${postType}&query=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 4000 });
    const posts = res.data?.data?.posts;
    const result = Array.isArray(posts) ? posts : [];
    setCached(cacheKey, result);
    return result;
  } catch (err) {
    return [];
  }
}

async function searchPosts(media, postType = 'movies') {
  // Estrategia 1: Título limpio sin símbolos
  const cleanQ = media.title.replace(/[&:\-–]/g, ' ').replace(/\s+/g, ' ').trim();
  let posts = await queryHackstoreApi(cleanQ, postType);
  if (posts.length > 0 && hasRelevantMatch(posts, media)) return posts;

  // Estrategia 2: cleanTitle normalizado
  if (media.cleanTitle && media.cleanTitle !== cleanQ) {
    posts = await queryHackstoreApi(media.cleanTitle, postType);
    if (posts.length > 0 && hasRelevantMatch(posts, media)) return posts;
  }

  // Estrategia 3: Título original en inglés
  if (media.originalTitle && media.originalTitle !== media.title) {
    posts = await queryHackstoreApi(media.originalTitle.replace(/[&:\-–]/g, ' ').trim(), postType);
    if (posts.length > 0 && hasRelevantMatch(posts, media)) return posts;
  }

  // Estrategia 4: Primera palabra clave (mínimo 3 caracteres)
  const firstWord = (media.cleanTitle || '').split(' ')[0];
  if (firstWord && firstWord.length >= 3 && firstWord !== cleanQ) {
    posts = await queryHackstoreApi(firstWord, postType);
    if (posts.length > 0 && hasRelevantMatch(posts, media)) return posts;
  }

  return [];
}

function hasRelevantMatch(posts, media) {
  const targetClean = media.cleanTitle || cleanTitle(media.title || '');
  if (!targetClean) return false;
  for (const post of posts) {
    const pClean = cleanTitle(post.title || '');
    if (pClean && (pClean.includes(targetClean) || targetClean.includes(pClean))) return true;
    if (post.release_date && media.year) {
      const pYear = parseInt(post.release_date.split('-')[0], 10);
      if (Math.abs(pYear - media.year) <= 1 && pClean.includes(targetClean.split(' ')[0])) return true;
    }
  }
  return false;
}

async function getDownloads(postId) {
  if (!postId) return [];
  const cacheKey = `dl_${postId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE}/downloads?post_id=${postId}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 4000 });
    const items = res.data?.data;
    const result = Array.isArray(items) ? items : [];
    setCached(cacheKey, result);
    return result;
  } catch (err) {
    return [];
  }
}

async function getPlayers(postId) {
  if (!postId) return [];
  const cacheKey = `player_${postId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE}/player?post_id=${postId}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 4000 });
    const items = res.data?.data;
    const result = Array.isArray(items) ? items : [];
    setCached(cacheKey, result);
    return result;
  } catch (err) {
    return [];
  }
}

async function getEpisodes(showId) {
  if (!showId) return [];
  const cacheKey = `episodes_${showId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE}/episodes?post_id=${showId}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 4000 });
    const items = res.data?.data;
    const result = Array.isArray(items) ? items : [];
    setCached(cacheKey, result);
    return result;
  } catch (err) {
    return [];
  }
}

function findBestMatch(posts, media) {
  if (!posts || posts.length === 0) return null;

  const targetClean = media.cleanTitle || cleanTitle(media.title || '');
  const targetOriginalClean = media.cleanOriginalTitle || cleanTitle(media.originalTitle || '');
  const targetYear = media.year;

  // 1. Coincidencia exacta limpia
  for (const post of posts) {
    const postClean = cleanTitle(post.title);
    const postOrigClean = cleanTitle(post.original_title);
    if (postClean === targetClean || postOrigClean === targetOriginalClean) {
      return post;
    }
  }

  // 2. Coincidencia de año + inclusión de título
  if (targetYear) {
    for (const post of posts) {
      const postClean = cleanTitle(post.title);
      const postYear = post.release_date ? parseInt(post.release_date.split('-')[0], 10) : null;
      if (postYear && Math.abs(postYear - targetYear) <= 1) {
        if (postClean.includes(targetClean) || targetClean.includes(postClean)) {
          return post;
        }
      }
    }
  }

  // 3. Fallback inclusión de título
  for (const post of posts) {
    const postClean = cleanTitle(post.title);
    if (postClean && (postClean.includes(targetClean) || targetClean.includes(postClean))) {
      return post;
    }
  }

  return posts[0];
}

function formatTorrentItem(item, magnetData, seedData, media = null, season = null, episode = null) {
  const rawQuality = item.quality || '1080p';
  let qualityBadge = '1080p';
  let qualityKey = '1080p';
  if (/4k|2160p|uhd/i.test(rawQuality)) { qualityBadge = '4K'; qualityKey = '4k'; }
  else if (/1080p|fhd|full hd/i.test(rawQuality)) { qualityBadge = '1080p'; qualityKey = '1080p'; }
  else if (/720p|hd/i.test(rawQuality)) { qualityBadge = '720p'; qualityKey = '720p'; }
  else { qualityBadge = 'SD'; qualityKey = '480p'; }

  const size = item.size ? item.size.trim() : null;
  const seeders = (seedData && typeof seedData.seeders === 'number') ? seedData.seeders : 0;

  const tLine1 = `🧲 ${qualityBadge.toUpperCase()} · SDR`;
  const tLine2 = `🇲🇽 ES`;
  const tLine3 = (season && episode) ? `⚡ T${season} · E${episode}` : `⚡ ${media?.title || 'Video'}`;
  const tLines = [tLine1, tLine2, tLine3];
  if (size) tLines.push(`📦 ${size}`);

  return {
    provider: 'hackstore_torrent',
    isDirect: false,
    qualityKey,
    seeders,
    name: 'TACIT STR 🧲',
    title: tLines.join('\n'),
    infoHash: magnetData.infoHash,
    sources: magnetData.trackers
  };
}

async function resolveDirectPlayer(player, media = null, season = null, episode = null) {
  if (!player || !player.url) return null;
  const url = player.url.trim();

  let resolved = null;
  let serverName = 'Directo';

  if (url.includes('vimeos.net') || url.includes('vimeos.zip')) {
    serverName = 'Vimeos';
    resolved = await resolveVimeos(url);
  } else if (url.includes('goodstream.one')) {
    serverName = 'Goodstream';
    try {
      const gRes = await axios.get(url, { headers: HEADERS, timeout: 4000 });
      const m3u8Match = gRes.data.match(/file:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (m3u8Match) {
        resolved = {
          url: m3u8Match[1],
          quality: '720p',
          headers: { 'Referer': 'https://goodstream.one/' }
        };
      }
    } catch (_) {}
  } else if (url.includes('voe.sx') || url.includes('voe-unblock') || url.includes('repackager')) {
    serverName = 'VOE';
    try {
      resolved = await resolveVoe(url);
    } catch (_) {}
  }

  if (!resolved || !resolved.url) return null;

  // Validación en tiempo real (1500 ms) para evitar enviar enlaces caídos
  const alive = await isStreamAlive(resolved.url, resolved.headers || { 'Referer': 'https://vimeos.net/' });
  if (!alive) return null;

  const rawQuality = player.quality || resolved.quality || '1080p';
  let qualityBadge = '1080p';
  let qualityKey = '1080p';
  if (/4k|2160p|uhd/i.test(rawQuality)) { qualityBadge = '4K'; qualityKey = '4k'; }
  else if (/1080p|full hd|fhd/i.test(rawQuality)) { qualityBadge = '1080p'; qualityKey = '1080p'; }
  else if (/720p|hd/i.test(rawQuality)) { qualityBadge = '720p'; qualityKey = '720p'; }
  else { qualityBadge = 'SD'; qualityKey = '480p'; }

  const line1 = `🎬 ${qualityBadge.toUpperCase()} · SDR`;
  const line2 = `🇲🇽 ES`;
  const line3 = (season && episode) ? `⚡ T${season} · E${episode}` : `⚡ ${media?.title || 'Video'}`;

  return {
    provider: 'hackstore_direct',
    server: serverName,
    serverTier: 1,
    isDirect: true,
    qualityKey,
    seeders: 999,
    name: 'TACIT STR · WEB',
    title: `${line1}\n${line2}\n${line3}`,
    url: resolved.url,
    subtitles: (resolved.subtitles || []).map(s => ({
      id: s.lang,
      url: s.url,
      lang: s.lang === 'spa' ? 'Spanish' : 'English'
    })),
    behaviorHints: {
      notWebReady: false
    }
  };
}

async function getHackstoreStreams(media, season = null, episode = null, config = {}) {
  const wantTorrents = config.wantTorrents !== undefined
    ? config.wantTorrents
    : (Array.isArray(config.providers) ? config.providers.includes('hackstore_torrent') : true);
  const wantDirect = config.wantDirect !== undefined
    ? config.wantDirect
    : (Array.isArray(config.providers) ? config.providers.includes('hackstore_direct') : true);

  if (!wantTorrents && !wantDirect) return [];

  const isSeries = Boolean(season && episode);
  let posts = [];

  try {
    if (isSeries) {
      posts = await searchPosts(media, 'tvshows');
      if (posts.length === 0) {
        posts = await searchPosts(media, 'animes');
      }
    } else {
      posts = await searchPosts(media, 'movies');
    }

    const matched = findBestMatch(posts, media);
    if (!matched || !matched._id) return [];

    let targetId = matched._id;
    if (isSeries) {
      const episodes = await getEpisodes(matched._id);
      const matchedEp = episodes.find(
        (e) => parseInt(e.season_number, 10) === parseInt(season, 10) && parseInt(e.episode_number, 10) === parseInt(episode, 10)
      );
      if (!matchedEp || !matchedEp._id) return [];
      targetId = matchedEp._id;
    }

    const promises = [];

    // 1. Torrents P2P
    if (wantTorrents) {
      promises.push(
        getDownloads(targetId).then(async (downloads) => {
          const rawTorrents = downloads.filter((dl) => dl.server === 'Utorrent' || (dl.url && dl.url.startsWith('magnet:')));
          const items = await Promise.all(
            rawTorrents.map(async (dl) => {
              const magnetData = parseMagnet(dl.url);
              if (!magnetData) return null;
              const announceList = magnetData.trackers.map((t) => t.replace('tracker:', ''));
              const seedData = await scrapeSeeders(magnetData.infoHash, announceList);
              return formatTorrentItem(dl, magnetData, seedData, media, season, episode);
            })
          );
          return items.filter(Boolean);
        }).catch(() => [])
      );
    }

    // 2. Direct Web Players (Vimeos, etc.)
    if (wantDirect) {
      promises.push(
        getPlayers(targetId).then(async (players) => {
          const directItems = await Promise.all(players.map((p) => resolveDirectPlayer(p, media, season, episode)));
          return directItems.filter(Boolean);
        }).catch(() => [])
      );
    }

    const results = await Promise.all(promises);
    return results.flat();
  } catch (err) {
    console.error('[TACIT Error Hackstore]:', err.message);
    return [];
  }
}

module.exports = {
  getHackstoreStreams
};
