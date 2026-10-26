const axios = require('axios');
const { cleanTitle } = require('../tmdb');
const { scrapeSeeders } = require('../tracker');
const { resolveVimeos } = require('../extractors/vimeos');
const { isStreamAlive } = require('../extractors/validator');

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
  try {
    const url = `${API_BASE}/search?post_type=${postType}&query=${encodeURIComponent(query)}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 5000 });
    const posts = res.data?.data?.posts;
    return Array.isArray(posts) ? posts : [];
  } catch (err) {
    return [];
  }
}

async function searchPosts(media, postType = 'movies') {
  // Strategy 1: Search raw title without & or colons
  const cleanQ = media.title.replace(/[&:\-–]/g, ' ').replace(/\s+/g, ' ').trim();
  let posts = await queryHackstoreApi(cleanQ, postType);
  if (posts.length > 0 && hasRelevantMatch(posts, media)) return posts;

  // Strategy 2: Search cleanTitle
  if (media.cleanTitle && media.cleanTitle !== cleanQ) {
    posts = await queryHackstoreApi(media.cleanTitle, postType);
    if (posts.length > 0 && hasRelevantMatch(posts, media)) return posts;
  }

  // Strategy 3: Search original title
  if (media.originalTitle && media.originalTitle !== media.title) {
    posts = await queryHackstoreApi(media.originalTitle.replace(/[&:\-–]/g, ' ').trim(), postType);
    if (posts.length > 0 && hasRelevantMatch(posts, media)) return posts;
  }

  // Strategy 4: Search primary keyword (e.g. "Deadpool")
  const firstWord = media.cleanTitle.split(' ')[0];
  if (firstWord && firstWord.length >= 3) {
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
      if (Math.abs(pYear - media.year) <= 1 && (pClean.includes(targetClean.split(' ')[0]))) return true;
    }
  }
  return false;
}

async function getDownloads(postId) {
  if (!postId) return [];
  try {
    const url = `${API_BASE}/downloads?post_id=${postId}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 5000 });
    const items = res.data?.data;
    return Array.isArray(items) ? items : [];
  } catch (err) {
    return [];
  }
}

async function getPlayers(postId) {
  if (!postId) return [];
  try {
    const url = `${API_BASE}/player?post_id=${postId}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 5000 });
    const items = res.data?.data;
    return Array.isArray(items) ? items : [];
  } catch (err) {
    return [];
  }
}

async function getEpisodes(showId) {
  if (!showId) return [];
  try {
    const url = `${API_BASE}/episodes?post_id=${showId}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 5000 });
    const items = res.data?.data;
    return Array.isArray(items) ? items : [];
  } catch (err) {
    return [];
  }
}

function findBestMatch(posts, media) {
  if (!posts || posts.length === 0) return null;

  const targetClean = media.cleanTitle;
  const targetOriginalClean = media.cleanOriginalTitle;
  const targetYear = media.year;

  // 1. Exact clean title match
  for (const post of posts) {
    const postClean = cleanTitle(post.title);
    const postOrigClean = cleanTitle(post.original_title);
    if (postClean === targetClean || postOrigClean === targetOriginalClean) {
      return post;
    }
  }

  // 2. Year match + title inclusion
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

  // 3. Fallback title inclusion
  for (const post of posts) {
    const postClean = cleanTitle(post.title);
    if (postClean && (postClean.includes(targetClean) || targetClean.includes(postClean))) {
      return post;
    }
  }

  return posts[0];
}

function formatTorrentItem(item, magnetData, seedData, media = null) {
  const rawQuality = item.quality || '1080p';
  let qualityBadge = '1080p';
  let qualityKey = '1080p';
  if (/4k|2160p|uhd/i.test(rawQuality)) { qualityBadge = '4K'; qualityKey = '4k'; }
  else if (/1080p|fhd|full hd/i.test(rawQuality)) { qualityBadge = '1080p'; qualityKey = '1080p'; }
  else if (/720p|hd/i.test(rawQuality)) { qualityBadge = '720p'; qualityKey = '720p'; }
  else { qualityBadge = 'SD'; qualityKey = '480p'; }

  const size = item.size ? item.size.trim() : null;
  const seeders = (seedData && typeof seedData.seeders === 'number') ? seedData.seeders : 0;
  const seedLabel = seeders > 0 ? `👤 ${seeders} semillas` : `👤 DHT Swarm`;
  const displayTitle = media?.title ? `${media.title} (${media.year || ''})` : 'TACIT Torrent';

  const tLine1 = `🧲 ${qualityBadge.toUpperCase()} · SDR`;
  const tLine2 = `🇲🇽 ES`;
  const tLine3 = `⚡ ${media?.title || 'Video'}`;
  const tLines = [tLine1, tLine2, tLine3];
  if (size) tLines.push(`📦 ${size}`);

  return {
    provider: 'hackstore_torrent',
    isDirect: false,
    qualityKey,
    seeders,
    name: 'TACIT 🧲',
    title: tLines.join('\n'),
    infoHash: magnetData.infoHash,
    sources: magnetData.trackers,
    behaviorHints: {
      bingeGroup: `tacit-torrent-${qualityKey}`
    }
  };
}

async function resolveDirectPlayer(player, media = null) {
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
      const gRes = await axios.get(url, { headers: HEADERS, timeout: 5000 });
      const m3u8Match = gRes.data.match(/file:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (m3u8Match) {
        resolved = {
          url: m3u8Match[1],
          quality: '720p',
          headers: { 'Referer': 'https://goodstream.one/' }
        };
      }
    } catch (_) {}
  }

  if (!resolved || !resolved.url) return null;

  const rawQuality = player.quality || resolved.quality || '1080p';
  let qualityBadge = '1080p';
  let qualityKey = '1080p';
  if (/4k|2160p|uhd/i.test(rawQuality)) { qualityBadge = '4K'; qualityKey = '4k'; }
  else if (/1080p|full hd|fhd/i.test(rawQuality)) { qualityBadge = '1080p'; qualityKey = '1080p'; }
  else if (/720p|hd/i.test(rawQuality)) { qualityBadge = '720p'; qualityKey = '720p'; }
  else { qualityBadge = 'SD'; qualityKey = '480p'; }

  const line1 = `🎬 ${qualityBadge.toUpperCase()} · SDR`;
  const line2 = `🇲🇽 ES`;
  const line3 = `⚡ ${media?.title || 'Video'}`;

  return {
    provider: 'hackstore_direct',
    server: serverName,
    serverTier: 1,
    isDirect: true,
    qualityKey,
    seeders: 999,
    name: 'TACIT · WEB',
    title: `${line1}\n${line2}\n${line3}`,
    url: resolved.url,
    subtitles: (resolved.subtitles || []).map(s => ({
      id: s.lang,
      url: s.url,
      lang: s.lang === 'spa' ? 'Spanish' : 'English'
    })),
    behaviorHints: {
      notWebReady: false,
      proxyHeaders: {
        request: resolved.headers || {}
      }
    }
  };
}

async function getHackstoreStreams(media, season = null, episode = null, config = {}) {
  const allowedProviders = config.providers || ['hackstore_torrent', 'hackstore_direct'];
  const wantTorrents = allowedProviders.includes('hackstore_torrent');
  const wantDirect = allowedProviders.includes('hackstore_direct');

  if (!wantTorrents && !wantDirect) return [];

  const isSeries = Boolean(season && episode);
  let posts = [];

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
      (e) => parseInt(e.season_number) === parseInt(season) && parseInt(e.episode_number) === parseInt(episode)
    );
    if (!matchedEp || !matchedEp._id) return [];
    targetId = matchedEp._id;
  }

  const promises = [];

  // 1. Torrents
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
            return formatTorrentItem(dl, magnetData, seedData, media);
          })
        );
        return items.filter(Boolean);
      }).catch(() => [])
    );
  }

  // 2. Direct Web Players
  if (wantDirect) {
    promises.push(
      getPlayers(targetId).then(async (players) => {
        const directItems = await Promise.all(players.map((p) => resolveDirectPlayer(p, media)));
        return directItems.filter(Boolean);
      }).catch(() => [])
    );
  }

  const results = await Promise.all(promises);
  return results.flat();
}

module.exports = {
  getHackstoreStreams
};
