/**
 * Panel interactivo de configuración de TACIT STR
 * Arquitectura sin estado (Stateless): la configuración se codifica directamente en el manifiesto de Stremio.
 */

function renderConfigPage(initialConfig = null, baseUrl = '') {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
<title>Mi panel — TACIT STR</title>
<link rel="icon" href="/logo.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --cian: #00d2ff; --cian-hover: #38bdf8; --cian-suave: rgba(0,210,255,0.16); --cian-borde: rgba(0,210,255,0.45);
    --fondo: #050811; --capa: #09101f; --tarjeta: #0e172e; --borde: #162444; --borde-fuerte: #243b6b;
    --texto: #f8fafc; --suave: #94a3b8; --tenue: #64748b; --verde: #10b981; --amarillo: #fbbf24;
  }
  body { font-family: 'Inter', sans-serif; background: var(--fondo); color: var(--texto); min-height: 100vh; }
  body::before { content: ''; position: fixed; inset: 0; background: radial-gradient(circle at 85% -10%, rgba(0,210,255,0.22), transparent 45%), radial-gradient(circle at -10% 110%, rgba(14,165,233,0.14), transparent 40%); pointer-events: none; z-index: 0; }
  a { color: inherit; text-decoration: none; }
  button { font-family: inherit; }
  .app { position: relative; display: grid; grid-template-columns: 270px 1fr; gap: 18px; padding: 18px; min-height: 100vh; }
  aside { background: rgba(9,16,31,0.96); border: 1.5px solid var(--borde); border-radius: 24px; display: flex; flex-direction: column; position: sticky; top: 18px; height: calc(100vh - 36px); overflow-y: auto; padding: 18px 14px 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); }
  .marca { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 4px 0 14px; border-bottom: 1px solid var(--borde); margin-bottom: 14px; }
  .marca img { width: 50px; height: 50px; border-radius: 16px; box-shadow: 0 0 35px rgba(0,210,255,0.45); object-fit: cover; }
  .marca b { font-size: 19px; font-weight: 900; color: var(--cian); letter-spacing: -0.5px; text-shadow: 0 0 20px rgba(0,210,255,0.4); }
  .seccion-menu { color: var(--tenue); font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 12px 12px 6px; }
  .item { display: flex; align-items: center; gap: 12px; width: 100%; background: none; border: none; color: var(--suave); padding: 9px 12px; border-radius: 14px; font-size: 14px; font-weight: 600; cursor: pointer; text-align: left; transition: background .15s, color .15s; margin-bottom: 3px; }
  .item .ico { width: 34px; height: 34px; border-radius: 11px; background: #111e3b; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background .15s; }
  .item svg { width: 17px; height: 17px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .item:hover { color: var(--texto); background: #162444; }
  .item.activo { color: #fff; background: linear-gradient(90deg, rgba(0,210,255,0.25), rgba(0,210,255,0.05)); }
  .item.activo .ico { background: var(--cian); box-shadow: 0 0 20px rgba(0,210,255,0.6); color: #000; }
  .item .num { margin-left: auto; font-size: 12px; color: var(--tenue); font-weight: 700; }
  .pie-menu { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--borde); font-size: 12px; color: var(--tenue); text-align: center; }
  .pie-menu b { color: var(--cian); font-size: 13px; display: block; margin-bottom: 2px; }
  main { min-width: 0; }
  .movil { display: none; align-items: center; justify-content: space-between; padding: 6px 4px 14px; }
  .movil .logo { display: flex; align-items: center; gap: 10px; font-weight: 900; color: var(--cian); font-size: 18px; }
  .movil .logo img { width: 32px; height: 32px; border-radius: 9px; object-fit: cover; }
  .icono-btn { width: 42px; height: 42px; border-radius: 14px; border: 1px solid var(--borde); background: var(--capa); color: var(--texto); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
  .icono-btn svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; }
  .contenido { max-width: 940px; padding: 10px 14px 120px; }
  .vista { display: none; animation: aparecer .25s ease; }
  .vista.activa { display: block; }
  @keyframes aparecer { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .encabezado { margin: 6px 0 20px; }
  .encabezado h1 { font-size: 28px; font-weight: 900; letter-spacing: -0.8px; color: #f8fafc; }
  .encabezado p { color: var(--suave); font-size: 15px; margin-top: 4px; }
  .bienvenida { position: relative; overflow: hidden; border-radius: 26px; padding: 30px; border: 1.5px solid var(--cian-borde); background: linear-gradient(135deg, #071f3a 0%, #0a1424 45%, #050811 100%); margin-bottom: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
  .bienvenida small { color: #38bdf8; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; }
  .bienvenida h2 { font-size: clamp(24px, 4vw, 34px); font-weight: 900; letter-spacing: -1px; margin: 6px 0 8px; color: #ffffff; }
  .bienvenida p { color: #cbd5e1; max-width: 520px; line-height: 1.6; font-size: 15px; }
  .acciones { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px; position: relative; z-index: 1; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; border: none; border-radius: 16px; font-weight: 800; cursor: pointer; transition: background .15s, border-color .15s, transform .15s; font-size: 15px; padding: 14px 22px; }
  .btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .btn-rojo { background: var(--cian); color: #040914; box-shadow: 0 8px 25px rgba(0,210,255,0.4); font-weight: 900; }
  .btn-rojo:hover { background: #38bdf8; transform: translateY(-1px); box-shadow: 0 10px 30px rgba(0,210,255,0.6); }
  .btn-claro { background: rgba(255,255,255,0.06); color: #fff; border: 1px solid rgba(255,255,255,0.14); }
  .btn-claro:hover { border-color: var(--cian-borde); background: rgba(0,210,255,0.12); }
  .chips { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
  .chip { display: inline-flex; align-items: center; gap: 8px; background: var(--capa); border: 1px solid var(--borde); padding: 10px 16px; border-radius: 999px; font-size: 14px; color: var(--suave); cursor: pointer; transition: border-color .15s; }
  .chip:hover { border-color: var(--cian-borde); }
  .chip b { color: #fff; }
  .chip i { width: 8px; height: 8px; border-radius: 50%; background: var(--cian); display: inline-block; box-shadow: 0 0 10px #00d2ff; }
  .tarjeta { background: rgba(14,23,46,0.95); border: 1.5px solid var(--borde); border-radius: 22px; padding: 22px; margin-bottom: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
  .tarjeta h3 { font-size: 16px; font-weight: 800; margin-bottom: 6px; color: #f8fafc; }
  .tarjeta > p { color: var(--suave); font-size: 14px; line-height: 1.6; }
  .rejilla2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .rejilla2 .tarjeta { margin-bottom: 0; }
  .mini { display: flex; gap: 14px; align-items: flex-start; }
  .mini p { color: var(--suave); font-size: 14px; line-height: 1.55; margin: 4px 0 12px; }
  .enlace { color: #38bdf8; font-weight: 700; font-size: 14px; cursor: pointer; background: none; border: none; padding: 0; }
  .enlace:hover { color: #7dd3fc; text-decoration: underline; }
  .aviso { display: flex; gap: 12px; align-items: flex-start; background: rgba(0,210,255,0.08); border: 1px solid rgba(0,210,255,0.3); color: #bae6fd; border-radius: 18px; padding: 16px 18px; font-size: 14px; line-height: 1.6; margin-bottom: 18px; }
  .aviso b { color: #fff; }
  .grupo-prov { margin-bottom: 26px; }
  .grupo-prov header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
  .grupo-prov h3 { font-size: 17px; font-weight: 800; color: #f8fafc; }
  .grupo-prov h3 small { color: var(--tenue); font-size: 13px; font-weight: 500; margin-left: 8px; }
  .botones-grupo { display: flex; gap: 6px; }
  .pastilla { background: var(--capa); border: 1px solid var(--borde); color: var(--suave); font-size: 12px; font-weight: 700; cursor: pointer; padding: 6px 12px; border-radius: 999px; transition: all .15s; }
  .pastilla:hover { color: #fff; border-color: var(--cian-borde); }
  .opciones { display: flex; flex-wrap: wrap; gap: 10px; }
  .opcion { display: inline-flex; align-items: center; gap: 10px; background: var(--capa); border: 1.5px solid var(--borde); border-radius: 999px; padding: 9px 16px 9px 10px; cursor: pointer; user-select: none; transition: all .15s; font-size: 14px; font-weight: 600; color: var(--suave); }
  .opcion .marca-op { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #243b6b; display: flex; align-items: center; justify-content: center; transition: all .15s; flex-shrink: 0; }
  .opcion .marca-op svg { width: 12px; height: 12px; stroke: #fff; fill: none; stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; opacity: 0; }
  .opcion small { color: var(--tenue); font-weight: 500; font-size: 12px; }
  .opcion:hover { border-color: #3b5a99; color: #fff; }
  .opcion.on { border-color: var(--cian-borde); background: var(--cian-suave); color: #fff; }
  .opcion.on .marca-op { background: var(--cian); border-color: var(--cian); }
  .opcion.on .marca-op svg { opacity: 1; stroke: #040914; }
  .opcion.grande { border-radius: 18px; padding: 14px 18px 14px 14px; flex: 1 1 200px; }
  .opcion.grande div b { display: block; color: inherit; }
  .badge-top { font-size: 10px; font-weight: 800; background: rgba(0, 210, 255, 0.18); border: 1px solid var(--cian); color: #38bdf8; padding: 2px 7px; border-radius: 999px; margin-left: 6px; letter-spacing: 0.04em; display: inline-flex; align-items: center; vertical-align: middle; }
  .caja-url { display: flex; gap: 10px; align-items: center; background: #040813; border: 1px solid var(--borde); border-radius: 16px; padding: 8px 8px 8px 16px; margin-top: 14px; }
  .caja-url code { flex: 1; color: #7dd3fc; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .caja-url .btn { padding: 10px 16px; font-size: 14px; border-radius: 12px; }
  .pasos { counter-reset: paso; list-style: none; margin-top: 14px; }
  .pasos li { counter-increment: paso; position: relative; padding: 0 0 14px 42px; color: var(--suave); font-size: 14px; line-height: 1.55; }
  .pasos li::before { content: counter(paso); position: absolute; left: 0; top: -2px; width: 28px; height: 28px; border-radius: 50%; background: var(--cian-suave); color: #38bdf8; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 13px; }
  .pasos b { color: #fff; }
  .toast { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%) translateY(120px); background: #0e172e; border: 1px solid var(--cian-borde); color: #f8fafc; padding: 12px 24px; border-radius: 999px; font-size: 14px; font-weight: 600; transition: transform .25s, opacity .25s; z-index: 200; opacity: 0; pointer-events: none; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
  .toast.ver { transform: translateX(-50%) translateY(0); opacity: 1; }

  .cortina { display: none; }
  @media (max-width: 900px) {
    .app { grid-template-columns: 1fr; padding: 12px; }
    aside { position: fixed; left: 10px; top: 10px; bottom: 10px; height: auto; width: 278px; padding-bottom: 18px; background: #09101f; z-index: 60; transform: translateX(-120%); transition: transform .25s; }
    aside.abierto { transform: translateX(0); }
    .cortina.ver { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 55; }
    .movil { display: flex; }
    .contenido { padding: 0 2px 120px; }
    .rejilla2 { grid-template-columns: 1fr; }
    .bienvenida { padding: 24px 20px; }
  }
</style>
</head>
<body>

<div class="app" id="app">
  <div class="cortina" id="cortina"></div>
  <aside id="menu">
    <div class="marca"><img src="/logo.png" alt="TACIT STR"><b>TACIT STR</b></div>
    <button class="item activo" data-vista="inicio"><span class="ico"><svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7"></path><path d="M5 10v10h14V10"></path></svg></span>Inicio</button>
    <button class="item" data-vista="fuentes"><span class="ico"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg></span>Sitios<span class="num" id="num-fuentes">8/8</span></button>
    <button class="item" data-vista="calidad"><span class="ico"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 15V9l3 3 3-3v6M17 9v6"></path></svg></span>Calidad<span class="num" id="num-calidad">3</span></button>
    <div class="seccion-menu">Herramientas</div>
    <button class="item" data-vista="nuvio"><span class="ico"><svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="3"></rect><path d="M11 18h2"></path></svg></span>Plugin de Nuvio</button>
    <a class="item" href="/status" target="_blank"><span class="ico"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></span>Diagnóstico</a>

    <div class="pie-menu">
      <b>TACIT STR</b>
      <span>v2.0 · Addon Latino</span>
    </div>
  </aside>

  <main>
    <div class="movil">
      <div class="logo"><img src="/logo.png" alt="">TACIT STR</div>
      <button class="icono-btn" id="abrir-menu" aria-label="Menú"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"></path></svg></button>
    </div>
    <div class="contenido">
      <!-- VISTA INICIO -->
      <section class="vista activa" id="v-inicio">
        <div class="bienvenida">
          <small>Configuración del Addon</small>
          <h2>Panel de Control</h2>
          <p>Configura las fuentes, calidades y enlaces deseados. Al ajustar tus opciones, haz clic en Instalar para aplicar los cambios a tu reproductor.</p>
          <div class="acciones">
            <a class="btn btn-rojo" id="instalar" href="#"><svg viewBox="0 0 24 24"><path d="m6 4 14 8-14 8z"></path></svg>Instalar en Stremio</a>
            <button class="btn btn-claro" id="copiar"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15V5a2 2 0 0 1 2-2h10"></path></svg>Copiar URL del addon</button>
            <a class="btn btn-claro" id="instalar-web" target="_blank" rel="noopener" href="#">Stremio Web</a>
          </div>
        </div>
        <div class="chips">
          <span class="chip" data-ir="fuentes"><i></i><b id="chip-sitios">8 de 8 fuentes (⭐ Recomendadas)</b></span>
          <span class="chip" data-ir="calidad"><i></i><b id="chip-calidades">4K · 1080P · 720P</b></span>
          <span class="chip" data-ir="calidad"><i></i><b id="chip-torrents">🧲 Torrents Activos</b></span>
          <span class="chip" data-ir="calidad"><i></i><span id="chip-muertos">Links muertos ocultos</span></span>
        </div>
        <div class="rejilla2">
          <div class="tarjeta mini"><div><h3>Plugin de Nuvio</h3><p>¿Usas Nuvio en celular o TV? Agrega el repositorio oficial de TACIT STR.</p><button class="enlace" data-ir="nuvio">Ver instrucciones →</button></div></div>
          <div class="tarjeta mini"><div><h3>Diagnóstico en Vivo</h3><p>Revisa qué sitios web y servidores están respondiendo activamente.</p><a class="enlace" href="/status" target="_blank">Ver diagnóstico →</a></div></div>
        </div>
      </section>

      <!-- VISTA FUENTES / SITIOS -->
      <section class="vista" id="v-fuentes">
        <div class="encabezado"><h1>Sitios</h1><p>Selecciona hasta 8 fuentes activas. Mantener un máximo de 8 fuentes garantiza respuestas veloces en menos de 4 segundos sin saturación.</p></div>
        <div class="aviso"><span>ⓘ</span><div>Todos los raspadores entregan enlaces limpios bajo el nombre <b>TACIT STR · WEB</b> o <b>TACIT STR 🧲</b>, con audio Latino preferente y sin bloqueos de IP. Las fuentes con insignia <b>⭐ TOP</b> son las más estables y rápidas.</div></div>
        <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;align-items:center;">
          <button class="btn btn-claro" id="btn-solo-top" style="font-size:13px;padding:8px 14px;">⭐ Activar 8 fuentes recomendadas</button>
          <button class="btn btn-claro" id="btn-desactivar-todas" style="font-size:13px;padding:8px 14px;">Desactivar todas</button>
          <span style="font-size:13px;color:var(--suave);margin-left:auto;" id="lbl-cupo">Cupo: <b>8 de 8</b></span>
        </div>
        <div id="lista-fuentes"></div>
      </section>

      <!-- VISTA CALIDAD -->
      <section class="vista" id="v-calidad">
        <div class="encabezado"><h1>Calidad</h1><p>Solo te saldrán las calidades que tengas marcadas aquí.</p></div>
        <div class="tarjeta"><div class="opciones" id="lista-calidades"></div></div>
        <div class="tarjeta">
          <h3>🧲 Enlaces Torrents (P2P 4K / 1080p)</h3>
          <p style="margin-bottom:14px">Permite buscar y reproducir enlaces torrent para máxima fidelidad 4K/1080p con recuento de personas transmitiendo (semillas).</p>
          <div class="opciones">
            <div class="opcion grande on" id="op-torrents">
              <span class="marca-op"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"></path></svg></span>
              <div><b id="txt-torrents-title">Torrents Habilitados 🧲</b><small id="txt-torrents-desc">Incluye torrents 4K/1080p con seeders + streaming directo</small></div>
            </div>
          </div>
        </div>
        <div class="tarjeta">
          <h3>Filtro de compatibilidad</h3>
          <p style="margin-bottom:14px">Descarta servidores problemáticos para evitar pantallas negras en Smart TV.</p>
          <div class="opciones">
            <div class="opcion grande on" id="op-muertos">
              <span class="marca-op"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"></path></svg></span>
              <div><b>Ocultar links muertos y servidores con bloqueo de IP</b><small>Recomendado (Vimeos y VOE directos)</small></div>
            </div>
          </div>
        </div>
      </section>

      <!-- VISTA NUVIO -->
      <section class="vista" id="v-nuvio">
        <div class="encabezado"><h1>Plugin de Nuvio</h1><p>Usa TACIT STR directamente en la aplicación Nuvio en Android TV o teléfono.</p></div>
        <div class="tarjeta">
          <h3>Repositorio del Plugin</h3>
          <p>Usa este enlace para agregar el plugin oficial de TACIT STR en Nuvio:</p>
          <div class="caja-url"><code id="url-plugin">https://raw.githubusercontent.com/tacitsp1113/raava-str/main/pluggin-latino-main/manifest.json</code><button class="btn btn-rojo" id="copiar-plugin">Copiar</button></div>
        </div>
        <div class="tarjeta">
          <h3>Cómo instalarlo en Nuvio</h3>
          <ol class="pasos">
            <li>Abre <b>Nuvio</b> en tu dispositivo.</li>
            <li>Entra en <b>Ajustes</b> o <b>Plugins / Complementos</b>.</li>
            <li>Selecciona <b>Agregar repositorio</b> o <b>Instalar desde URL</b>.</li>
            <li>Pega el enlace de arriba y guarda los cambios.</li>
          </ol>
        </div>
      </section>
    </div>
  </main>
</div>

<div class="toast" id="toast"></div>

<script>
const PROVEEDORES_LISTA = [
  // 🎬 PELÍCULAS Y SERIES (STREAMING DIRECTO HTTPS - 100% SEGURO)
  { id: 'pelispanda', nombre: 'PelisPanda (Vimeos)', grupo: 'peliculas', top: true },
  { id: 'cinecalidad', nombre: 'CineCalidad (Vimeos)', grupo: 'peliculas', top: true },
  { id: 'cuevana', nombre: 'Cuevana (Vimeos / StreamWish)', grupo: 'peliculas', top: true },
  { id: 'pelishax', nombre: 'PelisHax (StreamWish / VidHide)', grupo: 'peliculas', top: true },
  { id: 'allcalidad', nombre: 'AllCalidad (Vimeos)', grupo: 'peliculas', top: true },
  { id: 'seriesflix', nombre: 'SeriesFlix', grupo: 'peliculas', top: true },
  { id: 'hackstore', nombre: 'HackStore (Vimeos / Directo)', grupo: 'peliculas', top: true },
  { id: 'allpeliculasse', nombre: 'AllPeliculas (Vimeos)', grupo: 'peliculas' },
  { id: 'gnula', nombre: 'Gnula (StreamWish)', grupo: 'peliculas' },
  { id: 'pelisplus', nombre: 'PelisPlus', grupo: 'peliculas' },
  { id: 'pelisgo', nombre: 'PelisGo (Latino / Cast)', grupo: 'peliculas' },
  { id: 'pelispedia', nombre: 'PelisPedia', grupo: 'peliculas' },
  { id: 'sololatino', nombre: 'SoloLatino', grupo: 'peliculas' },
  { id: 'tioplus', nombre: 'TioPlus', grupo: 'peliculas' },
  { id: 'peliserieshoy', nombre: 'PelisSeriesHoy', grupo: 'peliculas' },
  { id: 'seriesmetro', nombre: 'SeriesMetro', grupo: 'peliculas' },
  { id: 'peliculasflix', nombre: 'PeliculasFlix', grupo: 'peliculas' },
  { id: 'homecine', nombre: 'HomeCine', grupo: 'peliculas' },
  { id: 'areshd', nombre: 'AresHD', grupo: 'peliculas' },
  { id: 'unlimplay', nombre: 'UnlimPlay', grupo: 'peliculas' },
  { id: 'cinehdplus', nombre: 'CineHdPlus', grupo: 'peliculas' },
  { id: 'lamovie', nombre: 'LaMovie', grupo: 'peliculas' },
  { id: 'moviebox', nombre: 'MovieBox', grupo: 'peliculas' },
  { id: 'embed69', nombre: 'Embed69', grupo: 'peliculas' },
  { id: 'entrepeliculasyseries', nombre: 'EntrePeliculasYSeries', grupo: 'peliculas' },
  { id: 'vitaminagg', nombre: 'VitaminaGG', grupo: 'peliculas' },
  { id: 'vimeus', nombre: 'Vimeus', grupo: 'peliculas' },

  // ⛩️ ANIME
  { id: 'tioanime', nombre: 'TioAnime', grupo: 'anime', top: true },
  { id: 'jkanime', nombre: 'JKAnime', grupo: 'anime' },
  { id: 'monoschinos', nombre: 'MonosChinos', grupo: 'anime' },
  { id: 'latanime', nombre: 'LatAnime', grupo: 'anime' },
  { id: 'animejl', nombre: 'AnimeJL', grupo: 'anime' },
  { id: 'animeav1', nombre: 'AnimeAV1', grupo: 'anime' },
  { id: 'henaojara', nombre: 'Henaojara', grupo: 'anime' },
  { id: 'katanime', nombre: 'KatAnime', grupo: 'anime' },

  // 🐉 DONGHUA
  { id: 'mundodonghua', nombre: 'MundoDonghua', grupo: 'donghua', top: true },
  { id: 'reydonghua', nombre: 'ReyDonghua', grupo: 'donghua' },
  { id: 'donghualife', nombre: 'DonghuaLife', grupo: 'donghua' },

  // 🎭 DORAMAS
  { id: 'doramasflix', nombre: 'DoramasFlix', grupo: 'doramas', top: true },
  { id: 'doramasyt', nombre: 'DoramasYT', grupo: 'doramas' },

  // 📺 CARICATURAS Y RETRO
  { id: 'lacartoons', nombre: 'LACartoons (Retro Latino)', grupo: 'caricaturas', top: true },
  { id: 'danimados', nombre: 'Danimados (Latino)', grupo: 'caricaturas' },

  // 🌐 ESPECIALES Y DOCUMENTALES
  { id: 'plutotv', nombre: 'Pluto TV (Oficial)', grupo: 'especiales' },
  { id: 'rcn', nombre: 'RCN Total (Colombia)', grupo: 'especiales' },
  { id: 'areadocumental', nombre: 'Area Documental', grupo: 'especiales' },
  { id: 'documaniatv', nombre: 'DocumaniaTV', grupo: 'especiales' },

  // 🧲 FUENTES TORRENT (P2P - SUSPENDIDAS TEMPORALMENTE POR PRIVACIDAD DE IP)
  { id: 'uhdmovies', nombre: 'UHDMovies (4K HDR · P2P)', grupo: 'torrents' },
  { id: '4khdhub', nombre: '4kHDHub (4K UHD · P2P)', grupo: 'torrents' },
  { id: 'hdhub4u', nombre: 'HDHub4u (P2P)', grupo: 'torrents' },
  { id: 'showbox', nombre: 'ShowBox (P2P)', grupo: 'torrents' },
  { id: 'videasy', nombre: 'Videasy (P2P / Web)', grupo: 'torrents' },
  { id: 'vidfast', nombre: 'VidFast (P2P / Web)', grupo: 'torrents' },
  { id: 'vidlink', nombre: 'VidLink (P2P / Web)', grupo: 'torrents' }
];

const GRUPOS = {
  peliculas: ['🎬 Películas y Series (Directo)', 'Cine, series y estrenos con streaming directo HTTPS'],
  anime: ['⛩️ Anime', 'Animación japonesa en audio latino y subtitulado'],
  donghua: ['🐉 Donghua', 'Animación china subtitulada'],
  doramas: ['🎭 Doramas', 'Dramas asiáticos'],
  caricaturas: ['📺 Caricaturas y retro', 'Series animadas clásicas de TV'],
  especiales: ['🌐 Especiales y respaldo', 'Fuentes adicionales de streaming directo'],
  torrents: ['🧲 Fuentes Torrent (P2P · Suspendidas)', 'Suspendidas temporalmente para garantizar privacidad total de tu IP (sin multas)']
};

const CALIDADES = [
  ['4k', 'Máxima fidelidad para pantallas compatibles (UHD/2160p)'],
  ['1080p', 'Alta definición recomendada para televisores y monitores'],
  ['720p', 'Definición estándar para conexiones moderadas'],
  ['480p', 'Bajo consumo para conexiones móviles o lentas'],
  ['Desconocida', 'Enlaces sin resolución explícita en su título']
];

const CHECK = '<span class="marca-op"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"></path></svg></span>';
const BASE_URL = ${JSON.stringify(baseUrl)} || location.origin;

const DEFAULT_ACTIVE_8 = [
  'pelispanda',
  'cinecalidad',
  'cuevana',
  'pelishax',
  'allcalidad',
  'seriesflix',
  'hackstore',
  'tioanime'
];

const MAX_FUENTES = 8;

const DEFAULT_CONFIG = {
  proveedores: [...DEFAULT_ACTIVE_8],
  calidades: ['4k', '1080p', '720p'],
  disableTorrents: true,
  filtrarMuertos: true
};

let config = { ...DEFAULT_CONFIG };

// Inicializar desde props o localStorage
${initialConfig ? `config = ${JSON.stringify(initialConfig)};` : `
try {
  const saved = localStorage.getItem('tacit_config');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed) config = { ...config, ...parsed };
  }
} catch (_) {}
`}

// Normalizar estructura de config para garantizar compatibilidad total
if (!Array.isArray(config.calidades)) {
  if (Array.isArray(config.qualities)) config.calidades = [...config.qualities];
  else config.calidades = ['4k', '1080p', '720p'];
}
config.qualities = config.calidades;

if (!Array.isArray(config.proveedores)) {
  if (Array.isArray(config.providers)) config.proveedores = [...config.providers];
  else if (config.providers && Array.isArray(config.providers.movie)) config.proveedores = [...config.providers.movie];
  else config.proveedores = [...DEFAULT_ACTIVE_8];
}
config.providers = config.proveedores;
if (typeof config.disableTorrents !== 'boolean') config.disableTorrents = true;
if (typeof config.filtrarMuertos !== 'boolean') config.filtrarMuertos = true;

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(t) {
  const el = $('toast');
  el.textContent = t;
  el.classList.add('ver');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('ver'), 2000);
}

const activos = () => {
  if (Array.isArray(config.proveedores)) {
    return config.proveedores.slice(0, MAX_FUENTES);
  }
  return [...DEFAULT_ACTIVE_8];
};

function generarUrlManifest() {
  const currentProvs = activos();
  const isDefaultProvs = currentProvs.length === DEFAULT_ACTIVE_8.length &&
    DEFAULT_ACTIVE_8.every(id => currentProvs.includes(id));

  const isDefault = isDefaultProvs &&
    config.calidades.length === 3 &&
    config.calidades.includes('4k') &&
    config.calidades.includes('1080p') &&
    config.calidades.includes('720p') &&
    Boolean(config.disableTorrents) &&
    config.filtrarMuertos;

  if (isDefault) {
    return BASE_URL + '/manifest.json';
  }

  const payload = {
    providers: currentProvs,
    qualities: config.calidades,
    disableTorrents: Boolean(config.disableTorrents),
    filtrarMuertos: Boolean(config.filtrarMuertos)
  };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return BASE_URL + '/' + b64 + '/manifest.json';
}

function pintarResumen() {
  const current = activos();
  const n = current.length;
  const esDefault = n === DEFAULT_ACTIVE_8.length && DEFAULT_ACTIVE_8.every(id => current.includes(id));

  $('num-fuentes').textContent = n + '/' + MAX_FUENTES;
  $('num-calidad').textContent = config.calidades.length;
  $('chip-sitios').textContent = n + ' de ' + MAX_FUENTES + ' fuentes' + (esDefault ? ' (⭐ Recomendadas)' : '');
  if ($('lbl-cupo')) {
    $('lbl-cupo').innerHTML = 'Cupo: <b>' + n + ' de ' + MAX_FUENTES + '</b>' + (n >= MAX_FUENTES ? ' <span style="color:#38bdf8;">(Lleno)</span>' : '');
  }
  $('chip-calidades').textContent = config.calidades.map(c => c.toUpperCase()).join(' · ') || 'Sin calidades';
  $('chip-muertos').textContent = config.filtrarMuertos ? 'Links muertos ocultos' : 'Links muertos visibles';
  $('chip-torrents').textContent = config.disableTorrents ? '🚫 Solo Streaming Directo' : '🧲 Torrents Activos';

  const manifestUrl = generarUrlManifest();
  $('instalar').href = manifestUrl.replace(/^https?:\\/\\//, 'stremio://');
  $('instalar-web').href = 'https://web.stremio.com/#/addons?addon=' + encodeURIComponent(manifestUrl);
}

function guardar() {
  try {
    localStorage.setItem('tacit_config', JSON.stringify(config));
  } catch (_) {}
  pintarResumen();
}

function pintarFuentes() {
  const act = new Set(activos());
  $('lista-fuentes').innerHTML = Object.entries(GRUPOS).map(([g, [nombre, desc]]) => {
    const lista = PROVEEDORES_LISTA.filter(p => p.grupo === g);
    if (!lista.length) return '';
    const on = lista.filter(p => act.has(p.id)).length;
    const isTorrentsGroup = g === 'torrents';
    const torrentNotice = (isTorrentsGroup && config.disableTorrents)
      ? '<span style="color:#f87171;font-size:11px;font-weight:700;margin-left:8px;">(Desactivado por interruptor general)</span>'
      : '';

    return '<div class="tarjeta grupo-prov">' +
      '<header><h3>' + nombre + torrentNotice + '<small>' + desc + ' · ' + on + ' de ' + lista.length + '</small></h3>' +
      '<div class="botones-grupo"><button class="pastilla" data-top="' + g + '">⭐ TOP</button><button class="pastilla" data-ninguno="' + g + '">Ninguno</button></div></header>' +
      '<div class="opciones">' +
      lista.map(p => '<div class="opcion ' + (act.has(p.id) ? 'on' : '') + '" data-prov="' + esc(p.id) + '">' + CHECK + esc(p.nombre) + (p.top ? '<span class="badge-top">⭐ TOP</span>' : '') + '</div>').join('') +
      '</div></div>';
  }).join('');
}

function cambiarProveedores(ids, encender) {
  const act = new Set(activos());
  if (encender) {
    const toAdd = ids.filter(id => !act.has(id));
    if (act.size + toAdd.length > MAX_FUENTES) {
      return toast('Máximo ' + MAX_FUENTES + ' fuentes activas. Desactiva una primero.');
    }
    toAdd.forEach(id => act.add(id));
  } else {
    ids.forEach(id => act.delete(id));
  }
  config.proveedores = [...act];
  pintarFuentes();
  guardar();
}

$('lista-fuentes').addEventListener('click', (e) => {
  const op = e.target.closest('[data-prov]');
  if (op) {
    return cambiarProveedores([op.dataset.prov], !op.classList.contains('on'));
  }
  const top = e.target.dataset.top;
  const ninguno = e.target.dataset.ninguno;
  if (top) {
    const grupoProvs = PROVEEDORES_LISTA.filter(p => p.grupo === top && p.top);
    const act = new Set(activos());
    let agregados = 0;
    grupoProvs.forEach(p => {
      if (!act.has(p.id) && act.size < MAX_FUENTES) {
        act.add(p.id);
        agregados++;
      }
    });
    if (grupoProvs.length > agregados && act.size >= MAX_FUENTES) {
      toast('Cupo máximo de ' + MAX_FUENTES + ' fuentes alcanzado.');
    }
    config.proveedores = [...act];
    pintarFuentes();
    guardar();
  } else if (ninguno) {
    cambiarProveedores(PROVEEDORES_LISTA.filter(p => p.grupo === ninguno).map(p => p.id), false);
  }
});

const btnSoloTop = $('btn-solo-top');
if (btnSoloTop) {
  btnSoloTop.addEventListener('click', () => {
    config.proveedores = [...DEFAULT_ACTIVE_8];
    pintarFuentes();
    guardar();
    toast('Activadas las 8 fuentes recomendadas');
  });
}

const btnDesactivarTodas = $('btn-desactivar-todas');
if (btnDesactivarTodas) {
  btnDesactivarTodas.addEventListener('click', () => {
    config.proveedores = [];
    pintarFuentes();
    guardar();
    toast('Desactivadas todas las fuentes');
  });
}

function pintarCalidades() {
  const cSet = new Set(config.calidades.map(c => c.toLowerCase()));
  $('lista-calidades').innerHTML = CALIDADES.map(([c, d]) => {
    const isOn = cSet.has(c.toLowerCase());
    return '<div class="opcion grande ' + (isOn ? 'on' : '') + '" data-cal="' + c + '">' +
      CHECK + '<div><b>' + (c === 'Desconocida' ? 'Calidad desconocida' : c) + '</b><small>' + d + '</small></div></div>';
  }).join('');

  $('op-muertos').classList.toggle('on', config.filtrarMuertos);
  const torrentsActivos = !config.disableTorrents;
  $('op-torrents').classList.toggle('on', torrentsActivos);
  if ($('txt-torrents-title')) {
    $('txt-torrents-title').textContent = torrentsActivos ? 'Torrents Habilitados 🧲' : 'Torrents Suspendidos 🚫 (100% Seguro)';
    $('txt-torrents-desc').textContent = torrentsActivos ? 'Incluye torrents 4K/1080p con seeders + streaming directo' : 'Streaming directo HTTPS activo (Privacidad protegida · Sin descargas P2P)';
  }
}

$('lista-calidades').addEventListener('click', (e) => {
  const op = e.target.closest('[data-cal]');
  if (!op) return;
  const c = op.dataset.cal;
  const cLower = c.toLowerCase();
  let arr = config.calidades.map(x => x.toLowerCase());
  if (arr.includes(cLower)) {
    arr = arr.filter(x => x !== cLower);
  } else {
    arr.push(cLower);
  }
  if (!arr.length) {
    return toast('Deja al menos una calidad marcada');
  }
  config.calidades = arr;
  pintarCalidades();
  guardar();
});

$('op-muertos').addEventListener('click', () => {
  config.filtrarMuertos = !config.filtrarMuertos;
  pintarCalidades();
  guardar();
});

$('op-torrents').addEventListener('click', () => {
  config.disableTorrents = !config.disableTorrents;
  pintarCalidades();
  pintarFuentes();
  guardar();
});

function mostrarVista(v) {
  if (!$('v-' + v)) v = 'inicio';
  document.querySelectorAll('.vista').forEach(s => s.classList.toggle('activa', s.id === 'v-' + v));
  document.querySelectorAll('.item[data-vista]').forEach(b => b.classList.toggle('activo', b.dataset.vista === v));
  $('menu').classList.remove('abierto');
  $('cortina').classList.remove('ver');
  window.scrollTo(0, 0);
}

document.querySelectorAll('.item[data-vista]').forEach(b => b.addEventListener('click', () => mostrarVista(b.dataset.vista)));
document.addEventListener('click', (e) => {
  const ir = e.target.closest('[data-ir]');
  if (ir) mostrarVista(ir.dataset.ir);
});

$('abrir-menu').addEventListener('click', () => { $('menu').classList.add('abierto'); $('cortina').classList.add('ver'); });
$('cortina').addEventListener('click', () => { $('menu').classList.remove('abierto'); $('cortina').classList.remove('ver'); });

async function copiar(texto, aviso) {
  try {
    await navigator.clipboard.writeText(texto);
    toast(aviso);
  } catch(e) {
    prompt('Copia este enlace:', texto);
  }
}

$('copiar').addEventListener('click', () => copiar(generarUrlManifest(), 'URL de TACIT STR copiada ✓'));
$('copiar-plugin').addEventListener('click', () => copiar($('url-plugin').textContent, 'Enlace de Nuvio copiado ✓'));

$('instalar').addEventListener('click', (e) => {
  e.preventDefault();
  const manifestUrl = generarUrlManifest();
  const stremioUrl = manifestUrl.replace(/^https?:\\/\\//, 'stremio://');
  window.location.href = stremioUrl;
});

$('instalar-web').addEventListener('click', (e) => {
  e.preventDefault();
  const manifestUrl = generarUrlManifest();
  const webUrl = 'https://web.stremio.com/#/addons?addon=' + encodeURIComponent(manifestUrl);
  window.open(webUrl, '_blank', 'noopener,noreferrer');
});

// Iniciar interfaz
pintarFuentes();
pintarCalidades();
pintarResumen();
mostrarVista(location.hash.slice(1) || 'inicio');
</script>
</body>
</html>`;
}

module.exports = {
  renderConfigPage
};
