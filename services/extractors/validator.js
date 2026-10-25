const axios = require('axios');

/**
 * Fast HEAD validation to check if a stream link is alive
 * Rejects 404, 403, 410, timeouts and DNS failures
 */
async function isStreamAlive(url, headers = {}, timeoutMs = 1800) {
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
    // If HEAD fails or is not allowed (405), try a fast GET with Range 0-0
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Range': 'bytes=0-100',
          ...headers
        },
        timeout: timeoutMs,
        maxRedirects: 3,
        validateStatus: (status) => (status >= 200 && status < 400)
      });
      return true;
    } catch (_) {
      return false;
    }
  }
}

module.exports = {
  isStreamAlive
};
