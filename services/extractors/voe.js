const axios = require('axios');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Mathematical decoder for VOE encoded stream payload
 */
function voeDecode(encoded, patternsRaw) {
  try {
    const junkPatterns = patternsRaw
      .replace(/^\[|\]$/g, '')
      .split("','")
      .map(n => n.replace(/^'+|'+$/g, ''))
      .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    // Step 1: Character shift (modified Caesar/ROT13)
    let shifted = '';
    for (const char of encoded) {
      let u = char.charCodeAt(0);
      if (u > 64 && u < 91) {
        u = (u - 52) % 26 + 65;
      } else if (u > 96 && u < 123) {
        u = (u - 84) % 26 + 97;
      }
      shifted += String.fromCharCode(u);
    }

    // Step 2: Remove junk strings
    for (const p of junkPatterns) {
      shifted = shifted.replace(new RegExp(p, 'g'), '_');
    }
    const cleaned = shifted.split('_').join('');

    // Step 3: Base64 decode 1
    const binaryStr = Buffer.from(cleaned, 'base64').toString('binary');
    if (!binaryStr) return null;

    // Step 4: Byte offset shift (-3)
    let shiftedBytes = '';
    for (let i = 0; i < binaryStr.length; i++) {
      shiftedBytes += String.fromCharCode((binaryStr.charCodeAt(i) - 3 + 256) % 256);
    }

    // Step 5: Reverse string and Base64 decode 2
    const reversed = shiftedBytes.split('').reverse().join('');
    const jsonStr = Buffer.from(reversed, 'base64').toString('utf8');

    return jsonStr ? JSON.parse(jsonStr) : null;
  } catch (err) {
    return null;
  }
}

const { addLog } = require('../logger');

/**
 * Resolves a VOE (voe.sx or mirrors) embed URL to direct m3u8 or mp4
 */
async function resolveVoe(url) {
  try {
    addLog('info', 'VOE', `Iniciando resolución VOE: ${url}`);
    const res = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': url,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 6000,
      maxRedirects: 5
    });

    let html = res.data;
    if (typeof html !== 'string') {
      addLog('warn', 'VOE', `Respuesta no es HTML para ${url}`);
      return null;
    }

    let currentUrl = url;

    // Check permanentToken redirect if present
    if (/permanentToken/i.test(html)) {
      const redirectMatch = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
      if (redirectMatch) {
        const nextUrl = redirectMatch[1].startsWith('http')
          ? redirectMatch[1]
          : new URL(redirectMatch[1], currentUrl).href;
        currentUrl = nextUrl;
        const nextRes = await axios.get(nextUrl, {
          headers: { 'User-Agent': USER_AGENT, 'Referer': url },
          timeout: 6000
        });
        if (typeof nextRes.data === 'string') html = nextRes.data;
      }
    }

    // Pattern 1: Encoded array + loader script (Mathematical VOE decoder)
    const arrayMatch = html.match(/json">\s*\[\s*['"]([^'"]+)['"]\s*\]\s*<\/script>\s*<script[^>]*src=['"]([^'"]+)['"]/i);
    if (arrayMatch) {
      const encodedData = arrayMatch[1];
      const loaderUrl = arrayMatch[2].startsWith('http') ? arrayMatch[2] : new URL(arrayMatch[2], currentUrl).href;

      const loaderRes = await axios.get(loaderUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Referer': currentUrl },
        timeout: 5000
      });

      const loaderCode = typeof loaderRes.data === 'string' ? loaderRes.data : '';
      const patternsMatch = loaderCode.match(/(\[(?:'[^']{1,10}'[\s,]*){4,12}\])/i) ||
                            loaderCode.match(/(\[(?:"[^"]{1,10}"[,\s]*){4,12}\])/i);

      if (patternsMatch) {
        const decodedJson = voeDecode(encodedData, patternsMatch[1]);
        if (decodedJson && (decodedJson.source || decodedJson.direct_access_url)) {
          const directUrl = decodedJson.source || decodedJson.direct_access_url;
          addLog('success', 'VOE', `Decodificado con éxito: ${directUrl.slice(0, 60)}...`);
          return {
            url: directUrl,
            quality: '1080p',
            format: directUrl.includes('.m3u8') ? 'hls' : 'mp4',
            headers: {
              'User-Agent': USER_AGENT,
              'Referer': url
            }
          };
        }
      }
    }

    // Pattern 2: Direct mp4 / hls in html
    const directMatch = html.match(/['"](?:mp4|hls)['"]\s*:\s*['"]([^'"]+)['"]/i) ||
                        html.match(/file:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i);
    if (directMatch) {
      const directUrl = directMatch[1];
      addLog('success', 'VOE', `Enlace directo encontrado en HTML: ${directUrl.slice(0, 60)}...`);
      return {
        url: directUrl,
        quality: '1080p',
        format: directUrl.includes('.m3u8') ? 'hls' : 'mp4',
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': url
        }
      };
    }

    addLog('warn', 'VOE', `No se encontró patrón de video en HTML de ${url}`);
    return null;
  } catch (err) {
    addLog('error', 'VOE', `Fallo al resolver ${url}: ${err.message} (status: ${err.response?.status || 'N/A'})`);
    return null;
  }
}

module.exports = {
  voeDecode,
  resolveVoe
};
