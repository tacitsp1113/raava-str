const axios = require('axios');

/**
 * Fast stream link alive validator
 * Discards streams if they return 404/410 OR if an m3u8 returns an HTML error page (DMCA, File deleted).
 */
async function isStreamAlive(url, headers = {}, timeoutMs = 2000) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;

  try {
    const isM3u8 = url.includes('.m3u8');
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        ...headers
      },
      timeout: timeoutMs,
      maxRedirects: 3,
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 400
    });

    const text = typeof res.data === 'string' ? res.data : '';

    // Descartar páginas de error HTML camufladas con código HTTP 200
    if (text.includes('<html') || text.includes('<!DOCTYPE') || text.includes('DMCA') || text.includes('File deleted') || text.includes('not found')) {
      return false;
    }

    // Un archivo m3u8 legítimo siempre debe contener la directiva #EXT
    if (isM3u8 && !text.includes('#EXT')) {
      return false;
    }

    return true;
  } catch (err) {
    if (err.response && (err.response.status === 404 || err.response.status === 410)) {
      return false;
    }
    // Si hay un timeout de datacenter o el CDN bloquea GETs directos, permitir que el cliente lo intente
    return true;
  }
}

/**
 * Lista negra de servidores cuyos tokens HLS se enlazan criptográficamente
 * a la IP que los solicitó (Datacenter de Render != IP de la TV/teléfono del usuario).
 * Bloquean o cortan el audio al reproducirse desde otra IP.
 */
const IP_LOCKED_DOMAINS = [
  'vidhide',
  'earnvids',
  'streamhide',
  'luluvdo',
  'lulustream',
  'doodstream',
  'dood.',
  'dhtpre',
  'mivalyo',
  'dinisglows',
  'minochinos'
];

function isIpLockedServer(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return IP_LOCKED_DOMAINS.some(domain => lower.includes(domain));
}

module.exports = {
  isStreamAlive,
  isIpLockedServer
};
