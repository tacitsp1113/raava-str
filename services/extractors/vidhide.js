const axios = require('axios');
const { unpackJs } = require('./vimeos');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function resolveVidhide(url) {
  if (!url) return null;
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': url
      },
      timeout: 6000
    });

    const html = res.data;
    if (!html || typeof html !== 'string') return null;

    let streamUrl = null;
    const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\.split\('\|'\)\)\)/);
    if (packedMatch) {
      const unpacked = unpackJs(packedMatch[0]);
      const m3u8Match = unpacked.match(/https?:\/\/[^"']+\.m3u8[^"']*/i);
      if (m3u8Match) {
        streamUrl = m3u8Match[0];
      }
    }

    if (!streamUrl) {
      const directM3u8 = html.match(/https?:\/\/[^"']+\.m3u8[^"']*/i);
      if (directM3u8) streamUrl = directM3u8[0];
    }

    if (!streamUrl) return null;

    return {
      url: streamUrl,
      quality: '1080p',
      format: 'hls',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': url
      }
    };
  } catch (err) {
    return null;
  }
}

module.exports = {
  resolveVidhide
};
