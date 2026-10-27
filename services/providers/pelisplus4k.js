const axios = require('axios');
const cheerio = require('cheerio');
const { cleanTitle } = require('../tmdb');
const { resolveVidhide, resolveStreamwish, fixHostsLinks } = require('../extractors/vidhide');
const { resolveVoe } = require('../extractors/voe');
const { resolveVimeos } = require('../extractors/vimeos');
const { isStreamAlive } = require('../extractors/validator');

const BASE_URL = 'https://tioplus.app';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function audioDe(text) {
  if (!text) return '';
  const s = text.toLowerCase();
  if (/latino|\blat\b|latam|mexic|\bmx\b|419/.test(s)) return 'Latino';
  if (/castellano|espana|\bcast\b|\besp\b/.test(s)) return 'Castellano';
  if (/subtitulad|\bvose\b|\bsub\b|\bsubs\b|ingles|english/.test(s)) return 'Subtitulado';
  return '';
}

function audioPagina(html) {
  if (/audio Latino|Español Latino/i.test(html)) return 'Latino';
  if (/audio Castellano|Español España/i.test(html)) return 'Castellano';
  if (/subtitulad|subtulada/i.test(html)) return 'Subtitulado';
  return 'Latino';
}

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
    const pageAudio = audioPagina(html);
    const serverList = [];

    $('li[data-server]').each((_, el) => {
      const token = $(el).attr('data-server');
      const label = $(el).text().trim().replace(/\s+/g, ' ');
      const detected = audioDe(label) || pageAudio;
      if (token && !serverList.some(s => s.token === token)) {
        serverList.push({ token, label, audio: detected });
      }
    });

    if (serverList.length === 0) return [];

    // Priorizar servidores más rápidos y estables (Earnvids/VidHide, StreamWish, Voe)
    serverList.sort((a, b) => {
      const score = (item) => {
        const l = item.label.toLowerCase();
        if (/earnvids|vidhide/i.test(l)) return 3;
        if (/streamwish/i.test(l)) return 2;
        if (/voe/i.test(l)) return 1;
        return 0;
      };
      return score(b) - score(a);
    });

    const streams = [];

    for (const item of serverList.slice(0, 6)) {
      try {
        // Pausa ligera anti-bloqueo ("saturando la red")
        await new Promise(r => setTimeout(r, 350));

        const b64 = Buffer.from(item.token).toString('base64');
        let playerRes = await axios.get(`${BASE_URL}/player/${b64}`, {
          headers: { 'User-Agent': USER_AGENT, 'Referer': targetUrl },
          timeout: 4000
        });

        let playerHtml = typeof playerRes.data === 'string' ? playerRes.data : '';
        if (/saturando la red/i.test(playerHtml)) {
          await new Promise(r => setTimeout(r, 1200));
          playerRes = await axios.get(`${BASE_URL}/player/${b64}`, {
            headers: { 'User-Agent': USER_AGENT, 'Referer': targetUrl },
            timeout: 4000
          });
          playerHtml = typeof playerRes.data === 'string' ? playerRes.data : '';
        }

        const matchHref = playerHtml.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (!matchHref) continue;

        let hostUrl = matchHref[1];
        if (!hostUrl.startsWith('http')) continue;

        // Normalizar espejos a dominios oficiales estables
        hostUrl = fixHostsLinks(hostUrl);

        let resolved = null;
        if (hostUrl.includes('vidhide') || hostUrl.includes('filelions') || hostUrl.includes('minochinos') || hostUrl.includes('dhtpre')) {
          resolved = await resolveVidhide(hostUrl);
        } else if (hostUrl.includes('streamwish') || hostUrl.includes('vibuxer') || hostUrl.includes('swdyu') || hostUrl.includes('hglink')) {
          resolved = await resolveStreamwish(hostUrl);
        } else if (hostUrl.includes('voe.sx') || hostUrl.includes('repacklab') || hostUrl.includes('cloudwindow-route') || hostUrl.includes('fraudulentwelfare')) {
          resolved = await resolveVoe(hostUrl);
        } else if (hostUrl.includes('vimeos.net') || hostUrl.includes('vimeos.zip')) {
          resolved = await resolveVimeos(hostUrl);
        }

        if (resolved && resolved.url) {
          const alive = await isStreamAlive(resolved.url, resolved.headers || {}, 1500);
          if (alive) {
            const audioBadge = item.audio === 'Latino'
              ? '🇲🇽 ES (Latino)'
              : item.audio === 'Castellano'
              ? '🇪🇸 ES (Castellano)'
              : '🇺🇸 EN (Subtitulado)';

            const quality = resolved.quality || '1080p';
            const qualityKey = quality.toLowerCase().includes('4k') ? '4k' : quality.toLowerCase().includes('720') ? '720p' : '1080p';
            const line1 = `⭐ ${quality.toUpperCase()} · SDR`;
            const line2 = audioBadge;
            const line3 = isSeries ? `⚡ T${season} · E${episode}` : `⚡ ${media.title}`;

            let hostOrigin = '';
            try { hostOrigin = new URL(hostUrl).origin; } catch (_) {}

            streams.push({
              name: 'TACIT STR · WEB',
              title: `${line1}\n${line2}\n${line3}`,
              url: resolved.url,
              behaviorHints: {
                notWebReady: false,
                proxyHeaders: {
                  request: resolved.headers || {
                    'User-Agent': USER_AGENT,
                    'Referer': `${hostOrigin}/`,
                    'Origin': hostOrigin
                  }
                }
              },
              qualityKey,
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
