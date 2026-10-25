const axios = require('axios');
const cheerio = require('cheerio');
const { cleanTitle } = require('../tmdb');
const { resolveVimeos } = require('../extractors/vimeos');
const { resolveVoe } = require('../extractors/voe');
const { isStreamAlive } = require('../extractors/validator');

const BASE_URL = 'https://www.cinecalidad.am';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function fixHostsLinks(url) {
  if (!url) return '';
  return url
    .replaceFirst ? url : url
    .replace('https://hglink.to', 'https://streamwish.to')
    .replace('https://swdyu.com', 'https://streamwish.to')
    .replace('https://cybervynx.com', 'https://streamwish.to')
    .replace('https://dumbalag.com', 'https://streamwish.to')
    .replace('https://mivalyo.com', 'https://vidhidepro.com')
    .replace('https://dinisglows.com', 'https://vidhidepro.com')
    .replace('https://dhtpre.com', 'https://vidhidepro.com')
    .replace('https://filemoon.link', 'https://filemoon.sx');
}

async function searchCinecalidad(query) {
  if (!query) return [];
  try {
    const res = await axios.get(`${BASE_URL}/?s=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': `${BASE_URL}/`
      },
      timeout: 6000
    });

    const $ = cheerio.load(res.data);
    const results = [];

    $('article.item, .item.movies').each((_, el) => {
      const $el = $(el);
      const title = $el.find('div.in_title, h2, h3').first().text().trim();
      const href = $el.find('a').first().attr('href');
      const yearText = $el.find('.metadata span, .year, span').text();
      const yearMatch = yearText.match(/\b(19\d\d|20\d\d)\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

      if (title && href) {
        results.push({ title, href, year });
      }
    });

    return results;
  } catch (err) {
    return [];
  }
}

function findBestMatch(results, media) {
  if (!results || results.length === 0) return null;

  const targetClean = media.cleanTitle;
  const targetOriginalClean = media.cleanOriginalTitle;
  const targetYear = media.year;

  // 1. Exact title or original title match
  for (const item of results) {
    const clean = cleanTitle(item.title);
    if (clean === targetClean || clean === targetOriginalClean) {
      return item;
    }
  }

  // 2. Year match + inclusion
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

  // 3. Fallback title contains
  for (const item of results) {
    const clean = cleanTitle(item.title);
    if (clean && (clean.includes(targetClean) || targetClean.includes(clean))) {
      return item;
    }
  }

  return results[0];
}

async function resolveOption(optionUrl, media = null) {
  if (!optionUrl || typeof optionUrl !== 'string') return null;
  const fixedUrl = fixHostsLinks(optionUrl.trim());

  if (fixedUrl.includes('youtube.com') || fixedUrl.includes('youtu.be')) return null;

  let resolved = null;
  let serverName = 'Directo';

  if (fixedUrl.includes('vimeos.net') || fixedUrl.includes('vimeos.zip')) {
    serverName = 'Vimeos';
    resolved = await resolveVimeos(fixedUrl);
  } else if (fixedUrl.includes('voe.sx') || fixedUrl.includes('cloudwindow-route') || fixedUrl.includes('voe-network')) {
    serverName = 'VOE';
    resolved = await resolveVoe(fixedUrl);
  }

  if (!resolved || !resolved.url) return null;

  const alive = await isStreamAlive(resolved.url, resolved.headers || {}, 1500);
  if (!alive) return null;

  const quality = resolved.quality || '1080p';
  const qualityKey = quality.toLowerCase().includes('4k') ? '4k' : quality.toLowerCase().includes('720') ? '720p' : '1080p';
  const displayTitle = media?.title ? `${media.title} (${media.year || ''})` : 'TACIT Stream';

  return {
    provider: 'cinecalidad',
    server: serverName,
    serverTier: 1,
    isDirect: true,
    qualityKey,
    seeders: 999,
    name: `▶ TACIT ${quality}`,
    title: `${displayTitle}\n${quality} | WEB-DL | Latino 🇲🇽\n⚡ Servidor Rápido · 1.8 GB`,
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

async function getCinecalidadStreams(media, season = null, episode = null, config = {}) {
  const allowedProviders = config.providers || ['cinecalidad'];
  if (!allowedProviders.includes('cinecalidad')) return [];

  const isSeries = Boolean(season && episode);

  let searchResults = await searchCinecalidad(media.title);
  if (searchResults.length === 0 && media.originalTitle && media.originalTitle !== media.title) {
    searchResults = await searchCinecalidad(media.originalTitle);
  }

  const matched = findBestMatch(searchResults, media);
  if (!matched || !matched.href) return [];

  let targetUrl = matched.href;

  // Handle series episode navigation if applicable
  if (isSeries) {
    try {
      const showRes = await axios.get(matched.href, { headers: { 'User-Agent': USER_AGENT }, timeout: 6000 });
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

  try {
    const pageRes = await axios.get(targetUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 6000 });
    const $ = cheerio.load(pageRes.data);
    const options = [];

    $('.linklist ul li[data-option], ul#playeroptionsul li[data-option], li.dooplay_player_option[data-option]').each((_, el) => {
      const opt = $(el).attr('data-option');
      if (opt && !options.includes(opt)) {
        options.push(opt);
      }
    });

    const streamPromises = options.slice(0, 4).map(opt => resolveOption(opt, media));
    const streams = (await Promise.all(streamPromises)).filter(Boolean);

    return streams;
  } catch (err) {
    return [];
  }
}

module.exports = {
  getCinecalidadStreams
};
