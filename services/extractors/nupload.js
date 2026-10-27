const axios = require('axios');

function atobSeguro(str) {
  try {
    return Buffer.from(str, 'base64').toString('binary');
  } catch (_) {
    return '';
  }
}

async function resolveNupload(url) {
  try {
    const origin = new URL(url).origin;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `${origin}/`
      },
      timeout: 4500
    });
    const html = res.data;
    if (typeof html !== 'string') return null;

    const arreglo = (html.match(/(\w+)\.forEach\s*\([^}]*?atob/) || html.match(/(\w+)\.forEach\s*\(/) || [])[1];
    const sesz = (html.match(/sesz\s*=\s*["']([^"']+)/) || [])[1];
    if (!arreglo || !sesz) return null;

    const desfase = parseInt((html.match(new RegExp(`${arreglo}\\.forEach[^-]+-\\s*(\\d+)`)) || html.match(/parseInt\(.*?replace\(.*?(\d+)/) || [])[1], 10);
    const definicion = html.match(new RegExp(`var\\s+${arreglo}\\s*=\\s*\\[([^\\]]+)\\]`));
    if (!desfase || !definicion) return null;

    const base = (definicion[1].match(/["'][^"']+["']/g) || []).map((x) => {
      const n = parseInt(atobSeguro(x.slice(1, -1)).replace(/\D/g, ''), 10);
      return isNaN(n) ? '' : String.fromCharCode(n - desfase);
    }).join('');

    if (!/^https?:\/\//.test(base)) return null;
    const headers = {
      Origin: origin,
      Referer: `${origin}/`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    const destino = `${base}?s=${sesz}`;

    const r = await axios.get(destino, {
      headers,
      maxRedirects: 5,
      timeout: 4500
    });
    const finalUrl = r.request?.res?.responseUrl || destino;
    return {
      url: finalUrl,
      headers
    };
  } catch (_) {
    return null;
  }
}

module.exports = {
  resolveNupload
};
