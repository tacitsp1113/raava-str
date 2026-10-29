/**
 * Sistema de Logs en Vivo con Buffer Circular en Memoria
 * Permite visualizar en tiempo real qué streams y proveedores responden
 */

const MAX_LOGS = 80;
const logsBuffer = [];

function addLog(type, tag, message, details = null) {
  const time = new Date().toLocaleTimeString('es-MX', { hour12: false });
  const entry = {
    id: Date.now() + Math.random(),
    time,
    type, // 'info' | 'success' | 'warn' | 'error'
    tag,  // 'CineCalidad' | 'SeriesFlix' | 'Stremio' | 'TACIT'
    message,
    details
  };

  logsBuffer.unshift(entry);
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.pop();
  }

  // Imprimir también en stdout para el panel de Render
  const prefix = `[${time}] [${tag}]`;
  if (type === 'error') {
    console.error(`${prefix} ❌ ${message}`, details || '');
  } else if (type === 'warn') {
    console.warn(`${prefix} ⚠️ ${message}`, details || '');
  } else {
    console.log(`${prefix} ${message}`, details ? JSON.stringify(details) : '');
  }
}

function getLogs() {
  return logsBuffer;
}

function clearLogs() {
  logsBuffer.length = 0;
}

function renderLogsHtml() {
  const logs = getLogs();
  const rows = logs.map(l => {
    let color = '#38bdf8';
    let icon = 'ℹ️';
    if (l.type === 'success') { color = '#34d399'; icon = '✅'; }
    else if (l.type === 'warn') { color = '#fbbf24'; icon = '⚠️'; }
    else if (l.type === 'error') { color = '#f87171'; icon = '❌'; }

    return `
      <div style="padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; gap: 12px; align-items: flex-start; font-size: 0.86rem;">
        <span style="color: #64748b; font-family: monospace; font-size: 0.78rem; min-width: 65px;">${l.time}</span>
        <span style="color: ${color}; font-weight: 700; min-width: 110px; font-size: 0.8rem; background: rgba(255,255,255,0.03); padding: 2px 6px; border-radius: 4px; text-align: center;">${icon} ${l.tag}</span>
        <div style="flex: 1; word-break: break-word;">
          <div style="color: #f1f5f9;">${l.message}</div>
          ${l.details ? `<pre style="font-family: monospace; font-size: 0.76rem; color: #94a3b8; margin-top: 4px; background: rgba(0,0,0,0.3); padding: 6px; border-radius: 6px; overflow-x: auto;">${typeof l.details === 'object' ? JSON.stringify(l.details, null, 2) : l.details}</pre>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TACIT STR - Monitor de Logs en Vivo</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body { background: #0b0f17; color: #f1f5f9; min-height: 100vh; padding: 24px 16px; display: flex; flex-direction: column; align-items: center; }
    .container { max-width: 900px; width: 100%; background: rgba(16, 22, 34, 0.95); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; box-shadow: 0 25px 50px rgba(0,0,0,0.6); overflow: hidden; }
    .header { padding: 20px 24px; background: rgba(14, 165, 233, 0.08); border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 1.25rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
    .badge { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #34d399; background: rgba(16, 185, 129, 0.12); padding: 3px 8px; border-radius: 6px; }
    .controls { display: flex; gap: 8px; }
    .btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; cursor: pointer; text-decoration: none; }
    .btn:hover { background: rgba(255,255,255,0.12); }
    .logs-box { max-height: 75vh; overflow-y: auto; }
    .empty { padding: 40px; text-align: center; color: #64748b; font-size: 0.9rem; }
  </style>
  <script>
    // Auto refrescar cada 3.5 segundos para ver peticiones en vivo
    setInterval(() => {
      fetch('/api/logs')
        .then(res => res.json())
        .then(data => {
          const countEl = document.getElementById('logCount');
          if (countEl) countEl.textContent = data.length + ' eventos';
          // Si cambia la cantidad de logs, recarga suavemente
          if (window.lastCount !== undefined && window.lastCount !== data.length) {
            window.location.reload();
          }
          window.lastCount = data.length;
        }).catch(() => {});
    }, 3500);
  </script>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="title">📡 Monitor de Peticiones y Logs en Vivo</div>
        <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 3px;">Monitoreando activamente <strong>SeriesFlix</strong> y <strong>CineCalidad</strong></p>
      </div>
      <div class="controls">
        <span class="badge" id="logCount">${logs.length} eventos</span>
        <a href="/logs" class="btn">🔄 Refrescar</a>
        <a href="/configure" class="btn">⚙️ Configurar</a>
      </div>
    </div>
    <div class="logs-box">
      ${rows.length > 0 ? rows : '<div class="empty">Esperando peticiones desde Stremio... Abre una película o serie para ver los logs en tiempo real.</div>'}
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  addLog,
  getLogs,
  clearLogs,
  renderLogsHtml
};
