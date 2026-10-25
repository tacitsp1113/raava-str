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
  const customManifest = {
    ...manifest,
    name: 'TACIT STR',
    description: `TACIT STR · Tacit Ronin Edition (${config.providers.length} fuentes activas · Max ${config.maxStreams} links · ${config.priority === 'direct' ? 'Directo prioritario' : 'Torrents prioritarios'})`
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

// --- INTERACTIVE CONFIGURATION & INSTALLATION PAGE ---

function renderConfigPage(req) {
  const host = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TACIT STR - Tacit Ronin Jaeger System</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07060d;
      --card-bg: rgba(18, 14, 33, 0.75);
      --card-border: rgba(139, 92, 246, 0.25);
      --accent: #8b5cf6;
      --accent-glow: rgba(139, 92, 246, 0.4);
      --accent-hover: #7c3aed;
      --cyan: #06b6d4;
      --blade: #e0e7ff;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Outfit', sans-serif;
    }

    body {
      background: radial-gradient(circle at 50% 8%, #1f1442 0%, #0a0814 55%, #040308 100%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }

    .container {
      max-width: 720px;
      width: 100%;
      background: var(--card-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--card-border);
      border-radius: 30px;
      padding: 44px 38px;
      box-shadow: 0 35px 70px rgba(0, 0, 0, 0.8), 0 0 50px rgba(139, 92, 246, 0.15);
      position: relative;
    }

    .header {
      text-align: center;
      margin-bottom: 34px;
    }

    .jaeger-emblem {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 80px;
      height: 80px;
      border-radius: 22px;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.35), rgba(6, 182, 212, 0.25));
      border: 1px solid rgba(255, 255, 255, 0.2);
      margin-bottom: 16px;
      box-shadow: 0 12px 30px rgba(139, 92, 246, 0.35);
    }

    .jaeger-emblem img {
      width: 54px;
      height: 54px;
      object-fit: contain;
    }

    .badge-jaeger {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.4);
      color: #c4b5fd;
      padding: 6px 18px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
      margin-bottom: 14px;
      letter-spacing: 1px;
      text-transform: uppercase;
      font-family: 'JetBrains Mono', monospace;
    }

    .dot {
      width: 8px;
      height: 8px;
      background: #06b6d4;
      border-radius: 50%;
      box-shadow: 0 0 12px #06b6d4;
    }

    h1 {
      font-size: 2.8rem;
      font-weight: 900;
      background: linear-gradient(135deg, #ffffff 40%, #c4b5fd 80%, #06b6d4 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    p.subtitle {
      color: var(--text-muted);
      font-size: 1.05rem;
      line-height: 1.55;
    }

    .section-title {
      font-size: 0.92rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #a78bfa;
      margin: 28px 0 14px 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-title span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: rgba(139, 92, 246, 0.25);
      font-size: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
    }

    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    @media (max-width: 600px) {
      .options-grid { grid-template-columns: 1fr; }
      .container { padding: 32px 20px; }
      h1 { font-size: 2.2rem; }
    }

    .card-checkbox {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 16px 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.2s ease;
      user-select: none;
    }

    .card-checkbox:hover {
      border-color: rgba(139, 92, 246, 0.45);
      background: rgba(139, 92, 246, 0.06);
      transform: translateY(-2px);
    }

    .card-checkbox.active {
      border-color: var(--accent);
      background: rgba(139, 92, 246, 0.14);
      box-shadow: 0 0 25px rgba(139, 92, 246, 0.2);
    }

    .card-info {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .card-info .name {
      font-weight: 600;
      font-size: 0.98rem;
      color: #fff;
    }

    .card-info .desc {
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .custom-check {
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .card-checkbox.active .custom-check {
      background: var(--accent);
      border-color: var(--accent);
    }

    .custom-check svg {
      width: 14px;
      height: 14px;
      stroke: white;
      stroke-width: 3;
      fill: none;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .card-checkbox.active .custom-check svg {
      opacity: 1;
    }

    /* Slider styling */
    .slider-container {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 18px 20px;
    }

    .slider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .slider-value {
      font-size: 1.25rem;
      font-weight: 800;
      color: #a78bfa;
      font-family: 'JetBrains Mono', monospace;
    }

    input[type=range] {
      width: 100%;
      height: 6px;
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.1);
      outline: none;
      -webkit-appearance: none;
    }

    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--accent);
      cursor: pointer;
      box-shadow: 0 0 14px var(--accent);
      transition: transform 0.1s;
    }

    input[type=range]::-webkit-slider-thumb:hover {
      transform: scale(1.15);
    }

    /* Actions */
    .actions {
      margin-top: 36px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .btn-install {
      background: linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%);
      color: white;
      text-decoration: none;
      padding: 18px;
      border-radius: 16px;
      font-size: 1.15rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 10px 30px rgba(124, 58, 237, 0.45);
      transition: all 0.25s ease;
      cursor: pointer;
      border: none;
      width: 100%;
    }

    .btn-install:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 35px rgba(124, 58, 237, 0.65);
      background: linear-gradient(135deg, #8b5cf6 0%, #22d3ee 100%);
    }

    .btn-copy {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      padding: 14px;
      border-radius: 14px;
      font-size: 0.95rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-copy:hover {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }

    .copied-toast {
      color: #34d399;
      font-size: 0.85rem;
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
      <div class="jaeger-emblem">
        <img src="/logo.png" alt="TACIT STR Logo">
      </div>
      <br>
      <div class="badge-jaeger">
        <span class="dot"></span> Tacit Ronin Jaeger Edition v1.0
      </div>
      <h1>TACIT STR</h1>
      <p class="subtitle">Inspirado en la velocidad y precisión de Tacit Ronin. Personaliza tu motor de películas, series y anime en Español Latino para Stremio.</p>
    </div>

    <!-- 1. PROVEEDORES -->
    <div class="section-title"><span>1</span> Red de Proveedores (Latino)</div>
    <div class="options-grid">
      <div class="card-checkbox active" data-type="provider" data-val="hackstore_torrent">
        <div class="card-info">
          <span class="name">Hackstore Torrents</span>
          <span class="desc">Torrents 4K/1080p · Seeders P2P</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>

      <div class="card-checkbox active" data-type="provider" data-val="hackstore_direct">
        <div class="card-info">
          <span class="name">Hackstore Directo</span>
          <span class="desc">Vimeos 1080p instantáneo</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>

      <div class="card-checkbox active" data-type="provider" data-val="cinecalidad">
        <div class="card-info">
          <span class="name">CineCalidad</span>
          <span class="desc">Streaming VOE / Vimeos Latino</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>

      <div class="card-checkbox active" data-type="provider" data-val="cuevana">
        <div class="card-info">
          <span class="name">Cuevana</span>
          <span class="desc">Catálogo masivo películas/series</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>

      <div class="card-checkbox active" data-type="provider" data-val="pelisplus">
        <div class="card-info">
          <span class="name">PelisPlus</span>
          <span class="desc">Series completas y estrenos</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>

      <div class="card-checkbox active" data-type="provider" data-val="tioanime">
        <div class="card-info">
          <span class="name">TioAnime</span>
          <span class="desc">Anime en Audio Latino y Subtitulado</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>
    </div>

    <!-- 2. CALIDADES -->
    <div class="section-title"><span>2</span> Calidades Permitidas</div>
    <div class="options-grid">
      <div class="card-checkbox active" data-type="quality" data-val="4k">
        <div class="card-info">
          <span class="name">4K Ultra HD</span>
          <span class="desc">2160p · HDR / Dolby Vision</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>

      <div class="card-checkbox active" data-type="quality" data-val="1080p">
        <div class="card-info">
          <span class="name">1080p Full HD</span>
          <span class="desc">Recomendado para TV y PC</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>

      <div class="card-checkbox active" data-type="quality" data-val="720p">
        <div class="card-info">
          <span class="name">720p HD</span>
          <span class="desc">Conexiones lentas o móviles</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>

      <div class="card-checkbox" data-type="quality" data-val="480p">
        <div class="card-info">
          <span class="name">480p SD</span>
          <span class="desc">Ahorro máximo de datos</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>
    </div>

    <!-- 3. PRIORIDAD Y MÁXIMO DE ENLACES -->
    <div class="section-title"><span>3</span> Prioridad de Combate & Límite</div>
    <div class="options-grid" style="margin-bottom: 12px;">
      <div class="card-checkbox active" data-type="priority" data-val="direct">
        <div class="card-info">
          <span class="name">⚡ Directo Primero</span>
          <span class="desc">Ataque veloz · Reproducción inmediata</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>

      <div class="card-checkbox" data-type="priority" data-val="torrent">
        <div class="card-info">
          <span class="name">🧲 Torrents Primero</span>
          <span class="desc">Fuerza bruta · Máximo Bitrate / 4K</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>
    </div>

    <div class="slider-container">
      <div class="slider-header">
        <span style="font-weight: 600;">Máximo de enlaces en pantalla</span>
        <span class="slider-value" id="maxLabel">4 enlaces</span>
      </div>
      <input type="range" id="maxSlider" min="1" max="10" value="4">
    </div>

    <!-- ACCIONES DE INSTALACIÓN -->
    <div class="actions">
      <a href="#" id="installBtn" class="btn-install">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        Instalar en Stremio
      </a>
      <button type="button" id="copyBtn" class="btn-copy">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        Copiar Enlace de Instalación
      </button>
      <div class="copied-toast" id="toast">¡Enlace copiado al portapapeles!</div>
    </div>
  </div>

  <script>
    const baseUrl = window.location.origin;

    const state = {
      providers: ['hackstore_torrent', 'hackstore_direct', 'cinecalidad', 'cuevana', 'pelisplus', 'tioanime'],
      qualities: ['4k', '1080p', '720p'],
      priority: 'direct',
      maxStreams: 4,
      minSeeders: 1
    };

    // Toggle Checkboxes
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
        }
        updateUrls();
      });
    });

    // Slider
    const slider = document.getElementById('maxSlider');
    const label = document.getElementById('maxLabel');
    slider.addEventListener('input', (e) => {
      state.maxStreams = parseInt(e.target.value, 10);
      label.textContent = state.maxStreams === 1 ? '1 enlace' : state.maxStreams + ' enlaces';
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

    updateUrls();

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

// Start Server
app.listen(PORT, () => {
  console.log(`[TACIT STR] Servidor corriendo en el puerto ${PORT}`);
  console.log(`[TACIT STR] URL de Configuración: http://localhost:${PORT}/configure`);
  console.log(`[TACIT STR] URL del Manifiesto: http://localhost:${PORT}/manifest.json`);
});
