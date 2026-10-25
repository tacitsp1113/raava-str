const axios = require('axios');
const crypto = require('crypto');

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function solvePow(challenge, difficulty) {
  for (let n = 0; n < 2000000; n++) {
    const hash = sha256Hex(challenge + n);
    let ok = true;
    for (let i = 0; i < difficulty && ok; i++) {
      if (hash[i] !== '0') {
        ok = false;
        break;
      }
    }
    if (ok) return n;
  }
  return -1;
}

function decryptAES(cipherB64, keyHashHex) {
  try {
    const raw = Buffer.from(cipherB64, 'base64');
    if (raw.length <= 16) return null;
    const iv = raw.subarray(0, 16);
    const ciphertext = raw.subarray(16);
    const key = Buffer.from(keyHashHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
}

/**
 * Resolves embed69.org embed page into an array of { url, server, audio }
 */
async function resolveEmbed69(embedUrl) {
  try {
    const res = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://sololatino.net/'
      },
      timeout: 6000
    });

    const html = res.data;
    if (typeof html !== 'string') return [];

    const matchData = html.match(/let dataLink\s*=\s*(\[[\s\S]*?\]);/);
    if (!matchData) return [];

    let dataLink = [];
    try {
      dataLink = JSON.parse(matchData[1]);
    } catch (_) {
      return [];
    }

    const challengeMatch = html.match(/POW_CHALLENGE\s*=\s*['"]([^'"]+)['"]/);
    const saltMatch = html.match(/POW_SALT\s*=\s*['"]([^'"]+)['"]/);
    const diffMatch = html.match(/POW_DIFFICULTY\s*=\s*(\d+)/);

    let keyHex = null;
    if (challengeMatch && saltMatch && diffMatch) {
      const challenge = challengeMatch[1];
      const salt = saltMatch[1];
      const difficulty = parseInt(diffMatch[1], 10);
      const nonce = solvePow(challenge, difficulty);
      if (nonce >= 0) {
        keyHex = sha256Hex(challenge + nonce + salt);
      }
    }

    const results = [];
    for (const group of dataLink) {
      const langCode = (group.video_language || 'LAT').toUpperCase();
      const audioTag = langCode === 'LAT' ? 'Latino' : langCode === 'SUB' ? 'Subtitulado' : 'Castellano';

      for (const embed of group.sortedEmbeds || []) {
        if (!embed.link || embed.servername === 'download') continue;
        let realUrl = embed.link;
        if (keyHex) {
          const dec = decryptAES(embed.link, keyHex);
          if (dec) realUrl = dec;
        }

        if (/^https?:\/\//i.test(realUrl)) {
          results.push({
            url: realUrl,
            server: embed.servername || 'Directo',
            audio: audioTag
          });
        }
      }
    }

    return results;
  } catch (err) {
    return [];
  }
}

module.exports = {
  resolveEmbed69
};
