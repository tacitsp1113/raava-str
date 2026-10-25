const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const BASE_URL = 'https://victory-incl-elephant-diesel.trycloudflare.com';
const CONCURRENCY = 15;
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'catalog.sqlite');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Configuración de rendimiento de SQLite
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE IF NOT EXISTS queue (
    source TEXT,
    kind TEXT,
    row INTEGER,
    id INTEGER,
    name TEXT,
    release_date TEXT,
    image_path TEXT,
    vote REAL,
    genres TEXT,
    done INTEGER DEFAULT 0,
    PRIMARY KEY (source, kind, row)
  );

  CREATE TABLE IF NOT EXISTS movies (
    tmdb_id INTEGER PRIMARY KEY,
    title TEXT,
    year TEXT,
    poster TEXT,
    vote REAL,
    genres TEXT,
    files_json TEXT
  );

  CREATE TABLE IF NOT EXISTS series (
    tmdb_id INTEGER PRIMARY KEY,
    title TEXT,
    year TEXT,
    poster TEXT,
    vote REAL,
    genres TEXT,
    seasons_json TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_queue_done ON queue (done);
`);

async function fetchJson(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries) return null;
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  return null;
}

// Paso 1: Obtener la lista completa de títulos y llenar la cola
async function populateQueue() {
  const rowCount = db.prepare('SELECT COUNT(*) as count FROM queue').get().count;
  if (rowCount > 0) {
    console.log(`[Cola lista] Ya existen ${rowCount.toLocaleString()} títulos en la cola.`);
    return;
  }

  console.log('[1/2] Obteniendo lista de títulos de CATALOG//NET...');
  let page = 1;
  const limit = 200;
  let total = 0;
  let totalFetched = 0;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO queue (source, kind, row, id, name, release_date, image_path, vote, genres)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  while (true) {
    const data = await fetchJson(`${BASE_URL}/api/titles?page=${page}&limit=${limit}`);
    if (!data || !data.items || data.items.length === 0) break;
    total = data.total;

    db.exec('BEGIN TRANSACTION');
    for (const item of data.items) {
      insertStmt.run(
        item.source,
        item.kind,
        item.row,
        item.id,
        item.name,
        item.release_date || null,
        item.image_path || null,
        item.vote || null,
        item.genres ? String(item.genres) : null
      );
    }
    db.exec('COMMIT');

    totalFetched += data.items.length;
    process.stdout.write(`\rCargando lista de títulos: ${totalFetched.toLocaleString()} / ${total.toLocaleString()}`);
    if (totalFetched >= total) break;
    page++;
  }
  console.log('\n[✓] Lista de títulos cargada exitosamente.');
}

// Paso 2: Procesar cada título y guardar sus enlaces
async function processQueue() {
  console.log('[2/2] Descargando enlaces de video y episodios...');

  const countTotal = db.prepare('SELECT COUNT(*) as total FROM queue').get().total;
  let countDone = db.prepare('SELECT COUNT(*) as done FROM queue WHERE done = 1').get().done;

  console.log(`Progreso inicial: ${countDone.toLocaleString()} / ${countTotal.toLocaleString()} completados.`);

  const insertMovie = db.prepare(`
    INSERT OR REPLACE INTO movies (tmdb_id, title, year, poster, vote, genres, files_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSeries = db.prepare(`
    INSERT OR REPLACE INTO series (tmdb_id, title, year, poster, vote, genres, seasons_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const markDone = db.prepare(`UPDATE queue SET done = 1 WHERE source = ? AND kind = ? AND row = ?`);

  const getPending = db.prepare(`
    SELECT source, kind, row, id, name, release_date, image_path, vote, genres
    FROM queue WHERE done = 0 LIMIT 500
  `);

  const startTime = Date.now();
  let lastReport = Date.now();
  let processedInSession = 0;

  while (true) {
    const pending = getPending.all();
    if (!pending || pending.length === 0) break;

    // Procesar en lotes con concurrencia
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const chunk = pending.slice(i, i + CONCURRENCY);

      await Promise.all(chunk.map(async (item) => {
        try {
          if (item.kind === 'movie') {
            const detail = await fetchJson(`${BASE_URL}/api/titles/${encodeURIComponent(item.source)}/${item.kind}/${item.row}`);
            if (detail && detail.files) {
              const cleanFiles = detail.files
                .filter(f => f.plain)
                .map(f => ({
                  quality: f.quality || 'HD',
                  size: f.size || null,
                  url: f.plain
                }));

              if (cleanFiles.length > 0) {
                insertMovie.run(
                  item.id,
                  item.name,
                  item.release_date ? item.release_date.slice(0, 4) : null,
                  item.image_path || null,
                  item.vote || null,
                  item.genres || null,
                  JSON.stringify(cleanFiles)
                );
              }
            }
          } else if (item.kind === 'series') {
            const epData = await fetchJson(`${BASE_URL}/api/series/${item.id}/episodes`);
            if (epData && epData.seasons && epData.seasons.length > 0) {
              const cleanSeasons = epData.seasons.map(s => ({
                name: s.name,
                eps: (s.eps || []).filter(e => e.plain).map(e => ({
                  season: e.season,
                  idx: e.idx,
                  file: e.file,
                  size: e.size,
                  url: e.plain
                }))
              })).filter(s => s.eps.length > 0);

              if (cleanSeasons.length > 0) {
                insertSeries.run(
                  item.id,
                  item.name,
                  item.release_date ? item.release_date.slice(0, 4) : null,
                  item.image_path || null,
                  item.vote || null,
                  item.genres || null,
                  JSON.stringify(cleanSeasons)
                );
              }
            }
          }
        } catch (e) {
          // Si falla uno individual no rompemos el proceso
        } finally {
          markDone.run(item.source, item.kind, item.row);
          countDone++;
          processedInSession++;
        }
      }));

      // Reporte de velocidad cada 3 segundos
      const now = Date.now();
      if (now - lastReport > 3000) {
        const elapsedSec = (now - startTime) / 1000;
        const speed = (processedInSession / elapsedSec).toFixed(1);
        const remaining = countTotal - countDone;
        const etaMin = speed > 0 ? (remaining / speed / 60).toFixed(1) : '?';
        const percent = ((countDone / countTotal) * 100).toFixed(1);

        process.stdout.write(
          `\r[${countDone.toLocaleString()} / ${countTotal.toLocaleString()} (${percent}%)] ` +
          `Velocidad: ~${speed} items/s | ETA: ~${etaMin} min`
        );
        lastReport = now;
      }
    }
  }

  console.log(`\n[✓] ¡Descarga completa! Base de datos lista en: ${DB_PATH}`);
}

async function main() {
  try {
    await populateQueue();
    await processQueue();
  } catch (err) {
    console.error('Error durante la descarga:', err);
  }
}

main();
