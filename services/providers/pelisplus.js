const axios = require('axios');
const cheerio = require('cheerio');
const { cleanTitle } = require('../tmdb');
const { resolveVoe } = require('../extractors/voe');
const { resolveVimeos } = require('../extractors/vimeos');
const { isStreamAlive } = require('../extractors/validator');

const BASE_URL = 'https://pelisplus.lat';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function searchPelisplus(query) {
  if (!query) return [];
  try {
    const res = await axios.get(`${BASE_URL}/search?s=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': `${BASE_URL}/` },
      timeout: 6000
    });
    const $ = cheerio.load(res.data);
    const results = [];

    $('.item-pelicula, .items-peliculas article, article.post').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h2, h3, .title').first().text().trim();
      const href = $el.find('a').first().attr('href');
      const yearText = $el.find('.year, .meta span, span').text();
      const yearMatch = yearText.match(/\b(19\d\d|20\d\d)\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

      if (title && href) {
        results.push({
          title,
          href: href.startsWith('http') ? href : `${BASE_URL}${href}`,
          year
        });
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

  for (const item of results) {
    const clean = cleanTitle(item.title);
    if (clean === targetClean || clean === targetOriginalClean) return item;
  }

  if (targetYear) {
    for (const item of results) {
      const clean = cleanTitle(item.title);
      if (item.year && Math.abs(item.year - targetYear) <= 1) {
        if (clean.includes(targetClean) || targetClean.includes(clean)) return item;
      }
    }
  }

  for (const item of results) {
    const clean = cleanTitle(item.title);
    if (clean && (clean.includes(targetClean) || targetClean.includes(clean))) return item;
  }

  return results[0];
}

async function getPelisplusStreams(media, season = null, episode = null, config = {}) {
  const allowed = config.providers || ['pelisplus'];
  if (!allowed.includes('pelisplus')) return [];

  const isSeries = Boolean(season && episode);

  let searchResults = await searchPelisplus(media.title);
  if (searchResults.length === 0 && media.originalTitle && media.originalTitle !== media.title) {
    searchResults = await searchPelisplus(media.originalTitle);
  }

  const matched = findBestMatch(searchResults, media);
  if (!matched || !matched.href) return [];

  let targetUrl = matched.href;

  if (isSeries) {
    try {
      const showRes = await axios.get(matched.href, { headers: { 'User-Agent': USER_AGENT }, timeout: 6000 });
      const $ = cheerio.load(showRes.data);
      let epHref = null;

      $('.seasons-episodes a, .episode-item, .item-episode').each((_, el) => {
        const text = $(el).text();
        const href = $(el).attr('href');
        const match = text.match(/(\d+)x(\d+)/) || text.match(/T(\d+)\s*E(\d+)/i);
        if (match && parseInt(match[1], 10) === parseInt(season, 10) && parseInt(match[2], 10) === parseInt(episode, 10)) {
          if (href) epHref = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        }
      });

      if (epHref) targetUrl = epHref;
    } catch (_) {}
  }

  try {
    const pageRes = await axios.get(targetUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 6000 });
    const $ = cheerio.load(pageRes.data);
    const options = [];

    $('iframe[src], .player-container iframe, [data-video], [data-player]').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-video') || $(el).attr('data-player');
      if (src && !src.includes('google') && !src.includes('youtube') && !options.includes(src)) {
        options.push(src);
      }
    });

    const promises = options.slice(0, 3).map(async (optUrl) => {
      let resolved = null;
      let server = 'Directo';

      if (optUrl.includes('voe.sx') || optUrl.includes('cloudwindow-route') || optUrl.includes('voe-network')) {
        server = 'VOE';
        resolved = await resolveVoe(optUrl);
      } else if (optUrl.includes('vimeos.net') || optUrl.includes('vimeos.zip')) {
        server = 'Vimeos';
        resolved = await resolveVimeos(optUrl);
      }

      if (!resolved || !resolved.url) return null;
      const alive = await isStreamAlive(resolved.url, resolved.headers || {}, 1500);
      if (!alive) return null;

      const quality = resolved.quality || '1080p';
      const qualityKey = quality.toLowerCase().includes('4k') ? '4k' : quality.toLowerCase().includes('720') ? '720p' : '1080p';

      return {
        provider: 'pelisplus',
        isDirect: true,
        qualityKey,
        seeders: 999,
        name: `TACIT\n${quality}`,
        title: `PelisPlus · ${server}\nEspañol Latino · Stream Directo`,
        url: resolved.url,
        behaviorHints: {
          notWebReady: false,
          proxyHeaders: {
            request: resolved.headers || {}
          }
        }
      };
    });

    const streams = (await Promise.all(promises)).filter(Boolean);
    return streams;
  } catch (err) {
    return [];
  }
}

module.exports = {
  getPelisplusStreams
};
