const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

const TIMEOUT_MS = 4000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function checkCloud() {
  const start = Date.now();
  const dbPath = path.join(__dirname, '..', 'data', 'catalog.sqlite');
  if (!fs.existsSync(dbPath)) {
    return { name: 'Biblioteca Nube (SQLite)', ok: false, ms: Date.now() - start, error: 'Archivo no encontrado' };
  }
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db.prepare('SELECT COUNT(*) as total FROM movies').get();
    db.close();
    return { name: 'Biblioteca Nube (SQLite)', ok: true, ms: Date.now() - start, info: `${row.total} títulos` };
  } catch (e) {
    return { name: 'Biblioteca Nube (SQLite)', ok: false, ms: Date.now() - start, error: e.message };
  }
}

async function pingUrl(name, url, isJson = false) {
  const start = Date.now();
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: isJson ? 'application/json' : '*/*' },
      httpsAgent: agent,
      timeout: TIMEOUT_MS
    });
    const ms = Date.now() - start;
    const ok = res.status >= 200 && res.status < 400;
    return { name, ok, ms, status: res.status };
  } catch (e) {
    return { name, ok: false, ms: Date.now() - start, error: e.message };
  }
}

async function checkAllProviders() {
  const checks = [
    checkCloud(),
    pingUrl('PelisPlus 4K', 'https://tioplus.app/api/search/avatar'),
    pingUrl('LaMovie', 'https://lamovie.org/wp-api/v1/search?q=avatar&postType=any&postsPerPage=5', true),
    pingUrl('CineCalidad', 'https://www.cinecalidad.am/?s=avatar'),
    pingUrl('Cuevana', 'https://cuevana3.sc/wp-json/cuevana/v1/search?q=avatar', true),
    pingUrl('PelisPlus HD', 'https://pelisplushd.bz/search?s=avatar'),
    pingUrl('TioAnime', 'https://tioanime.com/directorio?q=naruto'),
    pingUrl('LACartoons', 'https://www.lacartoons.com/?Titulo=spider'),
    pingUrl('Hackstore', 'https://hackstore.rs/?s=avatar')
  ];

  const results = await Promise.all(checks);
  return results;
}

function renderStatusHtml(results, baseUrl = '') {
  const total = results.length;
  const online = results.filter(r => r.ok).length;
  const isAllGood = online === total;

  const rows = results.map(r => {
    const badge = r.ok
      ? '<span style="color: #34d399; background: rgba(16,185,129,0.12); padding: 3px 8px; border-radius: 6px; font-weight: 600; font-size: 0.78rem;">🟢 OPERATIVO</span>'
      : '<span style="color: #f87171; background: rgba(239,68,68,0.12); padding: 3px 8px; border-radius: 6px; font-weight: 600; font-size: 0.78rem;">🔴 INACCESIBLE</span>';

    const detail = r.ok
      ? `<span style="font-family: monospace; color: #7dd3fc; font-size: 0.8rem;">${r.ms} ms</span>`
      : `<span style="color: #94a3b8; font-size: 0.76rem;">${r.error || 'Fallo de respuesta'}</span>`;

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding: 12px 14px; font-weight: 600; color: #f1f5f9; font-size: 0.9rem;">${r.name}</td>
        <td style="padding: 12px 14px; text-align: center;">${badge}</td>
        <td style="padding: 12px 14px; text-align: right;">${detail}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TACIT STR - Estado de Proveedores</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body { background: #0b0f17; color: #f1f5f9; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px 16px; }
    .card { max-width: 650px; width: 100%; background: rgba(16, 22, 34, 0.9); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; padding: 30px 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .header { text-align: center; margin-bottom: 24px; }
    .title { font-size: 1.6rem; font-weight: 700; margin-bottom: 6px; }
    .summary { font-size: 0.88rem; color: #94a3b8; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .btn-refresh { display: block; text-align: center; background: #0ea5e9; color: #fff; text-decoration: none; padding: 12px; border-radius: 12px; font-weight: 600; font-size: 0.9rem; transition: background 0.15s; }
    .btn-refresh:hover { background: #0284c7; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">🩺 Diagnóstico de Proveedores</h1>
      <p class="summary">${online} de ${total} servicios respondiendo activamente</p>
    </div>
    <table class="table">
      <thead>
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #94a3b8; font-size: 0.74rem; text-transform: uppercase;">
          <th style="text-align: left; padding: 8px 14px;">Proveedor</th>
          <th style="text-align: center; padding: 8px 14px;">Estado</th>
          <th style="text-align: right; padding: 8px 14px;">Respuesta</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <a href="/status" class="btn-refresh">🔄 Volver a Probar Ahora</a>
  </div>
</body>
</html>`;
}

async function handleStatusPage(req, res) {
  const results = await checkAllProviders();
  if (req.query.json !== undefined || req.headers.accept?.includes('application/json')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json({ timestamp: new Date().toISOString(), results });
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderStatusHtml(results));
}

module.exports = {
  checkAllProviders,
  handleStatusPage
};
