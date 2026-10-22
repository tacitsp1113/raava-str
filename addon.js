const { addonBuilder } = require('stremio-addon-sdk');
const { getMediaDetails } = require('./services/tmdb');
const { getMovieStreams, getSeriesStreams } = require('./services/hackstore');

const manifest = {
  id: 'org.raava.str',
  version: '1.0.0',
  name: 'RAAVA STR',
  description: 'RAAVA STR - Media & Stream Service',
  logo: 'https://i.ibb.co/vzG7P3J/raava-logo.png',
  background: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=1920&q=80',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [],
  behaviorHints: {
    configurable: false
  }
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
  console.log(`[RAAVA Request] Type: ${type}, ID: ${id}`);

  try {
    let mediaId = id;
    let season = null;
    let episode = null;

    // Support both IMDb format (tt12345:1:2) and Nuvio/TMDB format (tmdb:12345:1:2)
    if (id.startsWith('tmdb:')) {
      const parts = id.split(':');
      mediaId = `tmdb:${parts[1]}`;
      if (parts.length >= 4) {
        season = parts[2];
        episode = parts[3];
      }
    } else if (id.includes(':')) {
      const parts = id.split(':');
      mediaId = parts[0];
      season = parts[1];
      episode = parts[2];
    }

    const effectiveType = type === 'anime' ? (season && episode ? 'series' : 'movie') : type;

    const media = await getMediaDetails(effectiveType, mediaId);
    if (!media) {
      console.log(`[RAAVA] Could not resolve media details for ID: ${id}`);
      return { streams: [] };
    }

    let streams = [];
    if (effectiveType === 'movie') {
      streams = await getMovieStreams(media);
    } else if (effectiveType === 'series' && season && episode) {
      streams = await getSeriesStreams(media, season, episode);
    }

    console.log(`[RAAVA] Returning ${streams.length} stream(s) for "${media.title}"`);
    return { streams };
  } catch (error) {
    console.error(`[RAAVA Error] Failed to handle stream for ${id}:`, error);
    return { streams: [] };
  }
});

module.exports = builder.getInterface();
