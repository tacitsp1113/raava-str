const axios = require('axios');
const cheerio = require('cheerio');
const { cleanTitle } = require('../tmdb');
const { resolveVidhide } = require('../extractors/vidhide');
const { isStreamAlive } = require('../extractors/validator');

const BASE_URL = 'https://www.lacartoons.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function searchLACartoons(query) {
  if (!query) return [];
  try {
    const res = await axios.get(`${BASE_URL}/?Titulo=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 5000
    });
    const $ = cheerio.load(res.data);
    const results = [];

    $('.categorias .conjuntos-series a').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const rawTitle = $el.find('h2, .title').text().trim() || $el.text().trim();
      const title = rawTitle.split('\n')[0].trim();
      if (title && href) {
        results.push({
          title,
          href: href.startsWith('http') ? href : `${BASE_URL}${href}`
        });
      }
    });

    return results;
  } catch (_) {
    return [];
  }
}

function findBestMatch(results, media) {
  if (!results || results.length === 0) return null;
  const targetClean = media.cleanTitle || cleanTitle(media.title || '');
  const targetOriginalClean = media.cleanOriginalTitle || cleanTitle(media.originalTitle || '');

  for (const item of results) {
    const c = cleanTitle(item.title);
    if (c === targetClean || c === targetOriginalClean) return item;
  }
  for (const item of results) {
    const c = cleanTitle(item.title);
    if (c.includes(targetClean) || targetClean.includes(c)) return item;
  }
  return results[0] || null;
}

async function resolveOkRu(url) {
  try {
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 4000 });
    const match = res.data.match(/data-options="([^"]+)"/);
    if (!match) return null;
    const decoded = match[1].replace(/&quot;/g, '"');
    const parsed = JSON.parse(decoded);
    const metadata = typeof parsed.flashvars?.metadata === 'string' ? JSON.parse(parsed.flashvars.metadata) : parsed.flashvars?.metadata;
    if (metadata?.hlsManifestUrl) {
      return { url: metadata.hlsManifestUrl, quality: '720p', format: 'hls' };
    }
    if (Array.isArray(metadata?.videos) && metadata.videos.length > 0) {
      const best = metadata.videos[metadata.videos.length - 1];
      return { url: best.url, quality: '720p', format: 'mp4' };
    }
    return null;
  } catch (_) {
    return null;
  }
}

async function getLACartoonsStreams(media, season = null, episode = null, config = {}) {
  // LACartoons es exclusivo de series animadas/caricaturas
  if (!season || !episode) return [];
  const maxStreams = config.maxWebStreamsPerProvider || 2;

  let results = await searchLACartoons(media.title);
  if (results.length === 0 && media.originalTitle && media.originalTitle !== media.title) {
    results = await searchLACartoons(media.originalTitle);
  }
  if (results.length === 0 && media.cleanTitle) {
    results = await searchLACartoons(media.cleanTitle);
  }

  const match = findBestMatch(results, media);
  if (!match || !match.href) return [];

  try {
    const seriesRes = await axios.get(match.href, { headers: { 'User-Agent': USER_AGENT }, timeout: 5000 });
    const $ = cheerio.load(seriesRes.data);

    let epUrl = null;
    $('ul.listas-de-episodion li a, ul.listas-de-episodios li a, .episodios li a').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const text = $a.text().trim().toLowerCase();

      // Checar temporada en href ?t=1
      const tMatch = href.match(/[?&]t=(\d+)/i);
      const epSeason = tMatch ? parseInt(tMatch[1], 10) : 1;

      // Checar capitulo en texto: "Capitulo 1"
      const capMatch = text.match(/cap[ií]tulo\s*(\d+)/i);
      const epNum = capMatch ? parseInt(capMatch[1], 10) : null;

      if (epSeason === Number(season) && epNum === Number(episode)) {
        epUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        return false;
      }
    });

    if (!epUrl) return [];

    const epRes = await axios.get(epUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 4000 });
    const $ep = cheerio.load(epRes.data);

    const iframes = [];
    $ep('iframe').each((_, el) => {
      const src = $ep(el).attr('src');
      if (src && !iframes.includes(src)) iframes.push(src);
    });

    const streams = [];

    for (const src of iframes.slice(0, 3)) {
      let resolved = null;
      if (src.includes('ok.ru')) {
        resolved = await resolveOkRu(src);
      } else if (src.includes('vidhide') || src.includes('filelions')) {
        resolved = await resolveVidhide(src);
      }

      if (resolved && resolved.url) {
        const alive = await isStreamAlive(resolved.url, resolved.headers || {}, 1500);
        if (alive) {
          const line1 = '⭐ 720P · SDR';
          const line2 = '🇲🇽 ES (Latino Clásico)';
          const line3 = `⚡ T${season} · E${episode}`;

          streams.push({
            name: 'TACIT STR · WEB',
            title: `${line1}\n${line2}\n${line3}`,
            url: resolved.url,
            behaviorHints: {
              notWebReady: false,
              bingeGroup: `tacit-lacartoons-${media.imdb_id || media.title}-s${season}`
            },
            qualityKey: '720p',
            isDirect: true,
            provider: 'lacartoons'
          });

          if (streams.length >= maxStreams) break;
        }
      }
    }

    return streams;
  } catch (_) {
    return [];
  }
}

module.exports = {
  getLACartoonsStreams
};
