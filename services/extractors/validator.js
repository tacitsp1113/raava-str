const axios = require('axios');

/**
 * Fast stream link alive validator
 * Discards streams ONLY if they are explicitly 404 Not Found or 410 Gone.
 * Allows streams if the CDN merely blocked HEAD method or had a slight datacenter timeout.
 */
async function isStreamAlive(url, headers = {}, timeoutMs = 1500) {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('http')) return false;

  try {
    const res = await axios.head(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers
      },
      timeout: timeoutMs,
      maxRedirects: 3,
      validateStatus: (status) => (status >= 200 && status < 400)
    });
    return true;
  } catch (err) {
    if (err.response && (err.response.status === 404 || err.response.status === 410)) {
      return false;
    }
    // CDNs often block HEAD or have slow initial ping from datacenters, allow stream to client
    return true;
  }
}

module.exports = {
  isStreamAlive
};
