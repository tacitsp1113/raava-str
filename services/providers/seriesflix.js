const axios = require('axios');
const cheerio = require('cheerio');
const { cleanTitle } = require('../tmdb');
const { resolveVoe } = require('../extractors/voe');
const { resolveVimeos } = require('../extractors/vimeos');
const { resolveStreamwish } = require('../extractors/vidhide');
const { isStreamAlive } = require('../extractors/validator');

const BASES = ['https://seriesflixhd.pw', 'https://seriesflixhd.best', 'https://seriesflixhd.ink'];
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function audioDe(text) {
  if (!text) return '';
  const s = text.toLowerCase();
  if (/latino|\blat\b|latam|mexic|\bmx\b|419/.test(s)) return 'Latino';
  if (/castellano|espana|\bcast\b|\besp\b/.test(s)) return 'Castellano';
  if (/subtitulad|\bvose\b|\bsub\b|\bsubs\b|ingles|english/.test(s)) return 'Subtitulado';
  return '';
}

async function fetchHtml(url) {
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 5000,
      maxRedirects: 3
    });
    return typeof res.data === 'string' ? res.data : '';
  } catch (_) {
    return '';
  }
}

async function searchSeries(base, query) {
  const html = await fetchHtml(`${base}/?s=${encodeURIComponent(query)}`);
  if (!html) return [];
  const $ = cheerio.load(html);
  const results = [];

  $('article').each((_, el) => {
    const linkEl = $(el).find('h2.Title a, a').first();
    const href = linkEl.attr('href');
    const title = $(el).find('h2.Title, .title').first().text().trim() || linkEl.text().trim();
    if (href && title && (href.includes('/serie/') || href.includes('/series/'))) {
      results.push({
        title,
        href: href.startsWith('http') ? href : `${base}${href}`
      });
    }
  });

  return results;
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

async function findEpisodeUrl(base, seriesUrl, season, episode) {
  const html = await fetchHtml(seriesUrl);
  if (!html) return null;
  const $ = cheerio.load(html);

  // 1. Buscar link de la temporada exacta
  let seasonUrl = null;
  $('a[href*="/temporada/"]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text();
    const sMatch = text.match(/Temporada\s*(\d+)/i) || (href && href.match(/-(\d+)\/?$/));
    if (sMatch && parseInt(sMatch[1], 10) === parseInt(season, 10)) {
      seasonUrl = href.startsWith('http') ? href : `${base}${href}`;
      return false;
    }
  });

  const seasonHtml = seasonUrl ? await fetchHtml(seasonUrl) : html;
  if (!seasonHtml) return null;
  const $s = cheerio.load(seasonHtml);

  // 2. Buscar link del episodio exacto (ej. -2x8 o clase Num)
  let episodeUrl = null;
  const targetEpStr = `${season}x${episode}`;

  $s('a[href*="/episodio/"]').each((_, el) => {
    const href = $s(el).attr('href');
    if (href && (href.includes(`-${targetEpStr}/`) || href.includes(`-${targetEpStr}`) || href.includes(`_${targetEpStr}`))) {
      episodeUrl = href.startsWith('http') ? href : `${base}${href}`;
      return false;
    }
  });

  // Fallback buscando por texto de fila
  if (!episodeUrl) {
    $s('tr').each((_, el) => {
      const numText = $s(el).find('.Num, .num').text().trim();
      const a = $s(el).find('a[href*="/episodio/"]');
      if (parseInt(numText, 10) === parseInt(episode, 10) && a.attr('href')) {
        const h = a.attr('href');
        episodeUrl = h.startsWith('http') ? h : `${base}${h}`;
        return false;
      }
    });
  }

  return episodeUrl;
}

function extractButtons(html) {
  const buttons = [];
  const $ = cheerio.load(html);

  $('div[data-url], [data-url]').each((_, el) => {
    const rawDataUrl = $(el).attr('data-url');
    if (!rawDataUrl) return;

    let targetUrl = '';
    try {
      targetUrl = Buffer.from(rawDataUrl, 'base64').toString('utf8');
      if (targetUrl.includes('url=')) {
        targetUrl = decodeURIComponent(targetUrl.split('url=')[1].split('&')[0]);
      }
    } catch (_) {
      targetUrl = '';
    }

    if (!targetUrl || !targetUrl.startsWith('http')) return;

    const label = $(el).text().trim().replace(/\s+/g, ' ');
    const detectedAudio = audioDe(label) || 'Latino';

    buttons.push({
      url: targetUrl,
      label,
      audio: detectedAudio
    });
  });

  return buttons;
}

async function getSeriesFlixStreams(media, season = null, episode = null, config = {}) {
  if (!season || !episode) return [];
  const maxStreams = config.maxWebStreamsPerProvider || 2;

  for (const base of BASES) {
    try {
      let results = await searchSeries(base, media.title);
      if (results.length === 0 && media.originalTitle && media.originalTitle !== media.title) {
        results = await searchSeries(base, media.originalTitle);
      }

      const match = findBestMatch(results, media);
      if (!match || !match.href) continue;

      const epUrl = await findEpisodeUrl(base, match.href, season, episode);
      if (!epUrl) continue;

      const epHtml = await fetchHtml(epUrl);
      if (!epHtml) continue;

      const buttons = extractButtons(epHtml);
      if (buttons.length === 0) continue;

      const streams = [];

      for (const btn of buttons.slice(0, 6)) {
        let resolved = null;
        let server = 'Directo';

        if (btn.url.includes('voe.sx') || btn.url.includes('repacklab.com') || btn.url.includes('cloudwindow-route')) {
          server = 'VOE';
          resolved = await resolveVoe(btn.url);
        } else if (btn.url.includes('vimeos.net') || btn.url.includes('vimeos.zip')) {
          server = 'Vimeos';
          resolved = await resolveVimeos(btn.url);
        } else if (btn.url.includes('streamwish') || btn.url.includes('vibuxer') || btn.url.includes('swdyu')) {
          server = 'StreamWish';
          resolved = await resolveStreamwish(btn.url);
        }

        if (resolved && resolved.url) {
          const alive = await isStreamAlive(resolved.url, resolved.headers || {}, 1500);
          if (alive) {
            const audioBadge = btn.audio === 'Latino'
              ? '🇲🇽 ES (Latino)'
              : btn.audio === 'Castellano'
              ? '🇪🇸 ES (Castellano)'
              : '🇺🇸 EN (Subtitulado)';

            const quality = resolved.quality || '1080p';
            const qualityKey = quality.toLowerCase().includes('4k') ? '4k' : quality.toLowerCase().includes('720') ? '720p' : '1080p';
            const line1 = `⭐ ${quality.toUpperCase()} · SDR`;
            const line2 = audioBadge;
            const line3 = `⚡ T${season} · E${episode}`;

            streams.push({
              name: 'TACIT STR · WEB',
              title: `${line1}\n${line2}\n${line3}`,
              url: resolved.url,
              behaviorHints: {
                notWebReady: false,
                proxyHeaders: {
                  request: resolved.headers || {}
                }
              },
              qualityKey,
              isDirect: true,
              seeders: 999,
              provider: 'seriesflix'
            });

            if (streams.length >= maxStreams) break;
          }
        }
      }

      if (streams.length > 0) return streams;
    } catch (_) {}
  }

  return [];
}

module.exports = {
  getSeriesFlixStreams
};
