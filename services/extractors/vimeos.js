const axios = require('axios');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Unpacks Dean Edwards JavaScript packed code: eval(function(p,a,c,k,e,d)...)
 */
function unpackJs(packedCode) {
  if (!packedCode || typeof packedCode !== 'string') return '';
  const match = packedCode.match(/}\s*\(\s*['"](.*)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"](.*)['"]\.split\('\|'\)/s);
  if (!match) return packedCode;

  let [, p, a, c, k] = match;
  a = parseInt(a, 10);
  c = parseInt(c, 10);
  const words = k.split('|');

  const toBase = (n, radix) => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let res = '';
    while (n > 0) {
      res = chars[n % radix] + res;
      n = Math.floor(n / radix);
    }
    return res || '0';
  };

  while (c--) {
    const sym = toBase(c, a);
    const rep = words[c] || sym;
    const regex = new RegExp(`\\b${sym}\\b`, 'g');
    p = p.replace(regex, rep);
  }

  return p;
}

/**
 * Resolves a Vimeos (vimeos.net) URL to direct m3u8 stream and subtitles
 */
async function resolveVimeos(url, referer = 'https://vimeos.net/') {
  try {
    let embedUrl = url;
    if (!embedUrl.includes('/embed-') && embedUrl.includes('vimeos.net/')) {
      const id = embedUrl.substring(embedUrl.lastIndexOf('/') + 1);
      embedUrl = `https://vimeos.net/embed-${id}`;
    }

    const res = await axios.get(embedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': referer
      },
      timeout: 6000
    });

    const html = res.data;
    if (!html) return null;

    // Look for packed script
    const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\.split\('\|'\)\)\)/);
    const unpacked = packedMatch ? unpackJs(packedMatch[0]) : html;

    // Extract m3u8
    const m3u8Match = unpacked.match(/sources:\s*\[\s*\{\s*file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                      unpacked.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i);
    if (!m3u8Match) return null;

    const streamUrl = m3u8Match[1];

    // Extract subtitles if present
    const subs = [];
    const subMatches = unpacked.matchAll(/"(https?:\/\/[^"]+\.vtt)"/gi);
    for (const sm of subMatches) {
      const subUrl = sm[1];
      const lang = subUrl.substring(subUrl.lastIndexOf('_') + 1).replace('.vtt', '');
      subs.push({ lang, url: subUrl });
    }

    return {
      url: streamUrl,
      quality: '1080p',
      format: 'hls',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://vimeos.net/'
      },
      subtitles: subs
    };
  } catch (err) {
    return null;
  }
}

module.exports = {
  unpackJs,
  resolveVimeos
};
