const express = require('express');
const path = require('path');
const { getRouter } = require('stremio-addon-sdk');
const { addonInterface, manifest, resolveStreams, parseConfig, DEFAULT_CONFIG } = require('./addon');
const { renderConfigPage } = require('./views/configure');
const { saveStoredConfig, getConfig } = require('./services/config_store');

const app = express();
const PORT = process.env.PORT || 7000;

app.use(express.json());

// Logo estático
app.get('/logo.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'logo.png'));
});

// API de sincronización en vivo (para actualizar configuración sin reinstalar)
app.post('/api/config', (req, res) => {
  const ok = saveStoredConfig(req.body);
  res.json({ ok, config: getConfig() });
});

app.get('/api/config', (req, res) => {
  res.json(getConfig());
});

// --- ENDPOINTS CONFIGURABLES DE STREMIO ---

// Endpoint de Manifiesto Configurado: /:configuration/manifest.json
app.get('/:configuration/manifest.json', (req, res) => {
  const config = parseConfig(req.params.configuration);

  const torrentInfo = config.disableTorrents ? '🚫 Sin Torrents' : '🧲 Torrents Activos';
  const qInfo = (config.qualities || ['1080p']).map(q => q.toUpperCase()).join(' · ');
  const streamInfo = `Web: máx ${config.maxTotalWebStreams || 8}`;

  const customManifest = {
    ...manifest,
    name: 'TACIT STR',
    description: `⚡ Raspadores Web · ${torrentInfo} · [${qInfo}] · ${streamInfo}`
  };
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(customManifest);
});

// Endpoint de Streams Configurado: /:configuration/stream/:type/:id.json
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

// Router estándar del SDK de Stremio (para llamadas directas sin configuracion)
const defaultRouter = getRouter(addonInterface);
app.use(defaultRouter);

// --- PÁGINA INTERACTIVA DE CONFIGURACIÓN E INSTALACIÓN ---
function handleConfigPage(req, res) {
  const host = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${host}`;
  const initialConfig = req.params && req.params.configuration ? parseConfig(req.params.configuration) : null;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderConfigPage(initialConfig, baseUrl));
}

app.get('/', handleConfigPage);
app.get('/configure', handleConfigPage);
app.get('/:configuration/configure', handleConfigPage);

// --- DIAGNÓSTICO Y ESTADO DE PROVEEDORES ---
const { handleStatusPage } = require('./services/health');
const { renderLogsHtml, getLogs } = require('./services/logger');
app.get('/status', handleStatusPage);

// --- MONITOR DE LOGS EN VIVO ---
app.get('/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderLogsHtml());
});
app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(getLogs());
});
app.get('/debug/test-voe', async (req, res) => {
  const { resolveVoe } = require('./services/extractors/voe');
  const testUrl = req.query.url || 'https://voe.sx/e/v8fb10gqo1f3';
  const result = await resolveVoe(testUrl);
  res.json({ testUrl, result, recentLogs: getLogs().slice(0, 8) });
});



// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`[TACIT STR] Servidor corriendo en el puerto ${PORT}`);
  console.log(`[TACIT STR] URL de Configuración: http://localhost:${PORT}/configure`);
  console.log(`[TACIT STR] URL del Manifiesto: http://localhost:${PORT}/manifest.json`);
});
