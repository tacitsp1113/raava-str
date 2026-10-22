const axios = require('axios');
const { cleanTitle } = require('./tmdb');
const { scrapeSeeders } = require('./tracker');

const API_BASE = 'https://hackstore2.com/api/rest';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://hackstore2.com/',
  'Accept': 'application/json'
};

const DEFAULT_TRACKERS = [
  'tracker:udp://tracker.opentrackr.org:1337/announce',
  'tracker:udp://open.demonii.com:1337/announce',
  'tracker:udp://open.stealth.si:80/announce',
  'tracker:udp://tracker.torrent.eu.org:451/announce',
  'tracker:udp://tracker.openbittorrent.com:80/announce',
  'tracker:udp://explodie.org:6969/announce'
];

/**
 * Extracts infoHash and trackers from magnet URL
 */
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

/**
 * Searches posts in Hackstore API
 */
async function searchPosts(query, postType = 'movies') {
  if (!query) return [];
  try {
    const url = `${API_BASE}/search?post_type=${postType}&query=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    const posts = res.data?.data?.posts;
    return Array.isArray(posts) ? posts : [];
  } catch (err) {
    console.error(`[Hackstore] Error searching ${query} in ${postType}:`, err.message);
    return [];
  }
}

/**
 * Gets downloads for a specific post/episode ID
 */
async function getDownloads(postId) {
  if (!postId) return [];
  try {
    const url = `${API_BASE}/downloads?post_id=${postId}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    const items = res.data?.data;
    return Array.isArray(items) ? items : [];
  } catch (err) {
    console.error(`[Hackstore] Error fetching downloads for ${postId}:`, err.message);
    return [];
  }
}

/**
 * Gets all episodes for a show ID
 */
async function getEpisodes(showId) {
  if (!showId) return [];
  try {
    const url = `${API_BASE}/episodes?post_id=${showId}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    const items = res.data?.data;
    return Array.isArray(items) ? items : [];
  } catch (err) {
    console.error(`[Hackstore] Error fetching episodes for show ${showId}:`, err.message);
    return [];
  }
}

/**
 * Finds best matching post from candidate list
 */
function findBestMatch(posts, media) {
  if (!posts || posts.length === 0) return null;

  const targetClean = media.cleanTitle;
  const targetOriginalClean = media.cleanOriginalTitle;
  const targetYear = media.year;

  // 1. Exact title or original title match
  for (const post of posts) {
    const postClean = cleanTitle(post.title);
    const postOrigClean = cleanTitle(post.original_title);
    if (postClean === targetClean || postOrigClean === targetOriginalClean) {
      return post;
    }
  }

  // 2. Year match + title contains
  if (targetYear) {
    for (const post of posts) {
      const postClean = cleanTitle(post.title);
      const postYear = post.release_date ? parseInt(post.release_date.split('-')[0]) : null;
      if (postYear && Math.abs(postYear - targetYear) <= 1) {
        if (postClean.includes(targetClean) || targetClean.includes(postClean)) {
          return post;
        }
      }
    }
  }

  // 3. Fallback: match by title inclusion
  for (const post of posts) {
    const postClean = cleanTitle(post.title);
    if (postClean && (postClean.includes(targetClean) || targetClean.includes(postClean))) {
      return post;
    }
  }

  // Default to first result
  return posts[0];
}

/**
 * Formats a download item into a Stremio/Nuvio stream with seeders
 */
function formatStreamItem(item, magnetData, seedData) {
  const rawQuality = item.quality || '1080p';
  let qualityBadge = '1080p';
  if (/4k|2160p|uhd/i.test(rawQuality)) qualityBadge = '4K HDR';
  else if (/1080p|fhd|full hd/i.test(rawQuality)) qualityBadge = '1080p';
  else if (/720p|hd/i.test(rawQuality)) qualityBadge = '720p';
  else if (/dvd|sd|480p/i.test(rawQuality)) qualityBadge = 'SD';

  const size = item.size ? item.size.trim() : '';
  const lang = item.lang ? item.lang.trim() : 'Latino Dual';
  const format = item.format || 'MKV';

  let seedLabel = '👤 Swarm DHT';
  if (seedData && typeof seedData.seeders === 'number' && seedData.seeders > 0) {
    seedLabel = `👤 ${seedData.seeders} ${seedData.seeders === 1 ? 'semilla' : 'semillas'}`;
  }

  return {
    name: `RAAVA STR\n${qualityBadge}`,
    title: `🎬 ${rawQuality} (${format})\n${seedLabel} | 💾 ${size || 'Tamaño N/D'} | 🔊 ${lang}\n⚡ P2P Direct Stream`,
    infoHash: magnetData.infoHash,
    sources: magnetData.trackers,
    behaviorHints: {
      bingeGroup: `raava-str-${qualityBadge.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    }
  };
}

/**
 * Resolves streams for a movie
 */
async function getMovieStreams(media) {
  let posts = await searchPosts(media.title, 'movies');
  if (posts.length === 0 && media.originalTitle && media.originalTitle !== media.title) {
    posts = await searchPosts(media.originalTitle, 'movies');
  }

  const matched = findBestMatch(posts, media);
  if (!matched || !matched._id) return [];

  const downloads = await getDownloads(matched._id);
  const rawTorrents = downloads.filter((dl) => dl.server === 'Utorrent' || (dl.url && dl.url.startsWith('magnet:')));

  const streamPromises = rawTorrents.map(async (dl) => {
    const magnetData = parseMagnet(dl.url);
    if (!magnetData) return null;
    const announceList = magnetData.trackers.map((t) => t.replace('tracker:', ''));
    const seedData = await scrapeSeeders(magnetData.infoHash, announceList);
    return formatStreamItem(dl, magnetData, seedData);
  });

  const streams = (await Promise.all(streamPromises)).filter(Boolean);

  // Sort: 4K first, then 1080p, 720p, etc.
  streams.sort((a, b) => {
    const qOrder = (str) => {
      if (str.includes('4K')) return 4;
      if (str.includes('1080p')) return 3;
      if (str.includes('720p')) return 2;
      return 1;
    };
    return qOrder(b.name) - qOrder(a.name);
  });

  return streams;
}

/**
 * Resolves streams for a series episode
 */
async function getSeriesStreams(media, season, episode) {
  // Search in tvshows
  let posts = await searchPosts(media.title, 'tvshows');
  if (posts.length === 0 && media.originalTitle && media.originalTitle !== media.title) {
    posts = await searchPosts(media.originalTitle, 'tvshows');
  }
  // Try animes if not found
  if (posts.length === 0) {
    posts = await searchPosts(media.title, 'animes');
    if (posts.length === 0 && media.originalTitle) {
      posts = await searchPosts(media.originalTitle, 'animes');
    }
  }

  const matched = findBestMatch(posts, media);
  if (!matched || !matched._id) return [];

  const episodes = await getEpisodes(matched._id);
  const matchedEp = episodes.find(
    (e) => parseInt(e.season_number) === parseInt(season) && parseInt(e.episode_number) === parseInt(episode)
  );

  if (!matchedEp || !matchedEp._id) return [];

  const downloads = await getDownloads(matchedEp._id);
  const rawTorrents = downloads.filter((dl) => dl.server === 'Utorrent' || (dl.url && dl.url.startsWith('magnet:')));

  const streamPromises = rawTorrents.map(async (dl) => {
    const magnetData = parseMagnet(dl.url);
    if (!magnetData) return null;
    const announceList = magnetData.trackers.map((t) => t.replace('tracker:', ''));
    const seedData = await scrapeSeeders(magnetData.infoHash, announceList);
    return formatStreamItem(dl, magnetData, seedData);
  });

  const streams = (await Promise.all(streamPromises)).filter(Boolean);

  streams.sort((a, b) => {
    const qOrder = (str) => {
      if (str.includes('4K')) return 4;
      if (str.includes('1080p')) return 3;
      if (str.includes('720p')) return 2;
      return 1;
    };
    return qOrder(b.name) - qOrder(a.name);
  });

  return streams;
}

module.exports = {
  getMovieStreams,
  getSeriesStreams
};
