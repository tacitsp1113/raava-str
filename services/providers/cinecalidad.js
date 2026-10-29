const axios = require('axios');
const cheerio = require('cheerio');
const { cleanTitle } = require('../tmdb');
const { resolveVimeos } = require('../extractors/vimeos');
const { resolveVoe } = require('../extractors/voe');
const { resolveVidhide, resolveStreamwish } = require('../extractors/vidhide');
const { isStreamAlive, isIpLockedServer } = require('../extractors/validator');

const BASES = ['https://www.cinecalidad.am', 'https://cinecalidad.ro'];
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// In-memory cache con TTL de 15 minutos
const ccCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCached(key) {
  const item = ccCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    ccCache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data) {
  if (ccCache.size > 500) {
    const oldest = ccCache.keys().next().value;
    ccCache.delete(oldest);
  }
  ccCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

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

async function searchCinecalidad(base, query) {
  if (!query) return [];
  const cacheKey = `cc_search_${query.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await axios.get(`${base}/?s=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': `${base}/`
      },
      timeout: 5000
    });

    const $ = cheerio.load(res.data);
    const results = [];

    $('article.item, .item.movies').each((_, el) => {
      const $el = $(el);
      // Evitar enlaces de publicidad base64 y buscar el enlace real
      const linkEl = $el.find('a[href*="/ver-pelicula/"], a[href*="/pelicula/"], a[href*="/serie/"], a').filter((_, a) => {
        const href = $(a).attr('href') || '';
        return href.startsWith('http') && !href.includes('analytics') && !href.includes('#aHR0c');
      }).first();

      const href = linkEl.attr('href');
      const title = $el.find('div.in_title, h2, h3').first().text().trim() || linkEl.text().trim();
      const yearText = $el.find('.metadata span, .year, span').text();
      const yearMatch = yearText.match(/\b(19\d\d|20\d\d)\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

      if (title && href) {
        results.push({ title, href, year });
      }
    });

    if (results.length > 0) setCached(cacheKey, results);
    return results;
  } catch (err) {
    return [];
  }
}

function findBestMatch(results, media) {
  if (!results || results.length === 0) return null;

  const targetClean = media.cleanTitle || cleanTitle(media.title || '');
  const targetOriginalClean = media.cleanOriginalTitle || cleanTitle(media.originalTitle || '');
  const targetYear = media.year;

  // 1. Coincidencia exacta de título o título original
  for (const item of results) {
    const clean = cleanTitle(item.title);
    if (clean === targetClean || clean === targetOriginalClean) {
      return item;
    }
  }

  // 2. Coincidencia de año e inclusión
  if (targetYear) {
    for (const item of results) {
      const clean = cleanTitle(item.title);
      if (item.year && Math.abs(item.year - targetYear) <= 1) {
        if (clean.includes(targetClean) || targetClean.includes(clean)) {
          return item;
        }
      }
    }
  }

  // 3. Fallback inclusión de título
  for (const item of results) {
    const clean = cleanTitle(item.title);
    if (clean && (clean.includes(targetClean) || targetClean.includes(clean))) {
      return item;
    }
  }

  return results[0];
}

// Clasificación de prioridad de servidores: VOE > StreamWish > Vimeos > Otros
function getCinecalidadTier(url) {
  if (url.includes('voe.sx') || url.includes('cloudwindow-route') || url.includes('voe-network') || url.includes('repacklab.com')) return 1;
  if (url.includes('streamwish') || url.includes('swdyu') || url.includes('vibuxer')) return 2;
  if (url.includes('vimeos.net') || url.includes('vimeos.zip')) return 3;
  return 4;
}

async function resolveOption(optionUrl, media = null, season = null, episode = null) {
  if (!optionUrl || typeof optionUrl !== 'string' || isIpLockedServer(optionUrl)) return null;
  const fixedUrl = fixHostsLinks(optionUrl.trim());
  if (isIpLockedServer(fixedUrl)) return null;
  if (fixedUrl.includes('youtube.com') || fixedUrl.includes('youtu.be')) return null;

  let resolved = null;
  let serverName = 'Directo';

  if (fixedUrl.includes('voe.sx') || fixedUrl.includes('cloudwindow-route') || fixedUrl.includes('voe-network') || fixedUrl.includes('repacklab.com')) {
    serverName = 'VOE';
    resolved = await resolveVoe(fixedUrl);
  } else if (fixedUrl.includes('vimeos.net') || fixedUrl.includes('vimeos.zip')) {
    serverName = 'Vimeos';
    resolved = await resolveVimeos(fixedUrl);
  } else if (fixedUrl.includes('streamwish') || fixedUrl.includes('vibuxer') || fixedUrl.includes('swdyu')) {
    serverName = 'StreamWish';
    resolved = await resolveStreamwish(fixedUrl);
  } else if (fixedUrl.includes('filelions')) {
    serverName = 'FileLions';
    resolved = await resolveVidhide(fixedUrl);
  }

  if (!resolved || !resolved.url) return null;

  const alive = await isStreamAlive(resolved.url, resolved.headers || {}, 1800);
  if (!alive) return null;

  const quality = resolved.quality || '1080p';
  const qualityKey = quality.toLowerCase().includes('4k') ? '4k' : quality.toLowerCase().includes('720') ? '720p' : '1080p';

  const qBadge = quality.toUpperCase();
  const line1 = `🎬 ${qBadge} · SDR`;
  const line2 = `🇲🇽 ES`;
  const line3 = (season && episode) ? `⚡ T${season} · E${episode}` : `⚡ ${media?.title || 'Video'}`;

  return {
    provider: 'cinecalidad',
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

async function getCinecalidadStreams(media, season = null, episode = null, config = {}) {
  const maxStreams = config.maxWebStreamsPerProvider || 2;
  const isSeries = Boolean(season && episode);

  for (const base of BASES) {
    try {
      let searchResults = await searchCinecalidad(base, media.title);
      if (searchResults.length === 0 && media.originalTitle && media.originalTitle !== media.title) {
        searchResults = await searchCinecalidad(base, media.originalTitle);
      }

      const matched = findBestMatch(searchResults, media);
      if (!matched || !matched.href) continue;

      let targetUrl = matched.href;

      // Navegación para episodios de series
      if (isSeries) {
        try {
          const showRes = await axios.get(matched.href, { headers: { 'User-Agent': USER_AGENT }, timeout: 5000 });
          const $ = cheerio.load(showRes.data);
          let foundEpUrl = null;

          $('div.se-c div.se-a ul.episodios li, .episodios li').each((_, el) => {
            const epText = $(el).text();
            const epLink = $(el).find('a').attr('href');
            const sMatch = epText.match(/(\d+)\s*[-xX]\s*(\d+)/) || epText.match(/T(\d+)\s*E(\d+)/i);
            if (sMatch && parseInt(sMatch[1], 10) === parseInt(season, 10) && parseInt(sMatch[2], 10) === parseInt(episode, 10)) {
              if (epLink) foundEpUrl = epLink;
            }
          });

          if (foundEpUrl) targetUrl = foundEpUrl;
        } catch (_) {}
      }

      const pageRes = await axios.get(targetUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 5000 });
      const $ = cheerio.load(pageRes.data);
      const options = [];

      $('.linklist ul li[data-option], ul#playeroptionsul li[data-option], li.dooplay_player_option[data-option]').each((_, el) => {
        const opt = $(el).attr('data-option');
        if (opt && !options.includes(opt) && !opt.includes('youtube')) {
          options.push(opt);
        }
      });

      if (options.length === 0) continue;

      // Priorizar VOE (8.5+ Mbps) por encima de Vimeos
      options.sort((a, b) => getCinecalidadTier(a) - getCinecalidadTier(b));

      const streamPromises = options.slice(0, 4).map(opt => resolveOption(opt, media, season, episode));
      const streams = (await Promise.all(streamPromises)).filter(Boolean);

      if (streams.length > 0) {
        return streams.slice(0, maxStreams);
      }
    } catch (err) {
      continue;
    }
  }

  return [];
}

module.exports = {
  getCinecalidadStreams
};
