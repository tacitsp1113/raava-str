const axios = require('axios');
const { cleanTitle } = require('../tmdb');
const { resolveVimeos } = require('../extractors/vimeos');
const { resolveVoe } = require('../extractors/voe');
const { resolveVidhide, resolveStreamwish } = require('../extractors/vidhide');
const { isStreamAlive, isIpLockedServer } = require('../extractors/validator');

const BASE_URL = 'https://lamovie.org';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function searchLaMovie(query) {
  if (!query) return [];
  try {
    const res = await axios.get(`${BASE_URL}/wp-api/v1/search?q=${encodeURIComponent(query)}&postType=any&postsPerPage=26`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': `${BASE_URL}/`
      },
      timeout: 5000
    });
    return Array.isArray(res.data?.data?.posts) ? res.data.data.posts : [];
  } catch (_) {
    return [];
  }
}

function findBestMatch(posts, media, isSeries = false) {
  if (!posts || posts.length === 0) return null;
  const targetClean = media.cleanTitle || cleanTitle(media.title || '');
  const targetOriginalClean = media.cleanOriginalTitle || cleanTitle(media.originalTitle || '');
  const targetYear = media.year;

  const validTypes = isSeries ? ['tvshows', 'animes'] : ['movies'];
  const candidates = posts.filter(p => validTypes.includes(p.type));
  const pool = candidates.length > 0 ? candidates : posts;

  // 1. Título exacto limpio
  for (const post of pool) {
    const cTitle = cleanTitle(post.title || '');
    const cOrig = cleanTitle(post.original_title || '');
    if (cTitle === targetClean || cOrig === targetOriginalClean || cTitle === targetOriginalClean) {
      return post;
    }
  }

  // 2. Coincidencia por año e inclusión
  if (targetYear) {
    for (const post of pool) {
      const year = post.release_date ? parseInt(post.release_date.slice(0, 4), 10) : null;
      if (year && Math.abs(year - targetYear) <= 1) {
        const cTitle = cleanTitle(post.title || '');
        if (cTitle.includes(targetClean) || targetClean.includes(cTitle)) {
          return post;
        }
      }
    }
  }

  return pool[0] || null;
}

async function getLaMovieStreams(media, season = null, episode = null, config = {}) {
  const isSeries = Boolean(season && episode);
  const maxStreams = config.maxWebStreamsPerProvider || 2;

  let posts = await searchLaMovie(media.title);
  if (posts.length === 0 && media.originalTitle && media.originalTitle !== media.title) {
    posts = await searchLaMovie(media.originalTitle);
  }
  if (posts.length === 0 && media.cleanTitle) {
    posts = await searchLaMovie(media.cleanTitle);
  }

  const post = findBestMatch(posts, media, isSeries);
  if (!post || !post._id) return [];

  let targetPostId = post._id;

  if (isSeries) {
    try {
      const epRes = await axios.get(`${BASE_URL}/wp-api/v1/single/episodes/list?_id=${post._id}&season=${season}&page=1&postsPerPage=150`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json', 'Referer': `${BASE_URL}/` },
        timeout: 4000
      });
      const episodes = epRes.data?.data?.posts;
      if (Array.isArray(episodes)) {
        const targetEp = episodes.find(e => Number(e.episode_number) === Number(episode) && Number(e.season_number || season) === Number(season));
        if (targetEp && targetEp._id) {
          targetPostId = targetEp._id;
        } else {
          return [];
        }
      } else {
        return [];
      }
    } catch (_) {
      return [];
    }
  }

  try {
    const playerRes = await axios.get(`${BASE_URL}/wp-api/v1/player?postId=${targetPostId}&demo=0`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json', 'Referer': `${BASE_URL}/` },
      timeout: 4000
    });
    const embeds = Array.isArray(playerRes.data?.data?.embeds) ? playerRes.data.data.embeds : [];
    if (embeds.length === 0) return [];

    // Priorizar audio Latino
    const sortedEmbeds = embeds.sort((a, b) => {
      const aLat = (a.lang || '').toLowerCase().includes('latino') ? -1 : 1;
      const bLat = (b.lang || '').toLowerCase().includes('latino') ? -1 : 1;
      return aLat - bLat;
    });

    const streams = [];

    for (const embed of sortedEmbeds.slice(0, 5)) {
      if (!embed.url || typeof embed.url !== 'string' || isIpLockedServer(embed.url)) continue;
      const rawUrl = embed.url;

      let resolved = null;
      let serverName = 'Directo';

      try {
        if (rawUrl.includes('vimeos.net') || rawUrl.includes('vimeos.zip')) {
          serverName = 'Vimeos';
          resolved = await resolveVimeos(rawUrl);
        } else if (rawUrl.includes('voe.sx') || rawUrl.includes('repacklab.com') || rawUrl.includes('fraudulentwelfare.com')) {
          serverName = 'VOE';
          resolved = await resolveVoe(rawUrl);
        } else if (rawUrl.includes('filelions')) {
          serverName = 'FileLions';
          resolved = await resolveVidhide(rawUrl);
        } else if (rawUrl.includes('streamwish') || rawUrl.includes('vibuxer') || rawUrl.includes('swdyu')) {
          serverName = 'StreamWish';
          resolved = await resolveStreamwish(rawUrl);
        }

        if (resolved && resolved.url) {
          const alive = await isStreamAlive(resolved.url, resolved.headers || {}, 1500);
          if (alive) {
            const isLatino = (embed.lang || '').toLowerCase().includes('latino');
            const audioBadge = isLatino ? '🇲🇽 ES (Latino)' : '🌐 Multi';
            const quality = resolved.quality || '1080p';
            const qualityKey = quality.toLowerCase().includes('4k') ? '4k' : quality.toLowerCase().includes('720') ? '720p' : '1080p';

            const line1 = `⭐ ${quality.toUpperCase()} · SDR`;
            const line2 = audioBadge;
            const line3 = isSeries ? `⚡ T${season} · E${episode}` : `⚡ ${media.title}`;

            streams.push({
              name: 'TACIT STR · WEB',
              title: `${line1}\n${line2}\n${line3}`,
              url: resolved.url,
              behaviorHints: {
                notWebReady: false
              },
              subtitles: resolved.subtitles && resolved.subtitles.length > 0 ? resolved.subtitles : undefined,
              qualityKey,
              isDirect: true,
              seeders: 999,
              provider: 'lamovie'
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
  getLaMovieStreams
};
