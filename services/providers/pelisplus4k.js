const axios = require('axios');
const cheerio = require('cheerio');
const { cleanTitle } = require('../tmdb');
const { resolveVidhide } = require('../extractors/vidhide');
const { isStreamAlive } = require('../extractors/validator');

const BASE_URL = 'https://tioplus.app';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function searchPelisplus4k(query) {
  if (!query) return [];
  try {
    const res = await axios.get(`${BASE_URL}/api/search/${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': `${BASE_URL}/` },
      timeout: 5000
    });
    if (typeof res.data !== 'string') return [];
    const $ = cheerio.load(res.data);
    const results = [];

    $('article.item, .articlesList article').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a.itemA, a').first();
      const href = linkEl.attr('href') || '';
      const title = $el.find('h2, .title').first().text().trim() || linkEl.text().trim();
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

function findBestMatch(results, media, isSeries = false) {
  if (!results || results.length === 0) return null;
  const targetClean = media.cleanTitle || cleanTitle(media.title || '');
  const targetOriginalClean = media.cleanOriginalTitle || cleanTitle(media.originalTitle || '');

  // 1. Filtrar por tipo según URL
  const filtered = isSeries
    ? results.filter(r => r.href.includes('/serie/') || r.href.includes('/animes/') || r.href.includes('/doramas/'))
    : results.filter(r => r.href.includes('/pelicula/'));

  const candidates = filtered.length > 0 ? filtered : results;

  for (const item of candidates) {
    const c = cleanTitle(item.title);
    if (c === targetClean || c === targetOriginalClean) return item;
  }
  for (const item of candidates) {
    const c = cleanTitle(item.title);
    if (c.includes(targetClean) || targetClean.includes(c)) return item;
  }
  return candidates[0] || null;
}

async function getPelisplus4kStreams(media, season = null, episode = null, config = {}) {
  const isSeries = Boolean(season && episode);
  const maxStreams = config.maxWebStreamsPerProvider || 2;

  let results = await searchPelisplus4k(media.title);
  if (results.length === 0 && media.originalTitle && media.originalTitle !== media.title) {
    results = await searchPelisplus4k(media.originalTitle);
  }
  if (results.length === 0 && media.cleanTitle) {
    results = await searchPelisplus4k(media.cleanTitle);
  }

  const match = findBestMatch(results, media, isSeries);
  if (!match || !match.href) return [];

  let targetUrl = match.href;
  if (isSeries) {
    targetUrl = `${match.href}/season/${season}/episode/${episode}`;
  }

  try {
    const pageRes = await axios.get(targetUrl, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': `${BASE_URL}/` },
      timeout: 5000
    });
    const html = pageRes.data;
    if (typeof html !== 'string') return [];

    const $ = cheerio.load(html);
    const serverTokens = [];

    $('li[data-server]').each((_, el) => {
      const s = $(el).attr('data-server');
      if (s && !serverTokens.includes(s)) serverTokens.push(s);
    });

    if (serverTokens.length === 0) return [];

    const streams = [];

    for (const token of serverTokens.slice(0, 4)) {
      try {
        const b64 = Buffer.from(token).toString('base64');
        const playerRes = await axios.get(`${BASE_URL}/player/${b64}`, {
          headers: { 'User-Agent': USER_AGENT, 'Referer': targetUrl },
          timeout: 4000
        });
        const playerHtml = typeof playerRes.data === 'string' ? playerRes.data : '';
        const matchHref = playerHtml.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (!matchHref) continue;

        let hostUrl = matchHref[1];
        if (!hostUrl.startsWith('http')) continue;

        // Estandarizar espejos conocidos de VidHide
        hostUrl = hostUrl
          .replace('https://mivalyo.com', 'https://vidhidepro.com')
          .replace('https://dinisglows.com', 'https://vidhidepro.com')
          .replace('https://dhtpre.com', 'https://vidhidepro.com');

        let resolved = null;
        if (hostUrl.includes('vidhide') || hostUrl.includes('filelions')) {
          resolved = await resolveVidhide(hostUrl);
        }

        if (resolved && resolved.url) {
          const alive = await isStreamAlive(resolved.url, resolved.headers || {}, 1500);
          if (alive) {
            const line1 = '⭐ 1080P · SDR';
            const line2 = '🇲🇽 ES (Latino)';
            const line3 = isSeries ? `⚡ T${season} · E${episode}` : `⚡ ${media.title}`;

            streams.push({
              name: 'TACIT STR · WEB',
              title: `${line1}\n${line2}\n${line3}`,
              url: resolved.url,
              behaviorHints: {
                notWebReady: false,
                proxyHeaders: {
                  request: resolved.headers || {
                    'User-Agent': USER_AGENT,
                    'Referer': hostUrl
                  }
                }
              },
              qualityKey: '1080p',
              isDirect: true,
              seeders: 999,
              provider: 'pelisplus4k'
            });

            if (streams.length >= maxStreams) break;
          }
        }
      } catch (_) {}
    }

    return streams;
  } catch (_) {
    return [];
  }
}

module.exports = {
  getPelisplus4kStreams
};
