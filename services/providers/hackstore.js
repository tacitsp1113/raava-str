const axios = require('axios');
const { cleanTitle } = require('../tmdb');
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

async function searchPosts(media, postType = 'movies') {
  const title = media.title || '';
  const clean = media.cleanTitle || cleanTitle(title);
  const cacheKey = `search_${postType}_${clean}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const query = encodeURIComponent(clean);
    const url = `${API_BASE}/search?post_type=${postType}&query=${query}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 5000 });
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

async function resolveDirectPlayer(player, media = null, season = null, episode = null) {
  if (!player || !player.url) return null;

  let resolved = null;
  let serverName = player.server || 'Directo';

  if (/vimeos/i.test(player.url) || /vimeos/i.test(player.server)) {
    resolved = await resolveVimeos(player.url, 'https://hackstore2.com/');
    serverName = 'Vimeos';
  } else if (/voe/i.test(player.url) || /voe/i.test(player.server)) {
    resolved = await resolveVoe(player.url, 'https://hackstore2.com/');
    serverName = 'VOE';
  } else if (/goodstream/i.test(player.url)) {
    resolved = { url: player.url, quality: '1080p', headers: HEADERS };
    serverName = 'GoodStream';
  }

  if (!resolved || !resolved.url) return null;

  const isAlive = await isStreamAlive(resolved.url, resolved.headers);
  if (!isAlive) return null;

  const rawQuality = player.quality || resolved.quality || '1080p';
  let qualityKey = '1080p';
  if (/4k|2160p/i.test(rawQuality)) qualityKey = '4k';
  else if (/720p/i.test(rawQuality)) qualityKey = '720p';
  else if (/480p|sd/i.test(rawQuality)) qualityKey = '480p';

  const codec = qualityKey === '4k' ? 'HEVC · HDR' : 'H.264 · SDR';
  const line1 = `🎬 ${qualityKey.toUpperCase()} · ${codec} · ${serverName}`;
  const line2 = `🇲🇽 Español Latino`;
  const line3 = (season && episode) ? `⚡ HackStore · T${season}E${episode}` : `⚡ HackStore`;

  const reqHeaders = (resolved.headers && Object.keys(resolved.headers).length > 0) ? resolved.headers : null;

  return {
    provider: 'hackstore',
    server: serverName,
    serverTier: 1,
    isDirect: true,
    qualityKey,
    seeders: 999,
    name: 'TACIT STR · WEB',
    title: `${line1}\n${line2}\n${line3}`,
    url: resolved.url,
    headers: reqHeaders || undefined,
    subtitles: (resolved.subtitles || []).map(s => ({
      id: s.lang,
      url: s.url,
      lang: s.lang === 'spa' ? 'Spanish' : 'English'
    })),
    behaviorHints: reqHeaders ? {
      proxyHeaders: {
        request: reqHeaders
      },
      notWebReady: true
    } : undefined
  };
}

async function getHackstoreStreams(media, season = null, episode = null, config = {}) {
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

    const players = await getPlayers(targetId);
    if (!Array.isArray(players) || players.length === 0) return [];

    const directItems = await Promise.all(players.map((p) => resolveDirectPlayer(p, media, season, episode)));
    return directItems.filter(Boolean);
  } catch (err) {
    console.error('[TACIT Error Hackstore]:', err.message);
    return [];
  }
}

module.exports = {
  getHackstoreStreams
};
