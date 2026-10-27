const axios = require('axios');
const { cleanTitle } = require('../tmdb');
const { resolveVoe } = require('../extractors/voe');
const { resolveVimeos } = require('../extractors/vimeos');
const { resolveVidhide, resolveStreamwish } = require('../extractors/vidhide');
const { isStreamAlive, isIpLockedServer } = require('../extractors/validator');

const DOMAINS = ['https://cuevana3.sc', 'https://cuevana.ch'];
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function fixHostsLinks(url) {
  if (!url) return '';
  return url
    .replace('https://hglink.to', 'https://streamwish.to')
    .replace('https://swdyu.com', 'https://streamwish.to')
    .replace('https://cybervynx.com', 'https://streamwish.to')
    .replace('https://dumbalag.com', 'https://streamwish.to')
    .replace('https://mivalyo.com', 'https://vidhidepro.com')
    .replace('https://dinisglows.com', 'https://vidhidepro.com')
    .replace('https://dhtpre.com', 'https://vidhidepro.com')
    .replace('https://filemoon.link', 'https://filemoon.sx');
}

async function searchCuevana(query, baseUrl = DOMAINS[0]) {
  if (!query) return [];
  try {
    const res = await axios.get(`${baseUrl}/wp-json/cuevana/v1/search?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': `${baseUrl}/` },
      timeout: 6000
    });
    return Array.isArray(res.data?.data) ? res.data.data : [];
  } catch (err) {
    return [];
  }
}

function findBestMatch(items, media) {
  if (!items || items.length === 0) return null;

  const targetClean = media.cleanTitle || cleanTitle(media.title || '');
  const targetOriginalClean = media.cleanOriginalTitle || cleanTitle(media.originalTitle || '');
  const targetYear = media.year;

  // 1. Exact clean title match
  for (const item of items) {
    const clean = cleanTitle(item.title);
    if (clean === targetClean || clean === targetOriginalClean) {
      return item;
    }
  }

  // 2. Year match + inclusion
  if (targetYear) {
    for (const item of items) {
      const clean = cleanTitle(item.title);
      const itemYear = item.info?.year ? parseInt(item.info.year, 10) : null;
      if (itemYear && Math.abs(itemYear - targetYear) <= 1) {
        if (clean.includes(targetClean) || targetClean.includes(clean)) {
          return item;
        }
      }
    }
  }

  // 3. Fallback title contains
  for (const item of items) {
    const clean = cleanTitle(item.title);
    if (clean && (clean.includes(targetClean) || targetClean.includes(clean))) {
      return item;
    }
  }

  return items[0];
}

async function resolveEmbedUrl(embedUrl, lang, baseUrl, media = null, season = null, episode = null) {
  if (!embedUrl || isIpLockedServer(embedUrl)) return null;
  let targetUrl = embedUrl;

  try {
    const pageRes = await axios.get(embedUrl, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': `${baseUrl}/` },
      timeout: 5000,
      maxRedirects: 3
    });

    const pageHtml = typeof pageRes.data === 'string' ? pageRes.data : '';
    const redirectMatch = pageHtml.match(/var\s+url\s*=\s*['"]([^'"]+)['"]/i) ||
                          pageHtml.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
    if (redirectMatch) {
      targetUrl = redirectMatch[1];
    }
  } catch (_) {}

  if (isIpLockedServer(targetUrl)) return null;
  const fixed = fixHostsLinks(targetUrl);
  if (isIpLockedServer(fixed)) return null;

  let resolved = null;
  let server = 'Directo';

  if (fixed.includes('voe.sx') || fixed.includes('cloudwindow-route') || fixed.includes('voe-network')) {
    server = 'VOE';
    resolved = await resolveVoe(fixed);
  } else if (fixed.includes('vimeos.net') || fixed.includes('vimeos.zip')) {
    server = 'Vimeos';
    resolved = await resolveVimeos(fixed);
  } else if (fixed.includes('filelions')) {
    server = 'FileLions';
    resolved = await resolveVidhide(fixed);
  } else if (fixed.includes('streamwish') || fixed.includes('vibuxer') || fixed.includes('swdyu') || fixed.includes('hglink')) {
    server = 'StreamWish';
    resolved = await resolveStreamwish(fixed);
  }

  if (!resolved || !resolved.url) return null;

  const alive = await isStreamAlive(resolved.url, resolved.headers || {}, 1500);
  if (!alive) return null;

  const quality = resolved.quality || '1080p';
  const qualityKey = quality.toLowerCase().includes('4k') ? '4k' : quality.toLowerCase().includes('720') ? '720p' : '1080p';
  const serverTier = (server === 'Vimeos' || server === 'VOE') ? 1 : 2;

  const isSeries = Boolean(season && episode);
  const qBadge = quality.toUpperCase();
  const line1 = `🎬 ${qBadge} · SDR`;
  const line2 = `🇲🇽 ES`;
  const line3 = isSeries
    ? `⚡ T${season} · E${episode}`
    : `⚡ ${media?.title || 'Video'}`;

  return {
    provider: 'cuevana',
    server,
    serverTier,
    isDirect: true,
    qualityKey,
    seeders: 999,
    name: 'TACIT STR · WEB',
    title: `${line1}\n${line2}\n${line3}`,
    url: resolved.url,
    behaviorHints: {
      notWebReady: false
    }
  };
}

async function getCuevanaStreams(media, season = null, episode = null, config = {}) {
  const maxStreams = config.maxWebStreamsPerProvider || 2;
  const isSeries = Boolean(season && episode);
  const baseUrl = DOMAINS[0];

  let items = await searchCuevana(media.title, baseUrl);
  if (items.length === 0 && media.originalTitle && media.originalTitle !== media.title) {
    items = await searchCuevana(media.originalTitle, baseUrl);
  }
  if (items.length === 0 && media.cleanTitle) {
    items = await searchCuevana(media.cleanTitle, baseUrl);
  }

  const matched = findBestMatch(items, media);
  if (!matched || !matched.link) return [];

  const idMatch = matched.link.match(/(?:peliculas|series)-online\/(\d+)/i) || matched.link.match(/\/(\d+)/);
  if (!idMatch) return [];
  const pid = idMatch[1];

  let playerEndpoint = `${baseUrl}/wp-json/cuevana/v1/player/${pid}`;
  if (isSeries) {
    playerEndpoint = `${baseUrl}/wp-json/cuevana/v1/episode/${pid}/${season}/${episode}`;
  }

  try {
    const res = await axios.get(playerEndpoint, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': `${baseUrl}/` },
      timeout: 6000
    });

    const embeds = Array.isArray(res.data?.data?.embeds) ? res.data.data.embeds : [];
    if (embeds.length === 0) return [];

    const streamPromises = embeds.slice(0, 4).map(e => {
      const lang = /latin/i.test(e.audio || '') ? 'Latino' : (e.audio || 'Latino');
      return resolveEmbedUrl(e.url, lang, baseUrl, media, season, episode);
    });

    const streams = (await Promise.all(streamPromises)).filter(Boolean);
    return streams.slice(0, maxStreams);
  } catch (err) {
    return [];
  }
}

module.exports = {
  getCuevanaStreams
};
