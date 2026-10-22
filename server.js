const express = require('express');
const { getRouter } = require('stremio-addon-sdk');
const addonInterface = require('./addon');

const app = express();
const PORT = process.env.PORT || 7000;

// Mount Stremio addon router (handles /manifest.json, /stream/:type/:id.json, etc.)
const addonRouter = getRouter(addonInterface);
app.use(addonRouter);

// Landing & Installation Page
app.get('/', (req, res) => {
  const host = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const manifestUrl = `${protocol}://${host}/manifest.json`;
  const stremioInstallUrl = manifestUrl.replace(/^https?:\/\//, 'stremio://');

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RAAVA Streams - Stremio Addon</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Outfit', sans-serif;
    }
    body {
      background: radial-gradient(circle at 50% 20%, #1a1635 0%, #0c0b14 70%, #06050a 100%);
      color: #f1f1f5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow-x: hidden;
    }
    .container {
      max-width: 680px;
      width: 100%;
      background: rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 28px;
      padding: 48px 36px;
      text-align: center;
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      position: relative;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(124, 58, 237, 0.2);
      border: 1px solid rgba(139, 92, 246, 0.4);
      color: #c4b5fd;
      padding: 6px 16px;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 24px;
      letter-spacing: 0.5px;
    }
    .dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 10px #10b981;
    }
    h1 {
      font-size: 2.8rem;
      font-weight: 800;
      background: linear-gradient(135deg, #ffffff 30%, #a78bfa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }
    p.subtitle {
      color: #94a3b8;
      font-size: 1.15rem;
      line-height: 1.6;
      margin-bottom: 36px;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 40px;
      text-align: left;
    }
    .card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 18px 20px;
      transition: all 0.2s ease;
    }
    .card:hover {
      border-color: rgba(139, 92, 246, 0.4);
      background: rgba(139, 92, 246, 0.05);
      transform: translateY(-2px);
    }
    .card .icon {
      font-size: 1.5rem;
      margin-bottom: 8px;
    }
    .card .title {
      font-weight: 700;
      color: #e2e8f0;
      font-size: 0.95rem;
      margin-bottom: 4px;
    }
    .card .desc {
      color: #64748b;
      font-size: 0.8rem;
      line-height: 1.4;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 14px;
      align-items: center;
    }
    .btn-install {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 1.15rem;
      padding: 16px 36px;
      border-radius: 16px;
      width: 100%;
      max-width: 360px;
      box-shadow: 0 12px 30px rgba(124, 58, 237, 0.4);
      transition: all 0.3s ease;
      border: none;
      cursor: pointer;
    }
    .btn-install:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 40px rgba(124, 58, 237, 0.6);
      filter: brightness(1.1);
    }
    .btn-copy {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #cbd5e1;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-copy:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }
    .manifest-box {
      margin-top: 24px;
      font-size: 0.8rem;
      color: #64748b;
      word-break: break-all;
    }
    footer {
      margin-top: 32px;
      color: #475569;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">
      <div class="dot"></div>
      SERVIDOR EN LÍNEA
    </div>
    <h1>RAAVA STR</h1>
    <p class="subtitle">Media Stream Provider. Alta definición y perfiles de vídeo adaptables.</p>

    <div class="features">
      <div class="card">
        <div class="icon">✨</div>
        <div class="title">4K & 1080p</div>
        <div class="desc">Múltiples calidades y perfiles de vídeo adaptados a tu conexión.</div>
      </div>
      <div class="card">
        <div class="icon">🔊</div>
        <div class="title">Audio Multi-Canal</div>
        <div class="desc">Pistas de audio en alta fidelidad y soporte para subtítulos.</div>
      </div>
      <div class="card">
        <div class="icon">⚡</div>
        <div class="title">Conexión Directa</div>
        <div class="desc">Distribución eficiente punto a punto en tiempo real.</div>
      </div>
      <div class="card">
        <div class="icon">💎</div>
        <div class="title">Sin Intermediarios</div>
        <div class="desc">Acceso libre y optimizado sin requerir servicios adicionales.</div>
      </div>
    </div>

    <div class="actions">
      <a href="${stremioInstallUrl}" class="btn-install">
        🚀 Instalar en Stremio
      </a>
      <button class="btn-copy" onclick="copyManifest()">📋 Copiar Enlace para Stremio</button>
    </div>

    <div class="manifest-box">
      <strong>URL para pegar en Stremio:</strong><br>
      <span id="manUrl" style="color: #a78bfa; font-weight: 600;">http://127.0.0.1:${PORT}/manifest.json</span>
      <p style="margin-top: 8px; color: #94a3b8; font-size: 0.8rem;">
        💡 <em>Nota para PC:</em> Pega la URL de arriba directamente en la barra <strong>"Buscar complementos"</strong> de Stremio (esquina superior derecha).
      </p>
    </div>
  </div>

  <footer>
    RAAVA STR
  </footer>

  <script>
    function copyManifest() {
      const url = document.getElementById('manUrl').innerText;
      navigator.clipboard.writeText(url).then(() => {
        alert('¡Enlace copiado al portapapeles! Pégalo en el buscador de Addons de Stremio.');
      });
    }
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 RAAVA Stremio Addon activo en puerto ${PORT}`);
  console.log(`📡 Manifiesto: http://localhost:${PORT}/manifest.json`);
  console.log(`🖥️  Landing page: http://localhost:${PORT}/`);
  console.log(`===============================================`);
});
