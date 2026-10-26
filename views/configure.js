/**
 * Plantilla y renderizador interactivo de la página de configuración (/configure)
 */

function renderConfigPage(initialConfig = null, baseUrl = '') {
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
      margin-bottom: 30px;
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
      font-size: 2.3rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }

    p.subtitle {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .section-block {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.075);
      border-radius: 18px;
      padding: 22px 20px;
      margin-bottom: 22px;
      transition: all 0.2s ease;
    }

    .section-block-header {
      margin-bottom: 14px;
    }

    .section-block-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-block-desc {
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-top: 4px;
      line-height: 1.45;
    }

    .mode-explanation {
      background: rgba(14, 165, 233, 0.08);
      border: 1px solid rgba(14, 165, 233, 0.22);
      border-radius: 12px;
      padding: 13px 15px;
      font-size: 0.84rem;
      color: #e0f2fe;
      line-height: 1.5;
      margin-top: 14px;
    }

    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    @media (max-width: 600px) {
      .options-grid { grid-template-columns: 1fr; }
      .container { padding: 26px 16px; }
      h1 { font-size: 1.9rem; }
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
      padding: 10px 12px;
      border-radius: 11px;
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
      font-size: 0.88rem;
      font-weight: 600;
      color: #f1f5f9;
    }

    .slider-value {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--accent);
      background: rgba(14, 165, 233, 0.15);
      padding: 3px 10px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
    }

    input[type=range] {
      -webkit-appearance: none;
      width: 100%;
      background: transparent;
    }

    input[type=range]:focus {
      outline: none;
    }

    input[type=range]::-webkit-slider-runnable-track {
      width: 100%;
      height: 6px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 999px;
    }

    input[type=range]::-webkit-slider-thumb {
      height: 18px;
      width: 18px;
      border-radius: 50%;
      background: var(--accent);
      cursor: pointer;
      -webkit-appearance: none;
      margin-top: -6px;
      box-shadow: 0 0 10px var(--accent-glow);
      transition: transform 0.1s ease;
    }

    input[type=range]::-webkit-slider-thumb:hover {
      transform: scale(1.15);
    }

    .actions {
      margin-top: 28px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .btn-install {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: white;
      text-decoration: none;
      font-weight: 700;
      font-size: 1.05rem;
      padding: 16px 20px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 10px 25px rgba(2, 132, 199, 0.4);
      transition: all 0.2s;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }

    .btn-install:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 30px rgba(2, 132, 199, 0.5);
    }

    .btn-copy {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text-muted);
      font-size: 0.88rem;
      font-weight: 600;
      padding: 12px 16px;
      border-radius: 12px;
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
      <p class="subtitle">Configura tus fuentes de reproducción y preferencias en Español Latino para Stremio.</p>
    </div>

    <!-- 1. BLOQUE: MODO DE FUNCIONAMIENTO -->
    <div class="section-block" id="modeBlock">
      <div class="section-block-header">
        <div class="section-block-title">🎯 Modo de Funcionamiento</div>
        <div class="section-block-desc">Elige cómo quieres que el addon busque y entregue tus películas o series.</div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
        <button type="button" class="btn-preset" id="presetCloud" data-preset="cloud">☁️ Solo Nube</button>
        <button type="button" class="btn-preset active-preset" id="presetBalanced" data-preset="balanced">⚡ Equilibrado</button>
        <button type="button" class="btn-preset" id="presetFull" data-preset="full">🚀 Catálogo Completo</button>
      </div>
      <div class="mode-explanation" id="modeDescBox"></div>
    </div>

    <!-- 2. BLOQUE: BIBLIOTECA CLOUD DIRECTA (NUESTRA COLECCIÓN) -->
    <div class="section-block" id="cloudSectionBlock">
      <div class="section-block-header">
        <div class="section-block-title">☁️ Biblioteca Cloud Directa</div>
        <div class="section-block-desc">Colección interna de películas y series en alta velocidad, con audio latino/inglés y sin intermediarios.</div>
      </div>

      <div class="card-checkbox active" data-type="provider" data-val="yandex" style="border-color: rgba(14, 165, 233, 0.4); background: rgba(14, 165, 233, 0.08); margin-bottom: 14px;">
        <div class="card-info">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="name">TACIT Cloud</span>
            <span style="background: #0ea5e9; color: black; font-size: 0.68rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Directo</span>
          </div>
          <span class="desc">Reproducción directa inmediata desde almacenamiento en la nube</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>

      <!-- Control de cantidad de enlaces de la nube -->
      <div class="slider-container" style="background: rgba(255, 255, 255, 0.015);">
        <div class="slider-header">
          <span class="slider-title">Cantidad de enlaces de la nube</span>
          <span class="slider-value" id="cloudLabel">10 enlaces</span>
        </div>
        <input type="range" id="cloudSlider" min="1" max="15" value="10">
        <p style="font-size: 0.76rem; color: var(--text-muted); margin-top: 8px;">Número de versiones diferentes a mostrar (calidades, audios y tamaños de archivo).</p>
      </div>
    </div>

    <!-- 3. BLOQUE: PÁGINAS WEB DE RESPALDO (VISIBLE EN EQUILIBRADO Y CATÁLOGO COMPLETO) -->
    <div class="section-block" id="webSectionBlock">
      <div class="section-block-header">
        <div class="section-block-title">🌐 Páginas Web de Respaldo</div>
        <div class="section-block-desc">Sitios web que se consultarán si un título no está en la nube (en modo equilibrado) o al mismo tiempo (en catálogo completo). Puedes activar o desactivar los que prefieras.</div>
      </div>

      <!-- Selector: Búsqueda Especializada vs Global -->
      <div style="margin-bottom: 16px;">
        <div style="font-size: 0.8rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">Tipo de Búsqueda Web</div>
        <div class="options-grid">
          <div class="card-checkbox active" data-type="scope" data-val="specialized">
            <div class="card-info">
              <span class="name">🎯 Especializada</span>
              <span class="desc">Consulta solo los sitios según el contenido (películas en películas, series en series). Más rápido.</span>
            </div>
            <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
          </div>

          <div class="card-checkbox" data-type="scope" data-val="global">
            <div class="card-info">
              <span class="name">🌐 Global</span>
              <span class="desc">Consulta todas las páginas web activas sin distinción, buscando en todas partes por si acaso.</span>
            </div>
            <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
          </div>
        </div>
      </div>

      <!-- Películas -->
      <div style="font-size: 0.8rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">Películas</div>
      <div class="options-grid" style="margin-bottom: 14px;">
        <div class="card-checkbox active" data-type="provider" data-val="cinecalidad">
          <div class="card-info">
            <span class="name">CineCalidad</span>
            <span class="desc">Servidores Vimeos y VOE</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="provider" data-val="hackstore_direct">
          <div class="card-info">
            <span class="name">Hackstore Directo</span>
            <span class="desc">Streaming directo en alta definición</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="provider" data-val="hackstore_torrent">
          <div class="card-info">
            <span class="name">Hackstore Torrents</span>
            <span class="desc">Torrents P2P en 4K y 1080p</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
      </div>

      <!-- Series -->
      <div style="font-size: 0.8rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">Series</div>
      <div class="options-grid" style="margin-bottom: 14px;">
        <div class="card-checkbox active" data-type="provider" data-val="cuevana">
          <div class="card-info">
            <span class="name">Cuevana</span>
            <span class="desc">Series completas y estrenos</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="provider" data-val="pelisplus">
          <div class="card-info">
            <span class="name">PelisPlus</span>
            <span class="desc">Temporadas completas y episodios</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
      </div>

      <!-- Anime -->
      <div style="font-size: 0.8rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">Anime</div>
      <div class="options-grid" style="margin-bottom: 14px;">
        <div class="card-checkbox active" data-type="provider" data-val="tioanime">
          <div class="card-info">
            <span class="name">TioAnime</span>
            <span class="desc">Episodios en audio latino y subtitulado</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
      </div>

      <!-- Control de cantidad de enlaces web -->
      <div class="slider-container" style="background: rgba(255, 255, 255, 0.015); margin-bottom: 12px;">
        <div class="slider-header">
          <span class="slider-title">Enlaces por página web</span>
          <span class="slider-value" id="webLabel">3 por página</span>
        </div>
        <input type="range" id="webSlider" min="1" max="10" value="3">
        <p style="font-size: 0.76rem; color: var(--text-muted); margin-top: 8px;">Límite de opciones que aportará cada página web cuando sea consultada.</p>
      </div>

      <!-- Prioridad Directo vs Torrents -->
      <div id="priorityContainer" style="margin-top: 10px;">
        <div style="font-size: 0.8rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">Prioridad de orden</div>
        <div class="options-grid">
          <div class="card-checkbox active" data-type="priority" data-val="direct">
            <div class="card-info">
              <span class="name">Directo Primero</span>
              <span class="desc">Muestra los reproductores web al inicio</span>
            </div>
            <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
          </div>
          <div class="card-checkbox" data-type="priority" data-val="torrent">
            <div class="card-info">
              <span class="name">Torrents Primero</span>
              <span class="desc">Muestra enlaces P2P con mayor calidad al inicio</span>
            </div>
            <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. BLOQUE: CALIDAD DE VIDEO Y FILTROS (UNIVERSAL) -->
    <div class="section-block" id="qualitySectionBlock">
      <div class="section-block-header">
        <div class="section-block-title">🎬 Calidad de Video y Filtros</div>
        <div class="section-block-desc">Estas preferencias se aplican a todos los enlaces encontrados, tanto de la nube como de las páginas web.</div>
      </div>

      <div class="options-grid" style="margin-bottom: 14px;">
        <div class="card-checkbox active" data-type="quality" data-val="4k">
          <div class="card-info">
            <span class="name">4K Ultra HD</span>
            <span class="desc">2160p · Máxima fidelidad de imagen</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="quality" data-val="1080p">
          <div class="card-info">
            <span class="name">1080p Full HD</span>
            <span class="desc">Resolución recomendada para todo uso</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="quality" data-val="720p">
          <div class="card-info">
            <span class="name">720p HD</span>
            <span class="desc">Carga rápida y fluida</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="quality" data-val="480p">
          <div class="card-info">
            <span class="name">480p SD</span>
            <span class="desc">Bajo consumo de datos móviles</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
      </div>

      <!-- Filtro de Torrents -->
      <div>
        <div class="card-checkbox" data-type="disableTorrents" id="disableTorrentsCard">
          <div class="card-info">
            <span class="name">🚫 Desactivar Enlaces Torrent</span>
            <span class="desc">Muestra únicamente reproducción directa en línea (ideal para Smart TV, Fire TV o si no usas VPN).</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
      </div>
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
    const baseUrl = ${JSON.stringify(baseUrl)} || window.location.origin;

    const initialServerConfig = ${JSON.stringify(initialConfig)};
    const state = initialServerConfig ? {
      mode: initialServerConfig.mode || 'balanced',
      scraperScope: initialServerConfig.scraperScope || 'specialized',
      providers: initialServerConfig.providers || ['yandex', 'hackstore_torrent', 'hackstore_direct', 'cinecalidad', 'cuevana', 'pelisplus', 'tioanime'],
      qualities: initialServerConfig.qualities || ['4k', '1080p', '720p', '480p'],
      priority: initialServerConfig.priority || 'direct',
      disableTorrents: Boolean(initialServerConfig.disableTorrents),
      maxCloudStreams: initialServerConfig.maxCloudStreams || 10,
      maxWebStreams: initialServerConfig.maxWebStreams || 3,
      minSeeders: 1
    } : {
      mode: 'balanced',
      scraperScope: 'specialized',
      providers: ['yandex', 'hackstore_torrent', 'hackstore_direct', 'cinecalidad', 'cuevana', 'pelisplus', 'tioanime'],
      qualities: ['4k', '1080p', '720p', '480p'],
      priority: 'direct',
      disableTorrents: false,
      maxCloudStreams: 10,
      maxWebStreams: 3,
      minSeeders: 1
    };

    const MODE_DESCRIPTIONS = {
      cloud: '☁️ <strong>Solo Nube:</strong> Consulta únicamente nuestra biblioteca interna. Cero esperas, enlaces directos en menos de 1 segundo y sin depender de páginas web externas.',
      balanced: '⚡ <strong>Equilibrado (Recomendado):</strong> Lo mejor de ambos mundos. Primero busca en nuestra biblioteca en la nube; si el título está disponible, te lo entrega de inmediato. Si no lo encuentra, activa como respaldo las páginas web que elijas abajo.',
      full: '🚀 <strong>Catálogo Completo:</strong> Consulta nuestra biblioteca y todas las páginas web al mismo tiempo sin esperar a nadie, reuniendo la mayor cantidad posible de opciones.'
    };

    function syncUI() {
      const isCloud = (state.mode === 'cloud');
      const isBalanced = (state.mode === 'balanced');
      const isFull = (state.mode === 'full');

      // Botones de presets
      document.getElementById('presetCloud').classList.toggle('active-preset', isCloud);
      document.getElementById('presetBalanced').classList.toggle('active-preset', isBalanced);
      document.getElementById('presetFull').classList.toggle('active-preset', isFull);

      // Texto explicativo dinámico según modo
      document.getElementById('modeDescBox').innerHTML = MODE_DESCRIPTIONS[state.mode] || MODE_DESCRIPTIONS.balanced;

      // Ocultar / Mostrar bloques
      // En modo Solo Nube se oculta el bloque de páginas web (porque no se usan)
      // En modo Equilibrado y Catálogo Completo el bloque de páginas web está VISIBLE para elegir cuáles usar
      document.getElementById('webSectionBlock').style.display = isCloud ? 'none' : 'block';
      document.getElementById('priorityContainer').style.display = (!state.disableTorrents && !isCloud) ? 'block' : 'none';

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
        } else if (type === 'scope') {
          card.classList.toggle('active', state.scraperScope === val);
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
      webLabel.textContent = state.maxWebStreams === 1 ? '1 por página' : state.maxWebStreams + ' por página';

      updateUrls();
    }

    // Presets click
    document.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        state.mode = preset;

        if (preset === 'cloud') {
          state.providers = ['yandex'];
          state.disableTorrents = true;
          state.maxCloudStreams = 10;
          state.maxWebStreams = 1;
        } else if (preset === 'balanced') {
          state.providers = ['yandex', 'hackstore_torrent', 'hackstore_direct', 'cinecalidad', 'cuevana', 'pelisplus', 'tioanime'];
          state.disableTorrents = false;
          state.maxCloudStreams = 10;
          state.maxWebStreams = 3;
        } else if (preset === 'full') {
          state.providers = ['yandex', 'hackstore_torrent', 'hackstore_direct', 'cinecalidad', 'cuevana', 'pelisplus', 'tioanime'];
          state.disableTorrents = false;
          state.maxCloudStreams = 15;
          state.maxWebStreams = 10;
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
        } else if (type === 'scope') {
          document.querySelectorAll('[data-type="scope"]').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          state.scraperScope = val;
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
        } else if (type === 'disableTorrents') {
          card.classList.toggle('active');
          state.disableTorrents = card.classList.contains('active');
          document.getElementById('priorityContainer').style.display = (!state.disableTorrents && state.mode !== 'cloud') ? 'block' : 'none';
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
      webLabel.textContent = state.maxWebStreams === 1 ? '1 por página' : state.maxWebStreams + ' por página';
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

    // Botón copiar enlace
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

module.exports = {
  renderConfigPage
};
