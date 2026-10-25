const axios = require('axios');
const cheerio = require('cheerio');
const { cleanTitle } = require('../tmdb');
const { resolveVoe } = require('../extractors/voe');
const { resolveVimeos } = require('../extractors/vimeos');
const { resolveEmbed69 } = require('../extractors/embed69');
const { isStreamAlive } = require('../extractors/validator');

const BASE_URL = 'https://pelisplushd.bz';
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

    $('a.Posters-link, .item-pelicula, .items-peliculas article, article.post').each((_, el) => {
      const $el = $(el);
      const dataTitle = $el.attr('data-title') || '';
      let title = dataTitle
        .replace(/^VER\s+/i, '')
        .replace(/\s*\(\d{4}\)?.*$/i, '')
        .replace(/\s+Online\s+Gratis\s+HD$/i, '')
        .trim() || $el.find('h2, h3, .title').first().text().trim();

      const href = $el.attr('href') || $el.find('a').first().attr('href');
      const yearMatch = dataTitle.match(/\((\d{4})\)/) || $el.text().match(/\b(19\d\d|20\d\d)\b/);
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

function findBestMatch(results, media, isSeries = false) {
  if (!results || results.length === 0) return null;

  const targetClean = media.cleanTitle;
  const targetOriginalClean = media.cleanOriginalTitle;
  const targetYear = media.year;

  // 1. Filter candidates by content type
  const typeFiltered = isSeries
    ? results.filter(r => r.href.includes('/serie/'))
    : results.filter(r => r.href.includes('/pelicula/'));
  const candidates = typeFiltered.length > 0 ? typeFiltered : results;

  // 2. Exact clean title match
  for (const item of candidates) {
    const clean = cleanTitle(item.title);
    if (clean === targetClean || clean === targetOriginalClean) return item;
  }

  // 3. Exact year match with title match
  if (targetYear) {
    for (const item of candidates) {
      const clean = cleanTitle(item.title);
      if (item.year && Math.abs(item.year - targetYear) <= 1) {
        if (clean === targetClean || clean.includes(targetClean) || targetClean.includes(clean)) return item;
      }
    }
  }

  // 4. Substring match
  for (const item of candidates) {
    const clean = cleanTitle(item.title);
    if (clean && (clean.includes(targetClean) || targetClean.includes(clean))) return item;
  }

  return candidates[0];
}

async function getPelisplusStreams(media, season = null, episode = null, config = {}) {
  const allowed = config.providers || ['pelisplus'];
  if (!allowed.includes('pelisplus')) return [];

  const isSeries = Boolean(season && episode);

  let searchResults = await searchPelisplus(media.title);
  if (searchResults.length === 0 && media.originalTitle && media.originalTitle !== media.title) {
    searchResults = await searchPelisplus(media.originalTitle);
  }

  const matched = findBestMatch(searchResults, media, isSeries);
  if (!matched || !matched.href) return [];

  let targetUrl = matched.href;

  if (isSeries) {
    try {
      const showRes = await axios.get(matched.href, { headers: { 'User-Agent': USER_AGENT }, timeout: 6000 });
      const $ = cheerio.load(showRes.data);
      let epHref = null;

      $('a[href*="/temporada/"][href*="/capitulo/"], .seasons-episodes a, .episode-item').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const match = href.match(/\/temporada\/(\d+)\/capitulo\/(\d+)/i) || $(el).text().match(/(\d+)x(\d+)/);
        if (match && parseInt(match[1], 10) === parseInt(season, 10) && parseInt(match[2], 10) === parseInt(episode, 10)) {
          epHref = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        }
      });

      if (epHref) targetUrl = epHref;
    } catch (_) {}
  }

  try {
    const pageRes = await axios.get(targetUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 6000 });
    const html = pageRes.data;
    if (typeof html !== 'string') return [];

    const rawOptions = [];

    // Extract video[i] matches
    const videoMatches = [...html.matchAll(/video\[\d+\]\s*=\s*['"]([^'"]+)['"]/g)];
    for (const m of videoMatches) {
      const url = m[1];
      if (url && !rawOptions.includes(url)) rawOptions.push(url);
    }

    // Extract iframes
    const $ = cheerio.load(html);
    $('iframe[src], [data-video], [data-player]').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-video') || $(el).attr('data-player');
      if (src && !src.includes('google') && !src.includes('youtube') && !rawOptions.includes(src)) {
        rawOptions.push(src);
      }
    });

    const streamTargets = [];
    for (const opt of rawOptions.slice(0, 4)) {
      if (opt.includes('embed69.org')) {
        const decrypted = await resolveEmbed69(opt);
        for (const item of decrypted) {
          if (item.audio === 'Latino') {
            streamTargets.push(item.url);
          }
        }
      } else {
        streamTargets.push(opt);
      }
    }

    const promises = streamTargets.slice(0, 3).map(async (optUrl) => {
      let resolved = null;
      let server = 'Directo';

      if (optUrl.includes('voe.sx') || optUrl.includes('repacklab.com') || optUrl.includes('fraudulentwelfare.com') || optUrl.includes('cloudwindow-route') || optUrl.includes('voe-network')) {
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

      const epLabel = isSeries ? ` · T${season} E${episode}` : '';
      const line1 = `${media.title || 'Video'} (${media.year || ''})${epLabel}`;
      const line2 = `${quality} | WEB-DL | Latino 🇲🇽`;
      const line3 = `⚡ Stream Directo · Servidor ${server}`;

      return {
        provider: 'pelisplus',
        isDirect: true,
        qualityKey,
        server,
        seeders: 999,
        name: 'TACIT',
        title: `${line1}\n${line2}\n${line3}`,
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
  searchPelisplus,
  getPelisplusStreams
};
