const axios = require('axios');
const { unpackJs } = require('./vimeos');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function fixHostsLinks(url) {
  if (!url) return '';
  return url
    .replace('https://hglink.to', 'https://streamwish.to')
    .replace('https://swdyu.com', 'https://streamwish.to')
    .replace('https://cybervynx.com', 'https://streamwish.to')
    .replace('https://dumbalag.com', 'https://streamwish.to')
    .replace('https://mivalyo.com', 'https://vidhidepro.com')
    .replace('https://dinisglows.com', 'https://vidhidepro.com')
    .replace('https://dhtpre.com', 'https://vidhidepro.com')
    .replace('https://filemoon.link', 'https://filemoon.sx')
    .replace('https://sblona.com', 'https://watchsb.com')
    .replace('https://lulu.st', 'https://lulustream.com')
    .replace('https://uqload.io', 'https://uqload.com')
    .replace('https://do7go.com', 'https://dood.la');
}

function normalizeEmbedUrl(url) {
  if (!url) return '';
  if (url.includes('/d/')) return url.replace('/d/', '/v/');
  if (url.includes('/download/')) return url.replace('/download/', '/v/');
  if (url.includes('/file/')) return url.replace('/file/', '/v/');
  return url;
}

function extractStreamFromText(text, baseUrl) {
  if (!text) return null;

  // 1. Check for links = { hls4: ..., hls2: ... }
  const linksMatch = text.match(/links\s*=\s*(\{[^}]+\})/);
  if (linksMatch) {
    try {
      const cleanJson = linksMatch[1].replace(/'/g, '"');
      const obj = JSON.parse(cleanJson);
      const chosen = obj.hls4 || obj.hls2 || obj.hls3 || obj.hls;
      if (chosen && typeof chosen === 'string') {
        if (chosen.startsWith('http')) return chosen;
        try {
          return new URL(chosen, baseUrl).href;
        } catch (_) {}
      }
    } catch (_) {}
  }

  // 2. Direct regex patterns (JWPlayer sources, file, m3u8)
  const patterns = [
    /["']?hls[24]["']?\s*:\s*["']([^"']+)["']/i,
    /sources\s*:\s*\[\s*\{\s*(?:src|file)\s*:\s*["']([^"']+)["']/i,
    /file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i,
    /["']file["']\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i,
    /src\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i,
    /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i,
    /https?:\/\/[^"'\s]+\.mp4[^"'\s]*/i
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const matched = m[1] || m[0];
      if (matched.startsWith('http')) return matched;
      try {
        return new URL(matched, baseUrl).href;
      } catch (_) {}
    }
  }

  return null;
}

async function resolvePacked(rawUrl, referer = null) {
  if (!rawUrl) return null;
  const fixedUrl = fixHostsLinks(normalizeEmbedUrl(rawUrl));

  let hostOrigin = '';
  try {
    hostOrigin = new URL(fixedUrl).origin;
  } catch (_) {
    return null;
  }

  const refererUrl = referer || `${hostOrigin}/`;

  try {
    const res = await axios.get(fixedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': refererUrl,
        'Origin': hostOrigin
      },
      timeout: 6000
    });

    const html = res.data;
    if (!html || typeof html !== 'string') return null;

    let streamUrl = null;

    // Check packed eval
    const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\.split\('\|'\)\)\)/);
    if (packedMatch) {
      const unpacked = unpackJs(packedMatch[0]);
      streamUrl = extractStreamFromText(unpacked, fixedUrl);
    }

    if (!streamUrl) {
      streamUrl = extractStreamFromText(html, fixedUrl);
    }

    // Follow iframe if needed (like Droydr13 and redblacker8 do)
    if (!streamUrl) {
      const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframeMatch && !iframeMatch[1].includes('google') && !iframeMatch[1].includes('youtube')) {
        let iframeUrl = iframeMatch[1];
        if (!iframeUrl.startsWith('http')) {
          try { iframeUrl = new URL(iframeUrl, fixedUrl).href; } catch (_) {}
        }
        if (iframeUrl.startsWith('http') && iframeUrl !== fixedUrl) {
          return resolvePacked(iframeUrl, fixedUrl);
        }
      }
    }

    if (!streamUrl) return null;

    return {
      url: streamUrl,
      quality: '1080p',
      format: streamUrl.includes('.m3u8') ? 'hls' : 'mp4',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': `${hostOrigin}/`,
        'Origin': hostOrigin
      }
    };
  } catch (err) {
    return null;
  }
}

async function resolveVidhide(url, referer = null) {
  return resolvePacked(url, referer);
}

async function resolveStreamwish(url, referer = null) {
  return resolvePacked(url, referer);
}

module.exports = {
  fixHostsLinks,
  normalizeEmbedUrl,
  resolvePacked,
  resolveVidhide,
  resolveStreamwish
};
