const axios = require('axios');
const cheerio = require('cheerio');
const { cleanTitle } = require('../tmdb');
const { resolveVoe } = require('../extractors/voe');
const { resolveVimeos } = require('../extractors/vimeos');
const { isStreamAlive } = require('../extractors/validator');

const BASE_URL = 'https://tioanime.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function searchTioanime(query) {
  if (!query) return [];
  try {
    const res = await axios.get(`${BASE_URL}/directorio?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': `${BASE_URL}/` },
      timeout: 6000
    });
    const $ = cheerio.load(res.data);
    const results = [];

    $('.animes article, article.anime').each((_, el) => {
      const title = $(el).find('h3.title').text().trim();
      const href = $(el).find('a').attr('href');
      if (title && href) {
        results.push({
          title,
          href: href.startsWith('http') ? href : `${BASE_URL}${href}`
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

  for (const item of results) {
    const clean = cleanTitle(item.title);
    if (clean === targetClean || clean === targetOriginalClean) return item;
  }
  for (const item of results) {
    const clean = cleanTitle(item.title);
    if (clean && (clean.includes(targetClean) || targetClean.includes(clean))) return item;
  }
  return results[0];
}

async function getTioanimeStreams(media, season = null, episode = null, config = {}) {
  const allowed = config.providers || ['tioanime'];
  if (!allowed.includes('tioanime')) return [];

  // TioAnime is anime series or anime movies
  const epNum = episode ? parseInt(episode, 10) : 1;

  let results = await searchTioanime(media.title);
  if (results.length === 0 && media.originalTitle && media.originalTitle !== media.title) {
    results = await searchTioanime(media.originalTitle);
  }

  const matched = findBestMatch(results, media);
  if (!matched || !matched.href) return [];

  // In Tioanime anime urls look like: https://tioanime.com/anime/shingeki-no-kyojin
  // And episode urls look like: https://tioanime.com/ver/shingeki-no-kyojin-1
  const animeSlug = matched.href.split('/').filter(Boolean).pop();
  const episodeUrl = `${BASE_URL}/ver/${animeSlug}-${epNum}`;

  try {
    const epRes = await axios.get(episodeUrl, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': matched.href },
      timeout: 6000
    });

    const html = typeof epRes.data === 'string' ? epRes.data : '';
    const videosMatch = html.match(/var\s+videos\s*=\s*(\[[\s\S]*?\]);/);
    if (!videosMatch) return [];

    let videoList = [];
    try {
      videoList = JSON.parse(videosMatch[1]);
    } catch (_) {
      const urls = html.matchAll(/https?:\/\/[^"'\s]+/g);
      for (const u of urls) {
        if (u[0].includes('voe') || u[0].includes('vimeos')) videoList.push(['', u[0]]);
      }
    }

    const promises = videoList.slice(0, 3).map(async (v) => {
      const serverCode = Array.isArray(v) ? v[0] : '';
      const serverUrl = Array.isArray(v) ? v[1] : v;

      if (!serverUrl || typeof serverUrl !== 'string') return null;

      let resolved = null;
      let serverName = serverCode || 'AnimeDirect';

      if (serverUrl.includes('voe.sx') || serverUrl.includes('cloudwindow-route')) {
        serverName = 'VOE';
        resolved = await resolveVoe(serverUrl);
      } else if (serverUrl.includes('vimeos.net') || serverUrl.includes('vimeos.zip')) {
        serverName = 'Vimeos';
        resolved = await resolveVimeos(serverUrl);
      }

      if (!resolved || !resolved.url) return null;
      const alive = await isStreamAlive(resolved.url, resolved.headers || {}, 1500);
      if (!alive) return null;

      const line1 = `🎬 1080P · SDR`;
      const line2 = `🇯🇵 JA · 🇲🇽 ES Sub`;
      const line3 = `⚡ E${episode || 1} - ${media?.title || 'Anime'}`;

      return {
        provider: 'tioanime',
        server: serverName,
        serverTier: 1,
        isDirect: true,
        qualityKey: '1080p',
        seeders: 999,
        name: 'TACIT Anime',
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
  getTioanimeStreams
};
