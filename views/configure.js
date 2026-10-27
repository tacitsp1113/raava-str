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
      --card-bg: rgba(16, 22, 34, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent: #0ea5e9;
      --accent-hover: #0284c7;
      --accent-glow: rgba(14, 165, 233, 0.3);
      --cyan: #06b6d4;
      --green: #10b981;
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
      max-width: 760px;
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
      position: relative;
    }

    .section-block.disabled-block {
      opacity: 0.38;
      pointer-events: none;
      filter: grayscale(0.2);
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

    .preset-pills-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .btn-quick-preset {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      padding: 7px 14px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }

    .btn-quick-preset:hover {
      background: rgba(14, 165, 233, 0.15);
      border-color: rgba(14, 165, 233, 0.4);
      color: #38bdf8;
    }

    .btn-quick-preset.active-quick {
      background: rgba(14, 165, 233, 0.22);
      border-color: var(--accent);
      color: #38bdf8;
      box-shadow: 0 0 12px rgba(14, 165, 233, 0.2);
    }

    /* Tabla de Proveedores y Checkboxes */
    .providers-table-card {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .category-separator {
      background: rgba(255, 255, 255, 0.035);
      padding: 8px 14px;
      font-size: 0.74rem;
      font-weight: 700;
      color: #7dd3fc;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .provider-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      transition: background 0.15s ease;
      gap: 12px;
    }

    .provider-row:last-child {
      border-bottom: none;
    }

    .provider-row:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    .provider-meta {
      flex: 1;
      min-width: 0;
    }

    .provider-name-line {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .provider-title {
      font-weight: 600;
      font-size: 0.92rem;
      color: #f8fafc;
    }

    .tag-badge {
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 6px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .tag-recommended {
      background: rgba(16, 185, 129, 0.18);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.35);
    }

    .tag-fast {
      background: rgba(14, 165, 233, 0.18);
      color: #38bdf8;
      border: 1px solid rgba(14, 165, 233, 0.35);
    }

    .tag-retro {
      background: rgba(245, 158, 11, 0.18);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.35);
    }

    .provider-desc {
      font-size: 0.74rem;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .toggle-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .btn-toggle-type {
      background: rgba(255, 255, 255, 0.035);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      padding: 7px 11px;
      border-radius: 9px;
      font-size: 0.76rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      user-select: none;
    }

    .btn-toggle-type:hover {
      border-color: rgba(255, 255, 255, 0.25);
      color: #e2e8f0;
    }

    .btn-toggle-type.active {
      background: rgba(14, 165, 233, 0.18);
      border-color: var(--accent);
      color: #38bdf8;
      box-shadow: 0 0 10px rgba(14, 165, 233, 0.2);
    }

    .btn-toggle-type.active svg {
      stroke: #38bdf8;
    }

    .btn-toggle-type.na {
      opacity: 0.3;
      cursor: not-allowed;
      pointer-events: none;
      border-color: transparent;
      background: transparent;
    }

    .toggle-icon {
      width: 14px;
      height: 14px;
      stroke: #94a3b8;
      stroke-width: 2.2;
      fill: none;
    }

    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    @media (max-width: 640px) {
      .options-grid { grid-template-columns: 1fr; }
      .container { padding: 26px 16px; }
      h1 { font-size: 1.85rem; }
      .provider-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }
      .toggle-group {
        width: 100%;
        justify-content: flex-end;
      }
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
      display: none;
    }

    .card-checkbox.active .custom-check svg {
      display: block;
    }

    .slider-container {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 14px 18px;
    }

    .slider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .slider-title {
      font-size: 0.88rem;
      font-weight: 600;
      color: #f1f5f9;
    }

    .slider-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.84rem;
      color: var(--cyan);
      font-weight: 600;
      background: rgba(6, 182, 212, 0.12);
      padding: 3px 9px;
      border-radius: 6px;
      border: 1px solid rgba(6, 182, 212, 0.3);
    }

    input[type=range] {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      cursor: pointer;
    }

    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--accent);
      cursor: pointer;
      box-shadow: 0 0 10px var(--accent-glow);
      border: 2px solid #ffffff;
    }

    .btn-install {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
      color: #ffffff;
      width: 100%;
      padding: 16px;
      border-radius: 14px;
      border: none;
      font-size: 1.05rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      text-decoration: none;
      box-shadow: 0 10px 25px rgba(14, 165, 233, 0.4);
      transition: all 0.2s ease;
      margin-top: 10px;
      margin-bottom: 12px;
    }

    .btn-install:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 30px rgba(14, 165, 233, 0.5);
      background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
    }

    .btn-copy {
      background: transparent;
      color: var(--text-muted);
      border: 1px solid rgba(255, 255, 255, 0.12);
      width: 100%;
      padding: 12px;
      border-radius: 12px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
    }

    .btn-copy:hover {
      border-color: rgba(255, 255, 255, 0.3);
      color: #ffffff;
      background: rgba(255, 255, 255, 0.03);
    }

    .copied-toast {
      display: none;
      text-align: center;
      color: #34d399;
      font-size: 0.82rem;
      font-weight: 600;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${baseUrl}/logo.png" alt="TACIT STR" class="logo-img">
      <div>
        <span class="badge-tag"><span class="dot"></span> EDICIÓN TACIT RONIN</span>
      </div>
      <h1>TACIT STR</h1>
      <p class="subtitle">Streaming híbrido en Español Latino para Stremio: Catálogo en Nube, Proveedores Web y Torrents P2P.</p>
    </div>

    <!-- 1. BLOQUE: MODO DE FUNCIONAMIENTO -->
    <div class="section-block">
      <div class="section-block-header">
        <div class="section-block-title">🎯 Modo de Funcionamiento</div>
        <div class="section-block-desc">Define cómo interactúa el addon entre la biblioteca en la nube y las páginas web externas.</div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
        <button type="button" class="btn-preset" data-preset="cloud" id="presetCloud">☁️ Solo Nube</button>
        <button type="button" class="btn-preset active-preset" data-preset="balanced" id="presetBalanced">⚡ Equilibrado</button>
        <button type="button" class="btn-preset" data-preset="full" id="presetFull">🚀 Completo</button>
      </div>

      <div class="mode-explanation" id="modeDescBox">
        ⚡ <strong>Equilibrado (Recomendado):</strong> Primero busca en nuestra biblioteca en la nube; si el título está disponible, te lo entrega de inmediato en &lt;1 seg. Si no lo encuentra, activa como respaldo los sitios web seleccionados abajo.
      </div>
    </div>

    <!-- 2. BLOQUE: BIBLIOTECA CLOUD DIRECTA (SQLITE) -->
    <div class="section-block" id="cloudSectionBlock">
      <div class="section-block-header">
        <div class="section-block-title">☁️ Biblioteca Cloud Directa</div>
        <div class="section-block-desc">Más de 24,500 películas y 10,700 series alojadas en discos privados de alta velocidad con respuesta instantánea.</div>
      </div>

      <div class="slider-container">
        <div class="slider-header">
          <span class="slider-title">Enlaces de la Nube</span>
          <span class="slider-value" id="cloudLabel">10 enlaces</span>
        </div>
        <input type="range" id="cloudSlider" min="1" max="15" value="10">
        <p style="font-size: 0.76rem; color: var(--text-muted); margin-top: 8px;">Cantidad máxima de opciones de la nube directa que se mostrarán en Stremio.</p>
      </div>
    </div>

    <!-- 3. BLOQUE: PÁGINAS WEB DE RESPALDO (SELECCIÓN MATRIZ DE 2 COLUMNAS) -->
    <div class="section-block" id="webSectionBlock">
      <div class="section-block-header">
        <div class="section-block-title">🌐 Páginas Web de Respaldo</div>
        <div class="section-block-desc">Selecciona de forma independiente qué sitios raspar para <strong>🎬 Películas</strong> y cuáles para <strong>📺 Series</strong>.</div>
      </div>

      <!-- Presets de Sugerencia Rápida -->
      <div class="preset-pills-bar">
        <button type="button" class="btn-quick-preset active-quick" id="btnPresetRecommended">⭐ Recomendados</button>
        <button type="button" class="btn-quick-preset" id="btnPresetMoviesOnly">🎬 Solo Películas</button>
        <button type="button" class="btn-quick-preset" id="btnPresetSeriesOnly">📺 Solo Series</button>
        <button type="button" class="btn-quick-preset" id="btnPresetAll">🚀 Marcar Todo</button>
      </div>

      <div class="providers-table-card">
        <!-- CATEGORÍA 1: HÍBRIDOS (PELÍCULAS Y SERIES) -->
        <div class="category-separator">🌟 Híbridos (Películas y Series)</div>

        <!-- PelisPlus 4K (TioPlus) -->
        <div class="provider-row">
          <div class="provider-meta">
            <div class="provider-name-line">
              <span class="provider-title">PelisPlus 4K</span>
              <span class="tag-badge tag-recommended">⭐ Recomendado</span>
              <span class="tag-badge tag-fast">⚡ HLS 1080p</span>
            </div>
            <div class="provider-desc">Streams directos de alta fidelidad vía VidHide HLS. Ultra rápido y sin cortes.</div>
          </div>
          <div class="toggle-group">
            <button type="button" class="btn-toggle-type active" data-prov="pelisplus4k" data-type="movie">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              🎬 Pelis
            </button>
            <button type="button" class="btn-toggle-type active" data-prov="pelisplus4k" data-type="series">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              📺 Series
            </button>
          </div>
        </div>

        <!-- LaMovie -->
        <div class="provider-row">
          <div class="provider-meta">
            <div class="provider-name-line">
              <span class="provider-title">LaMovie</span>
              <span class="tag-badge tag-recommended">⭐ Recomendado</span>
            </div>
            <div class="provider-desc">Estrenos recientes y catálogo en audio Latino con servidores Vimeos y Goodstream.</div>
          </div>
          <div class="toggle-group">
            <button type="button" class="btn-toggle-type active" data-prov="lamovie" data-type="movie">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              🎬 Pelis
            </button>
            <button type="button" class="btn-toggle-type active" data-prov="lamovie" data-type="series">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              📺 Series
            </button>
          </div>
        </div>

        <!-- Cuevana -->
        <div class="provider-row">
          <div class="provider-meta">
            <div class="provider-name-line">
              <span class="provider-title">Cuevana</span>
              <span class="tag-badge tag-recommended">⭐ Recomendado</span>
            </div>
            <div class="provider-desc">La biblioteca web más extensa de internet. Excelente respaldo general.</div>
          </div>
          <div class="toggle-group">
            <button type="button" class="btn-toggle-type active" data-prov="cuevana" data-type="movie">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              🎬 Pelis
            </button>
            <button type="button" class="btn-toggle-type active" data-prov="cuevana" data-type="series">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              📺 Series
            </button>
          </div>
        </div>

        <!-- PelisPlus HD -->
        <div class="provider-row">
          <div class="provider-meta">
            <div class="provider-name-line">
              <span class="provider-title">PelisPlus HD</span>
            </div>
            <div class="provider-desc">Capítulos completos y estrenos con resolución criptográfica Embed69.</div>
          </div>
          <div class="toggle-group">
            <button type="button" class="btn-toggle-type active" data-prov="pelisplus" data-type="movie">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              🎬 Pelis
            </button>
            <button type="button" class="btn-toggle-type active" data-prov="pelisplus" data-type="series">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              📺 Series
            </button>
          </div>
        </div>

        <!-- CATEGORÍA 2: ESPECIALISTAS EN CINE -->
        <div class="category-separator">🎬 Especialistas en Cine</div>

        <!-- CineCalidad -->
        <div class="provider-row">
          <div class="provider-meta">
            <div class="provider-name-line">
              <span class="provider-title">CineCalidad</span>
              <span class="tag-badge tag-recommended">⭐ Recomendado</span>
            </div>
            <div class="provider-desc">El estándar de oro para películas en 1080p con audio Latino dual (Vimeos/VOE).</div>
          </div>
          <div class="toggle-group">
            <button type="button" class="btn-toggle-type active" data-prov="cinecalidad" data-type="movie">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              🎬 Pelis
            </button>
            <button type="button" class="btn-toggle-type na" title="No disponible para series">
              —
            </button>
          </div>
        </div>

        <!-- Hackstore Directo -->
        <div class="provider-row">
          <div class="provider-meta">
            <div class="provider-name-line">
              <span class="provider-title">Hackstore Directo</span>
            </div>
            <div class="provider-desc">Streaming directo m3u8 de películas en alta definición.</div>
          </div>
          <div class="toggle-group">
            <button type="button" class="btn-toggle-type active" data-prov="hackstore_direct" data-type="movie">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              🎬 Pelis
            </button>
            <button type="button" class="btn-toggle-type na" title="No disponible para series">
              —
            </button>
          </div>
        </div>

        <!-- CATEGORÍA 3: ESPECIALISTAS EN SERIES Y ANIMACIÓN -->
        <div class="category-separator">📺 Especialistas en Series y Animación</div>

        <!-- TioAnime -->
        <div class="provider-row">
          <div class="provider-meta">
            <div class="provider-name-line">
              <span class="provider-title">TioAnime</span>
              <span class="tag-badge tag-recommended">⭐ Anime</span>
            </div>
            <div class="provider-desc">Especialista líder en animación japonesa en audio Latino y subtitulado.</div>
          </div>
          <div class="toggle-group">
            <button type="button" class="btn-toggle-type na" title="Exclusivo de anime y series">
              —
            </button>
            <button type="button" class="btn-toggle-type active" data-prov="tioanime" data-type="series">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              📺 Series
            </button>
          </div>
        </div>

        <!-- LACartoons -->
        <div class="provider-row">
          <div class="provider-meta">
            <div class="provider-name-line">
              <span class="provider-title">LACartoons</span>
              <span class="tag-badge tag-retro">⭐ Retro / Cartoons</span>
            </div>
            <div class="provider-desc">Series animadas clásicas de Nickelodeon, Cartoon Network y Fox Kids en Latino.</div>
          </div>
          <div class="toggle-group">
            <button type="button" class="btn-toggle-type na" title="Exclusivo de series animadas">
              —
            </button>
            <button type="button" class="btn-toggle-type active" data-prov="lacartoons" data-type="series">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              📺 Series
            </button>
          </div>
        </div>

        <!-- Hackstore Torrents -->
        <div class="provider-row" id="rowHackstoreTorrent">
          <div class="provider-meta">
            <div class="provider-name-line">
              <span class="provider-title">Hackstore Torrents 🧲</span>
              <span class="tag-badge tag-fast">P2P 4K/1080p</span>
            </div>
            <div class="provider-desc">Enlaces magnet con más de 10 trackers UDP/WSS activos para máxima tasa de bits.</div>
          </div>
          <div class="toggle-group">
            <button type="button" class="btn-toggle-type active" data-prov="hackstore_torrent" data-type="movie">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              🎬 Pelis
            </button>
            <button type="button" class="btn-toggle-type active" data-prov="hackstore_torrent" data-type="series">
              <svg class="toggle-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              📺 Series
            </button>
          </div>
        </div>
      </div>

      <!-- Los 2 Sliders: Límite por sitio y Límite total web -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
        <div class="slider-container">
          <div class="slider-header">
            <span class="slider-title">Opciones por sitio</span>
            <span class="slider-value" id="webPerProvLabel">2 por sitio</span>
          </div>
          <input type="range" id="webPerProvSlider" min="1" max="5" value="2">
          <p style="font-size: 0.74rem; color: var(--text-muted); margin-top: 6px;">Tope de enlaces que aportará cada raspador individual.</p>
        </div>

        <div class="slider-container">
          <div class="slider-header">
            <span class="slider-title">Límite total web</span>
            <span class="slider-value" id="webTotalLabel">6 en total</span>
          </div>
          <input type="range" id="webTotalSlider" min="3" max="12" value="6">
          <p style="font-size: 0.74rem; color: var(--text-muted); margin-top: 6px;">Tope general combinado de streams web entregados a Stremio.</p>
        </div>
      </div>

      <!-- Prioridad Directo vs Torrents -->
      <div id="priorityContainer">
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

    <!-- 4. BLOQUE: CALIDAD DE VIDEO Y FILTROS -->
    <div class="section-block" id="qualitySectionBlock">
      <div class="section-block-header">
        <div class="section-block-title">🎬 Calidad de Video y Filtros</div>
        <div class="section-block-desc">Estas preferencias se aplican tanto a los enlaces de la nube como a las páginas web.</div>
      </div>

      <div class="options-grid" style="margin-bottom: 14px;">
        <div class="card-checkbox active" data-type="quality" data-val="4k">
          <div class="card-info">
            <span class="name">4K Ultra HD</span>
            <span class="desc">2160p HDR y Remux</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="quality" data-val="1080p">
          <div class="card-info">
            <span class="name">1080p Full HD</span>
            <span class="desc">Calidad recomendada estándar</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="quality" data-val="720p">
          <div class="card-info">
            <span class="name">720p HD</span>
            <span class="desc">Conexiones moderadas</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>

        <div class="card-checkbox active" data-type="quality" data-val="480p">
          <div class="card-info">
            <span class="name">480p SD</span>
            <span class="desc">Datos móviles o ahorro</span>
          </div>
          <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
      </div>

      <!-- Filtro exclusivo para desactivar torrents -->
      <div class="card-checkbox" data-type="disableTorrents" style="border-color: rgba(239, 68, 68, 0.25);">
        <div class="card-info">
          <span class="name" style="color: #fca5a5;">🚫 Desactivar Enlaces Torrent (Solo Streaming Directo HTTPS)</span>
          <span class="desc">Oculta todos los enlaces P2P. Ideal si estás en Smart TV o no utilizas VPN.</span>
        </div>
        <div class="custom-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
      </div>
    </div>

    <!-- BOTONES DE INSTALACIÓN -->
    <div style="margin-top: 14px;">
      <a href="#" id="installBtn" class="btn-install">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
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

    const DEFAULT_MOVIES = ['pelisplus4k', 'lamovie', 'cuevana', 'cinecalidad', 'pelisplus', 'hackstore_direct', 'hackstore_torrent'];
    const DEFAULT_SERIES = ['pelisplus4k', 'lamovie', 'cuevana', 'pelisplus', 'tioanime', 'lacartoons', 'hackstore_torrent'];

    const state = {
      mode: initialServerConfig?.mode || 'balanced',
      providers: {
        movie: Array.isArray(initialServerConfig?.providers?.movie) ? initialServerConfig.providers.movie : [...DEFAULT_MOVIES],
        series: Array.isArray(initialServerConfig?.providers?.series) ? initialServerConfig.providers.series : [...DEFAULT_SERIES]
      },
      qualities: initialServerConfig?.qualities || ['4k', '1080p', '720p', '480p'],
      priority: initialServerConfig?.priority || 'direct',
      disableTorrents: Boolean(initialServerConfig?.disableTorrents),
      maxCloudStreams: initialServerConfig?.maxCloudStreams || 10,
      maxWebStreamsPerProvider: initialServerConfig?.maxWebStreamsPerProvider || 2,
      maxTotalWebStreams: initialServerConfig?.maxTotalWebStreams || 6,
      minSeeders: 1
    };

    const MODE_DESCRIPTIONS = {
      cloud: '☁️ <strong>Solo Nube:</strong> Consulta únicamente nuestra biblioteca interna. Cero esperas, enlaces directos en menos de 1 segundo y sin depender de páginas web externas.',
      balanced: '⚡ <strong>Equilibrado (Recomendado):</strong> Lo mejor de ambos mundos. Primero busca en nuestra biblioteca en la nube; si el título está disponible, te lo entrega de inmediato en &lt;1 seg. Si no lo encuentra, activa como respaldo los sitios web seleccionados abajo.',
      full: '🚀 <strong>Catálogo Completo:</strong> Consulta nuestra biblioteca y las páginas web al mismo tiempo en paralelo, reuniendo la mayor cantidad posible de opciones.'
    };

    function syncUI() {
      const isCloud = (state.mode === 'cloud');
      const isBalanced = (state.mode === 'balanced');
      const isFull = (state.mode === 'full');

      // Botones de presets de modo
      document.getElementById('presetCloud').classList.toggle('active-preset', isCloud);
      document.getElementById('presetBalanced').classList.toggle('active-preset', isBalanced);
      document.getElementById('presetFull').classList.toggle('active-preset', isFull);

      // Texto explicativo dinámico según modo
      document.getElementById('modeDescBox').innerHTML = MODE_DESCRIPTIONS[state.mode] || MODE_DESCRIPTIONS.balanced;

      // Deshabilitar bloque web en modo Solo Nube
      const webBlock = document.getElementById('webSectionBlock');
      if (isCloud) {
        webBlock.classList.add('disabled-block');
      } else {
        webBlock.classList.remove('disabled-block');
      }

      // Prioridad y fila de torrents según disableTorrents
      document.getElementById('priorityContainer').style.display = (!state.disableTorrents && !isCloud) ? 'block' : 'none';
      const rowTorrent = document.getElementById('rowHackstoreTorrent');
      if (rowTorrent) {
        rowTorrent.style.display = state.disableTorrents ? 'none' : 'flex';
      }

      // Toggles de la matriz de proveedores (Películas / Series)
      document.querySelectorAll('.btn-toggle-type').forEach(btn => {
        const prov = btn.dataset.prov;
        const type = btn.dataset.type;
        if (!prov || !type) return;

        const isChecked = state.providers[type]?.includes(prov);
        btn.classList.toggle('active', Boolean(isChecked));
      });

      // Checkboxes individuales (calidad, prioridad, disableTorrents)
      document.querySelectorAll('.card-checkbox').forEach(card => {
        const type = card.dataset.type;
        const val = card.dataset.val;

        if (type === 'quality') {
          card.classList.toggle('active', state.qualities.includes(val));
        } else if (type === 'priority') {
          card.classList.toggle('active', state.priority === val);
        } else if (type === 'disableTorrents') {
          card.classList.toggle('active', Boolean(state.disableTorrents));
        }
      });

      // Sliders
      const cloudSlider = document.getElementById('cloudSlider');
      const cloudLabel = document.getElementById('cloudLabel');
      cloudSlider.value = state.maxCloudStreams;
      cloudLabel.textContent = state.maxCloudStreams + ' enlaces';

      const webPerProvSlider = document.getElementById('webPerProvSlider');
      const webPerProvLabel = document.getElementById('webPerProvLabel');
      webPerProvSlider.value = state.maxWebStreamsPerProvider;
      webPerProvLabel.textContent = state.maxWebStreamsPerProvider === 1 ? '1 por sitio' : state.maxWebStreamsPerProvider + ' por sitio';

      const webTotalSlider = document.getElementById('webTotalSlider');
      const webTotalLabel = document.getElementById('webTotalLabel');
      webTotalSlider.value = state.maxTotalWebStreams;
      webTotalLabel.textContent = state.maxTotalWebStreams + ' en total';

      updateUrls();
    }

    // Presets de Modo click
    document.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mode = btn.dataset.preset;
        syncUI();
      });
    });

    // Presets rápidos de proveedores
    document.getElementById('btnPresetRecommended').addEventListener('click', () => {
      state.providers.movie = ['pelisplus4k', 'lamovie', 'cuevana', 'cinecalidad', 'pelisplus', 'hackstore_direct'];
      state.providers.series = ['pelisplus4k', 'lamovie', 'cuevana', 'pelisplus', 'tioanime', 'lacartoons'];
      setActiveQuickPreset('btnPresetRecommended');
      syncUI();
    });

    document.getElementById('btnPresetMoviesOnly').addEventListener('click', () => {
      state.providers.movie = ['pelisplus4k', 'lamovie', 'cuevana', 'cinecalidad', 'pelisplus', 'hackstore_direct'];
      state.providers.series = [];
      setActiveQuickPreset('btnPresetMoviesOnly');
      syncUI();
    });

    document.getElementById('btnPresetSeriesOnly').addEventListener('click', () => {
      state.providers.movie = [];
      state.providers.series = ['pelisplus4k', 'lamovie', 'cuevana', 'pelisplus', 'tioanime', 'lacartoons'];
      setActiveQuickPreset('btnPresetSeriesOnly');
      syncUI();
    });

    document.getElementById('btnPresetAll').addEventListener('click', () => {
      state.providers.movie = [...DEFAULT_MOVIES];
      state.providers.series = [...DEFAULT_SERIES];
      setActiveQuickPreset('btnPresetAll');
      syncUI();
    });

    function setActiveQuickPreset(id) {
      document.querySelectorAll('.btn-quick-preset').forEach(b => b.classList.remove('active-quick'));
      const target = document.getElementById(id);
      if (target) target.classList.add('active-quick');
    }

    // Click en los botones de tipo (Películas / Series) de cada proveedor
    document.querySelectorAll('.btn-toggle-type').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('na')) return;
        const prov = btn.dataset.prov;
        const type = btn.dataset.type; // 'movie' | 'series'
        if (!prov || !type) return;

        const list = state.providers[type] || [];
        const index = list.indexOf(prov);

        if (index > -1) {
          list.splice(index, 1);
        } else {
          list.push(prov);
        }

        state.providers[type] = list;
        document.querySelectorAll('.btn-quick-preset').forEach(b => b.classList.remove('active-quick'));
        syncUI();
      });
    });

    // Checkboxes interaction (calidad, prioridad, disableTorrents)
    document.querySelectorAll('.card-checkbox').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.type;
        const val = card.dataset.val;

        if (type === 'priority') {
          document.querySelectorAll('[data-type="priority"]').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          state.priority = val;
        } else if (type === 'quality') {
          card.classList.toggle('active');
          if (card.classList.contains('active')) {
            if (!state.qualities.includes(val)) state.qualities.push(val);
          } else {
            state.qualities = state.qualities.filter(q => q !== val);
          }
          if (state.qualities.length === 0) {
            state.qualities = ['1080p'];
          }
        } else if (type === 'disableTorrents') {
          state.disableTorrents = !state.disableTorrents;
        }

        syncUI();
      });
    });

    // Sliders listeners
    document.getElementById('cloudSlider').addEventListener('input', (e) => {
      state.maxCloudStreams = parseInt(e.target.value, 10);
      document.getElementById('cloudLabel').textContent = state.maxCloudStreams + ' enlaces';
      updateUrls();
    });

    document.getElementById('webPerProvSlider').addEventListener('input', (e) => {
      state.maxWebStreamsPerProvider = parseInt(e.target.value, 10);
      document.getElementById('webPerProvLabel').textContent = state.maxWebStreamsPerProvider === 1 ? '1 por sitio' : state.maxWebStreamsPerProvider + ' por sitio';
      updateUrls();
    });

    document.getElementById('webTotalSlider').addEventListener('input', (e) => {
      state.maxTotalWebStreams = parseInt(e.target.value, 10);
      document.getElementById('webTotalLabel').textContent = state.maxTotalWebStreams + ' en total';
      updateUrls();
    });

    function getEncodedConfig() {
      return btoa(JSON.stringify(state));
    }

    function updateUrls() {
      const configB64 = getEncodedConfig();
      const manifestUrl = \`\${baseUrl}/\${configB64}/manifest.json\`;
      const stremioProtocolUrl = manifestUrl.replace(/^https?:\\/\\//, 'stremio://');

      document.getElementById('installBtn').setAttribute('href', stremioProtocolUrl);
      window.currentManifestUrl = manifestUrl;
    }

    // Copiar al portapapeles
    document.getElementById('copyBtn').addEventListener('click', () => {
      const configB64 = getEncodedConfig();
      const manifestUrl = \`\${baseUrl}/\${configB64}/manifest.json\`;
      navigator.clipboard.writeText(manifestUrl).then(() => {
        const toast = document.getElementById('toast');
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 2500);
      });
    });

    // Iniciar UI
    syncUI();
  </script>
</body>
</html>`;
}

module.exports = {
  renderConfigPage
};
