const express = require('express');
const path = require('path');
const { getRouter } = require('stremio-addon-sdk');
const { addonInterface, manifest, resolveStreams, parseConfig, DEFAULT_CONFIG } = require('./addon');

const app = express();
const PORT = process.env.PORT || 7000;

// Serve logo
app.get('/logo.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'logo.png'));
});

// Stremio Standard SDK router for root requests (/manifest.json, /catalog, etc.)
const defaultRouter = getRouter(addonInterface);
app.use(defaultRouter);

// --- CONFIGURABLE ADDON ENDPOINTS ---

// Configured Manifest endpoint: /:configuration/manifest.json
app.get('/:configuration/manifest.json', (req, res) => {
  const config = parseConfig(req.params.configuration);

  let modeName = 'Equilibrado';
  let modeBadge = '⚡';
  let modeDesc = 'Nube + Respaldo Web';
  if (config.mode === 'cloud') {
    modeName = 'Solo Nube';
    modeBadge = '☁️';
    modeDesc = 'Biblioteca Cloud Directa';
  } else if (config.mode === 'full') {
    modeName = 'Catálogo Máximo';
    modeBadge = '🚀';
    modeDesc = 'Todos los Proveedores';
  }

  const torrentInfo = config.disableTorrents ? '🚫 Sin Torrents' : '🧲 Torrents Activos';
  const qInfo = (config.qualities || ['1080p']).map(q => q.toUpperCase()).join(' · ');
  const streamInfo = config.mode === 'cloud' 
    ? `Nube: ${config.maxCloudStreams || 10}` 
    : `Nube: ${config.maxCloudStreams || 10} | Web: ${config.maxWebStreams || 3}`;

  const customManifest = {
    ...manifest,
    name: `TACIT STR ${modeBadge} [${modeName}]`,
    description: `${modeBadge} ${modeName} (${modeDesc}) · ${torrentInfo} · [${qInfo}] · ${streamInfo}`
  };
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(customManifest);
});

// Configured Stream endpoint: /:configuration/stream/:type/:id.json
app.get('/:configuration/stream/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  const configParam = req.params.configuration;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const cleanId = id.replace('.json', '');
    const result = await resolveStreams(type, cleanId, configParam);
    res.json(result);
  } catch (err) {
    console.error('[TACIT Config Server Error]:', err);
    res.json({ streams: [] });
  }
});

// --- CLOUDSTREAM COMPATIBLE REST API ---
const csApi = require('./services/cloudstream_api');

app.get('/api/cs/home', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { type, page, limit } = req.query;
  res.json(csApi.getHome(type || 'movie', Number(page) || 1, Number(limit) || 30));
});

app.get('/api/cs/search', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { q, limit } = req.query;
  res.json(csApi.searchCatalog(q || '', Number(limit) || 40));
});

app.get('/api/cs/load', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { type, id } = req.query;
  const details = csApi.loadDetails(type || 'movie', id);
  if (!details) return res.status(404).json({ error: 'Not found' });
  res.json(details);
});

app.get('/api/cs/links', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { type, id, season, episode } = req.query;
  const streams = await csApi.getStreams(type || 'movie', id, season, episode);
  res.json({ streams });
});

// --- INTERACTIVE CONFIGURATION & INSTALLATION PAGE ---

function renderConfigPage(req) {
  const host = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const initialConfig = req.params && req.params.configuration ? parseConfig(req.params.configuration) : null;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TACIT STR - Configuración</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f17;
      --card-bg: rgba(16, 22, 34, 0.82);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent: #0ea5e9;
      --accent-hover: #0284c7;
      --accent-glow: rgba(14, 165, 233, 0.3);
      --cyan: #06b6d4;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    body {
      background: radial-gradient(circle at 50% 0%, #152238 0%, #0b0f17 50%, #06090e 100%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 44px 20px;
    }

    .container {
      max-width: 700px;
      width: 100%;
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 40px 36px;
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(14, 165, 233, 0.08);
    }

    .header {
      text-align: center;
      margin-bottom: 32px;
    }

    .logo-img {
      width: 84px;
      height: 84px;
      border-radius: 20px;
      object-fit: cover;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6), 0 0 20px rgba(14, 165, 233, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.15);
      margin-bottom: 14px;
    }

    .badge-tag {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(14, 165, 233, 0.12);
      border: 1px solid rgba(14, 165, 233, 0.35);
      color: #7dd3fc;
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
      margin-bottom: 12px;
      letter-spacing: 0.8px;
      font-family: 'JetBrains Mono', monospace;
    }

    .dot {
      width: 7px;
      height: 7px;
      background: #38bdf8;
      border-radius: 50%;
      box-shadow: 0 0 10px #38bdf8;
    }

    h1 {
      font-size: 2.4rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }

    p.subtitle {
      color: var(--text-muted);
      font-size: 0.98rem;
      line-height: 1.5;
    }

    .section-title {
      font-size: 0.88rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      margin: 26px 0 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-title span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: rgba(14, 165, 233, 0.18);
      color: #38bdf8;
      font-size: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
    }

    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    @media (max-width: 600px) {
      .options-grid { grid-template-columns: 1fr; }
      .container { padding: 28px 18px; }
      h1 { font-size: 2rem; }
    }

    .card-checkbox {
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 14px;
      padding: 14px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.15s ease;
      user-select: none;
    }

    .card-checkbox:hover {
      border-color: rgba(14, 165, 233, 0.4);
      background: rgba(14, 165, 233, 0.05);
    }

    .card-checkbox.active {
      border-color: var(--accent);
      background: rgba(14, 165, 233, 0.12);
    }

    .btn-preset {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #e2e8f0;
      padding: 9px 12px;
      border-radius: 10px;
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
      text-align: center;
    }

    .btn-preset:hover {
      background: rgba(14, 165, 233, 0.15);
      border-color: #0ea5e9;
      color: #38bdf8;
    }

    .btn-preset.active-preset {
      background: rgba(14, 165, 233, 0.25);
      border-color: #0ea5e9;
      color: #38bdf8;
    }

    .card-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .card-info .name {
      font-weight: 600;
      font-size: 0.94rem;
      color: #f8fafc;
    }

    .card-info .desc {
      font-size: 0.76rem;
      color: var(--text-muted);
    }

    .custom-check {
      width: 20px;
      height: 20px;
      border-radius: 6px;
      border: 1.5px solid rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .card-checkbox.active .custom-check {
      background: var(--accent);
      border-color: var(--accent);
    }

    .custom-check svg {
      width: 12px;
      height: 12px;
      stroke: white;
      stroke-width: 3;
      fill: none;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .card-checkbox.active .custom-check svg {
      opacity: 1;
    }

    /* Slider styling */
    .slider-container {
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 14px;
      padding: 16px 18px;
    }

    .slider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .slider-title {
      font-size: 0.92rem;
      font-weight: 600;
      color: #f8fafc;
    }

    .slider-value {
      font-size: 1.15rem;
      font-weight: 700;
      color: #38bdf8;
      font-family: 'JetBrains Mono', monospace;
    }

    input[type=range] {
      width: 100%;
      height: 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.1);
      outline: none;
      -webkit-appearance: none;
    }

    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--accent);
      cursor: pointer;
      box-shadow: 0 0 10px var(--accent);
      transition: transform 0.1s;
    }

    input[type=range]::-webkit-slider-thumb:hover {
      transform: scale(1.15);
    }

    /* Actions */
    .actions {
      margin-top: 32px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .btn-install {
      background: #0ea5e9;
      color: white;
      text-decoration: none;
      padding: 16px;
      border-radius: 14px;
      font-size: 1.05rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      box-shadow: 0 8px 24px rgba(14, 165, 233, 0.35);
      transition: all 0.2s ease;
      cursor: pointer;
      border: none;
      width: 100%;
    }

    .btn-install:hover {
      background: #0284c7;
      transform: translateY(-1px);
      box-shadow: 0 12px 28px rgba(14, 165, 233, 0.5);
    }

    .btn-copy {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      padding: 13px;
      border-radius: 12px;
      font-size: 0.92rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-copy:hover {
      background: rgba(255, 255, 255, 0.08);
      color: white;
    }

    .copied-toast {
      color: #34d399;
      font-size: 0.82rem;
      text-align: center;
      height: 16px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .copied-toast.show {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="/logo.png" alt="TACIT STR Logo" class="logo-img">
      <br>
      <div class="badge-tag">
        <span class="dot"></span> TACIT STR · LATINO
      </div>
      <h1>TACIT STR</h1>
      <p class="subtitle">Configura tus proveedores y opciones de reproducción en Español Latino para Stremio.</p>
    </div>

    <!-- SELECTOR DE MODOS (PRESETS) -->
    <div style="margin-bottom: 24px;">
      <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px;">Modo de Uso</div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
        <button type="button" class="btn-preset" id="presetCloud" data-preset="cloud">☁️ Solo Nube</button>
        <button type="button" class="btn-preset active-preset" id="presetBalanced" data-preset="balanced">⚡ Equilibrado</button>
        <button type="button" class="btn-preset" id="presetFull" data-preset="full">🚀 Catálogo Completo</button>
      </div>
    </div>

    <!-- 0. BIBLIOTECA CLOUD DIRECTA -->
    <div id="cloudSection">
      <div class="section-title"><span>★</span> Biblioteca Cloud Directa</div>
      <div class="options-grid" style="margin-bottom: 24px;">
        <div class="card-checkbox active" data-type="provider" data-val="yandex" style="grid-column: 1 / -1; border-color: rgba(14, 165, 233, 0.4); background: rgba(14, 165, 233, 0.08);">
          <div class="card-info">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="name">TACIT Cloud</span>
              <span style="background: #0ea5e9; color: black; font-size: 0.68rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Instantáneo</span>
            </div>
            <span class="desc">Reproducción instantánea en alta velocidad desde SQLite</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
      </div>
    </div>

    <!-- SECCIÓN DE PROVEEDORES WEB INDIVIDUALES (OCULTO EN SOLO NUBE Y EQUILIBRADO) -->
    <div id="webProvidersSection" style="display: none;">
      <!-- 1. PROVEEDORES DE PELÍCULAS -->
      <div class="section-title"><span>1</span> Catálogo de Películas</div>
      <div class="options-grid">
        <div class="card-checkbox active" data-type="provider" data-val="hackstore_torrent">
          <div class="card-info">
            <span class="name">Hackstore Torrents</span>
            <span class="desc">Torrents P2P en 4K y 1080p</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="provider" data-val="hackstore_direct">
          <div class="card-info">
            <span class="name">Hackstore Directo</span>
            <span class="desc">Streaming Vimeos 1080p</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="provider" data-val="cinecalidad">
          <div class="card-info">
            <span class="name">CineCalidad</span>
            <span class="desc">Servidores Vimeos y VOE</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
      </div>

      <!-- 2. PROVEEDORES DE SERIES -->
      <div class="section-title" style="margin-top: 16px;"><span>2</span> Catálogo de Series</div>
      <div class="options-grid">
        <div class="card-checkbox active" data-type="provider" data-val="cuevana">
          <div class="card-info">
            <span class="name">Cuevana</span>
            <span class="desc">Series completas y estrenos (VidHide / VOE)</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="provider" data-val="pelisplus">
          <div class="card-info">
            <span class="name">PelisPlus</span>
            <span class="desc">Temporadas completas y estrenos</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
      </div>

      <!-- 3. ANIME -->
      <div class="section-title" style="margin-top: 16px;"><span>3</span> Catálogo de Anime</div>
      <div class="options-grid">
        <div class="card-checkbox active" data-type="provider" data-val="tioanime">
          <div class="card-info">
            <span class="name">TioAnime</span>
            <span class="desc">Anime en Audio Latino y Subtitulado</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
      </div>
    </div>

    <!-- 4. CALIDADES (100% PERSONALIZABLE EN CUALQUIER MODO) -->
    <div id="qualitiesSection" style="margin-top: 16px;">
      <div class="section-title"><span>4</span> Calidades Deseadas</div>
      <div class="options-grid">
        <div class="card-checkbox active" data-type="quality" data-val="4k">
          <div class="card-info">
            <span class="name">4K Ultra HD</span>
            <span class="desc">2160p · Mayor fidelidad</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="quality" data-val="1080p">
          <div class="card-info">
            <span class="name">1080p Full HD</span>
            <span class="desc">Resolución recomendada</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="quality" data-val="720p">
          <div class="card-info">
            <span class="name">720p HD</span>
            <span class="desc">Carga ligera y rápida</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="quality" data-val="480p">
          <div class="card-info">
            <span class="name">480p SD</span>
            <span class="desc">Ahorro de datos móviles</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
      </div>
    </div>

    <!-- 5. OPCIONES AVANZADAS Y PRIVACIDAD -->
    <div id="optionsSection" style="margin-top: 20px;">
      <div id="torrentCardContainer" style="margin-bottom: 12px;">
        <div class="card-checkbox" data-type="disableTorrents" id="disableTorrentsCard">
          <div class="card-info">
            <span class="name">🚫 Desactivar Torrents</span>
            <span class="desc">Solo entregar streaming directo HTTPS (Máxima privacidad, ideal para iOS y Smart TV)</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
      </div>

      <div id="universalCardContainer" style="margin-bottom: 12px;">
        <div class="card-checkbox" data-type="universal" id="universalCard">
          <div class="card-info">
            <span class="name">🔄 Búsqueda Universal</span>
            <span class="desc">Consultar todos los proveedores sin distinguir si es película o serie</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
      </div>

      <div id="priorityContainer" style="display: none; margin-bottom: 12px;">
        <div class="section-title"><span>5</span> Prioridad de Reproducción</div>
        <div class="options-grid">
          <div class="card-checkbox active" data-type="priority" data-val="direct">
            <div class="card-info">
              <span class="name">Directo Primero</span>
              <span class="desc">Servidores web y nube al inicio</span>
            </div>
            <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
          </div>

          <div class="card-checkbox" data-type="priority" data-val="torrent">
            <div class="card-info">
              <span class="name">Torrents Primero</span>
              <span class="desc">Enlaces P2P con mayor calidad al inicio</span>
            </div>
            <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 6. LÍMITES DE ENLACES (SLIDERS INTELIGENTES) -->
    <div id="cloudSliderContainer" class="slider-container" style="margin-top: 16px; margin-bottom: 14px;">
      <div class="slider-header">
        <span class="slider-title">☁️ Enlaces Biblioteca Cloud (TACIT)</span>
        <span class="slider-value" id="cloudLabel">10 enlaces</span>
      </div>
      <input type="range" id="cloudSlider" min="1" max="15" value="10">
      <p style="font-size: 0.76rem; color: var(--text-muted); margin-top: 8px;">Cantidad de versiones únicas de la nube directa (diferentes calidades, audios y tamaños).</p>
    </div>

    <div id="webSliderContainer" class="slider-container" style="margin-bottom: 14px;">
      <div class="slider-header">
        <span class="slider-title">🌐 Enlaces de Respaldo Web</span>
        <span class="slider-value" id="webLabel">3 por proveedor</span>
      </div>
      <input type="range" id="webSlider" min="1" max="10" value="3">
      <p style="font-size: 0.76rem; color: var(--text-muted); margin-top: 8px;">Límite de streams que aportará cada proveedor externo como contingencia cuando no esté en la nube.</p>
    </div>

    <!-- ACCIONES DE INSTALACIÓN -->
    <div class="actions">
      <a href="#" id="installBtn" class="btn-install">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        Instalar en Stremio
      </a>
      <button type="button" id="copyBtn" class="btn-copy">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        Copiar Enlace de Instalación
      </button>
      <div class="copied-toast" id="toast">¡Enlace copiado al portapapeles!</div>
    </div>
  </div>

  <script>
    const baseUrl = window.location.origin;

    const initialServerConfig = ${JSON.stringify(initialConfig)};
    const state = initialServerConfig ? {
      mode: initialServerConfig.mode || 'balanced',
      providers: initialServerConfig.providers || ['yandex', 'hackstore_torrent', 'hackstore_direct', 'cinecalidad', 'cuevana', 'pelisplus', 'tioanime'],
      qualities: initialServerConfig.qualities || ['4k', '1080p', '720p', '480p'],
      priority: initialServerConfig.priority || 'direct',
      smartMode: initialServerConfig.smartMode !== undefined ? initialServerConfig.smartMode : true,
      disableTorrents: Boolean(initialServerConfig.disableTorrents),
      maxCloudStreams: initialServerConfig.maxCloudStreams || 10,
      maxWebStreams: initialServerConfig.maxWebStreams || 3,
      universalSearch: Boolean(initialServerConfig.universalSearch),
      minSeeders: 1
    } : {
      mode: 'balanced',
      providers: ['yandex', 'hackstore_torrent', 'hackstore_direct', 'cinecalidad', 'cuevana', 'pelisplus', 'tioanime'],
      qualities: ['4k', '1080p', '720p', '480p'],
      priority: 'direct',
      smartMode: true,
      disableTorrents: false,
      maxCloudStreams: 10,
      maxWebStreams: 3,
      universalSearch: false,
      minSeeders: 1
    };

    function syncUI() {
      // Modos y visibilidad dinámica por etapas
      const isCloud = (state.mode === 'cloud');
      const isBalanced = (state.mode === 'balanced');
      const isFull = (state.mode === 'full');

      // Botones de presets
      document.getElementById('presetCloud').classList.toggle('active-preset', isCloud);
      document.getElementById('presetBalanced').classList.toggle('active-preset', isBalanced);
      document.getElementById('presetFull').classList.toggle('active-preset', isFull);

      // Ocultar / Mostrar secciones
      document.getElementById('webProvidersSection').style.display = isFull ? 'block' : 'none';
      document.getElementById('priorityContainer').style.display = isFull ? 'block' : 'none';
      document.getElementById('torrentCardContainer').style.display = (isBalanced || isFull) ? 'block' : 'none';
      document.getElementById('webSliderContainer').style.display = (isBalanced || isFull) ? 'block' : 'none';
      document.getElementById('universalCardContainer').style.display = (isBalanced || isFull) ? 'block' : 'none';
      document.getElementById('cloudSliderContainer').style.display = 'block';
      document.getElementById('qualitiesSection').style.display = 'block';

      // Checkboxes individuales
      document.querySelectorAll('.card-checkbox').forEach(card => {
        const type = card.dataset.type;
        const val = card.dataset.val;

        if (type === 'provider') {
          card.classList.toggle('active', state.providers.includes(val));
        } else if (type === 'quality') {
          card.classList.toggle('active', state.qualities.includes(val));
        } else if (type === 'priority') {
          card.classList.toggle('active', state.priority === val);
        } else if (type === 'universal') {
          card.classList.toggle('active', Boolean(state.universalSearch));
        } else if (type === 'disableTorrents') {
          card.classList.toggle('active', Boolean(state.disableTorrents));
        }
      });

      // Sliders
      const cloudSlider = document.getElementById('cloudSlider');
      const cloudLabel = document.getElementById('cloudLabel');
      cloudSlider.value = state.maxCloudStreams;
      cloudLabel.textContent = state.maxCloudStreams + ' enlaces';

      const webSlider = document.getElementById('webSlider');
      const webLabel = document.getElementById('webLabel');
      webSlider.value = state.maxWebStreams;
      webLabel.textContent = state.maxWebStreams === 1 ? '1 por proveedor' : state.maxWebStreams + ' por proveedor';

      updateUrls();
    }

    // Presets click
    document.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        state.mode = preset;

        if (preset === 'cloud') {
          state.providers = ['yandex'];
          state.smartMode = true;
          state.disableTorrents = true;
          state.maxCloudStreams = 10;
          state.maxWebStreams = 1;
          state.universalSearch = false;
        } else if (preset === 'balanced') {
          state.providers = ['yandex', 'hackstore_torrent', 'hackstore_direct', 'cinecalidad', 'cuevana', 'pelisplus', 'tioanime'];
          state.smartMode = true;
          state.disableTorrents = false;
          state.maxCloudStreams = 10;
          state.maxWebStreams = 3;
          state.universalSearch = false;
        } else if (preset === 'full') {
          state.providers = ['yandex', 'hackstore_torrent', 'hackstore_direct', 'cinecalidad', 'cuevana', 'pelisplus', 'tioanime'];
          state.smartMode = false;
          state.disableTorrents = false;
          state.maxCloudStreams = 15;
          state.maxWebStreams = 10;
          state.universalSearch = true;
        }

        syncUI();
      });
    });

    // Checkboxes interaction (100% personalizable en cualquier momento)
    document.querySelectorAll('.card-checkbox').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.type;
        const val = card.dataset.val;

        if (type === 'priority') {
          document.querySelectorAll('[data-type="priority"]').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          state.priority = val;
        } else if (type === 'provider') {
          card.classList.toggle('active');
          if (card.classList.contains('active')) {
            if (!state.providers.includes(val)) state.providers.push(val);
          } else {
            state.providers = state.providers.filter(p => p !== val);
          }
        } else if (type === 'quality') {
          card.classList.toggle('active');
          if (card.classList.contains('active')) {
            if (!state.qualities.includes(val)) state.qualities.push(val);
          } else {
            state.qualities = state.qualities.filter(q => q !== val);
          }
        } else if (type === 'universal') {
          card.classList.toggle('active');
          state.universalSearch = card.classList.contains('active');
        } else if (type === 'disableTorrents') {
          card.classList.toggle('active');
          state.disableTorrents = card.classList.contains('active');
        }

        updateUrls();
      });
    });

    // Sliders interaction
    const cloudSlider = document.getElementById('cloudSlider');
    const cloudLabel = document.getElementById('cloudLabel');
    cloudSlider.addEventListener('input', (e) => {
      state.maxCloudStreams = parseInt(e.target.value, 10);
      cloudLabel.textContent = state.maxCloudStreams + ' enlaces';
      updateUrls();
    });

    const webSlider = document.getElementById('webSlider');
    const webLabel = document.getElementById('webLabel');
    webSlider.addEventListener('input', (e) => {
      state.maxWebStreams = parseInt(e.target.value, 10);
      webLabel.textContent = state.maxWebStreams === 1 ? '1 por proveedor' : state.maxWebStreams + ' por proveedor';
      updateUrls();
    });

    function getManifestUrl() {
      const jsonStr = JSON.stringify(state);
      const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
      return baseUrl + '/' + b64 + '/manifest.json';
    }

    function updateUrls() {
      const manifestUrl = getManifestUrl();
      const stremioUrl = manifestUrl.replace(/^https?:\\/\\//, 'stremio://');
      document.getElementById('installBtn').setAttribute('href', stremioUrl);
    }

    syncUI();

    // Copy button
    document.getElementById('copyBtn').addEventListener('click', () => {
      const manifestUrl = getManifestUrl();
      navigator.clipboard.writeText(manifestUrl).then(() => {
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
      });
    });
  </script>
</body>
</html>`;
}

app.get('/', (req, res) => {
  res.send(renderConfigPage(req));
});

app.get('/configure', (req, res) => {
  res.send(renderConfigPage(req));
});

app.get('/:configuration/configure', (req, res) => {
  res.send(renderConfigPage(req));
});

// Start Server
app.listen(PORT, () => {
  console.log(`[TACIT STR] Servidor corriendo en el puerto ${PORT}`);
  console.log(`[TACIT STR] URL de Configuración: http://localhost:${PORT}/configure`);
  console.log(`[TACIT STR] URL del Manifiesto: http://localhost:${PORT}/manifest.json`);
});
