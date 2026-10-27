const express = require('express');
const path = require('path');
const { getRouter } = require('stremio-addon-sdk');
const { addonInterface, manifest, resolveStreams, parseConfig, DEFAULT_CONFIG } = require('./addon');
const { renderConfigPage } = require('./views/configure');

const app = express();
const PORT = process.env.PORT || 7000;

// Logo estático
app.get('/logo.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'logo.png'));
});

// Router estándar del SDK de Stremio
const defaultRouter = getRouter(addonInterface);
app.use(defaultRouter);

// --- ENDPOINTS CONFIGURABLES DE STREMIO ---

// Endpoint de Manifiesto Configurado: /:configuration/manifest.json
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
    : `Nube: ${config.maxCloudStreams || 10} | Web: máx ${config.maxTotalWebStreams || 6}`;

  const customManifest = {
    ...manifest,
    name: 'TACIT STR',
    description: `${modeBadge} ${modeName} (${modeDesc}) · ${torrentInfo} · [${qInfo}] · ${streamInfo}`
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

// --- API REST COMPATIBLE CON CLOUDSTREAM / MOVIEPLUS ---
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
app.get('/status', handleStatusPage);

app.get('/api/debug-render', async (req, res) => {
  const { getMediaDetails } = require('./services/tmdb');
  const axios = require('axios');
  const cheerio = require('cheerio');
  const report = {};

  try {
    report.media = await getMediaDetails('series', 'tt0944947');
    
    // Test base search
    const base = 'https://seriesflixhd.pw';
    const searchUrl = `${base}/?s=${encodeURIComponent(report.media.title)}`;
    report.searchUrl = searchUrl;

    const sRes = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 8000
    });
    report.searchStatus = sRes.status;
    report.searchHtmlLen = (sRes.data || '').length;
    report.searchTitleTag = (sRes.data.match(/<title>([^<]+)<\/title>/i) || [])[1];

    const $ = cheerio.load(sRes.data);
    const articles = [];
    $('article').each((_, el) => {
      const a = $(el).find('h2.Title a, a').first();
      articles.push({ title: $(el).find('h2.Title, .title').text().trim(), href: a.attr('href') });
    });
    report.articlesFound = articles;

    // Test direct episode
    const epUrl = `${base}/episodio/juego-de-tronos-zkpc-1x1/`;
    report.epUrl = epUrl;
    const epRes = await axios.get(epUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 8000
    });
    report.epStatus = epRes.status;
    report.epHtmlLen = (epRes.data || '').length;
    report.epTitleTag = (epRes.data.match(/<title>([^<]+)<\/title>/i) || [])[1];

    const $ep = cheerio.load(epRes.data);
    const buttons = [];
    $ep('div[data-url], [data-url]').each((_, el) => {
      buttons.push({ label: $ep(el).text().trim(), dataUrl: $ep(el).attr('data-url') });
    });
    report.buttonsCount = buttons.length;
    report.buttons = buttons;

    // Probar extractores individuales directamente
    const { resolveVoe } = require('./services/extractors/voe');
    const { resolveNupload } = require('./services/extractors/nupload');
    const { isStreamAlive } = require('./services/extractors/validator');

    report.extractorTests = [];
    const testUrls = [
      'https://voe.sx/e/iaiwgnewdw1f',
      'https://nupload.my/watch/NmnyXVKIw5rloMQMFfgh3BZJlqJ7kz7HiykDsalSwIc8'
    ];

    for (const u of testUrls) {
      const item = { url: u };
      try {
        if (u.includes('voe.sx')) {
          item.resolved = await resolveVoe(u);
        } else if (u.includes('nupload.my')) {
          item.resolved = await resolveNupload(u);
        }
        if (item.resolved?.url) {
          item.alive = await isStreamAlive(item.resolved.url, item.resolved.headers || {}, 1500);
        }
      } catch (e) {
        item.error = e.message;
      }
      report.extractorTests.push(item);
    }

    // Call full getSeriesFlixStreams
    const { getSeriesFlixStreams } = require('./services/providers/seriesflix');
    report.streams = await getSeriesFlixStreams(report.media, '1', '1', { maxWebStreamsPerProvider: 2 });

    res.json({ success: true, report });
  } catch (err) {
    res.json({ success: false, error: err.message, stack: err.stack, report });
  }
});

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`[TACIT STR] Servidor corriendo en el puerto ${PORT}`);
  console.log(`[TACIT STR] URL de Configuración: http://localhost:${PORT}/configure`);
  console.log(`[TACIT STR] URL del Manifiesto: http://localhost:${PORT}/manifest.json`);
});
