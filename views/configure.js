/**
 * Plantilla del panel interactivo de configuración de TACIT STR con soporte multi-perfil (Usuario + PIN)
 */

function renderConfigPage(initialConfig = null, baseUrl = '') {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mi panel — TACIT STR</title>
<link rel="icon" href="/logo.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --cian: #0ea5e9; --cian-hover: #38bdf8; --cian-suave: rgba(14,165,233,0.14); --cian-borde: rgba(14,165,233,0.45);
    --fondo: #06090f; --capa: #0d1424; --tarjeta: #111a2e; --borde: #1e293b; --borde-fuerte: #334155;
    --texto: #f8fafc; --suave: #94a3b8; --tenue: #64748b; --verde: #10b981; --amarillo: #fbbf24;
  }
  body { font-family: 'Inter', sans-serif; background: var(--fondo); color: var(--texto); min-height: 100vh; }
  body::before { content: ''; position: fixed; inset: 0; background: radial-gradient(circle at 85% -10%, rgba(14,165,233,0.22), transparent 45%), radial-gradient(circle at -10% 110%, rgba(6,182,212,0.14), transparent 40%); pointer-events: none; z-index: 0; }
  a { color: inherit; text-decoration: none; }
  button { font-family: inherit; }
  .app { position: relative; display: grid; grid-template-columns: 270px 1fr; gap: 18px; padding: 18px; min-height: 100vh; }
  aside { background: rgba(13,20,36,0.94); border: 1px solid var(--borde); border-radius: 24px; display: flex; flex-direction: column; position: sticky; top: 18px; height: calc(100vh - 36px); overflow-y: auto; padding: 18px 14px 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
  .marca { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 4px 0 14px; border-bottom: 1px solid var(--borde); margin-bottom: 14px; }
  .marca img { width: 50px; height: 50px; border-radius: 16px; box-shadow: 0 0 30px rgba(14,165,233,0.35); object-fit: cover; }
  .marca b { font-size: 19px; font-weight: 900; color: var(--cian-hover); letter-spacing: -0.5px; }
  .seccion-menu { color: var(--tenue); font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 12px 12px 6px; }
  .item { display: flex; align-items: center; gap: 12px; width: 100%; background: none; border: none; color: var(--suave); padding: 9px 12px; border-radius: 14px; font-size: 14px; font-weight: 600; cursor: pointer; text-align: left; transition: background .15s, color .15s; margin-bottom: 3px; }
  .item .ico { width: 34px; height: 34px; border-radius: 11px; background: #162035; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background .15s; }
  .item svg { width: 17px; height: 17px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .item:hover { color: var(--texto); background: #1a2740; }
  .item.activo { color: #fff; background: linear-gradient(90deg, rgba(14,165,233,0.25), rgba(14,165,233,0.05)); }
  .item.activo .ico { background: var(--cian); box-shadow: 0 0 15px rgba(14,165,233,0.5); }
  .item .num { margin-left: auto; font-size: 12px; color: var(--tenue); font-weight: 700; }
  .pie-menu { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--borde); }
  .yo { display: flex; align-items: center; gap: 10px; padding: 8px 10px 12px; }
  .yo .avatar { width: 38px; height: 38px; border-radius: 50%; border: 2px solid var(--cian-borde); background: #162035; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; color: var(--cian-hover); }
  .yo div { min-width: 0; }
  .yo b { display: block; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f8fafc; }
  .yo small { color: var(--tenue); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; font-family: monospace; }
  main { min-width: 0; }
  .movil { display: none; align-items: center; justify-content: space-between; padding: 6px 4px 14px; }
  .movil .logo { display: flex; align-items: center; gap: 10px; font-weight: 900; color: var(--cian-hover); font-size: 18px; }
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
  .bienvenida { position: relative; overflow: hidden; border-radius: 26px; padding: 30px; border: 1px solid var(--cian-borde); background: linear-gradient(135deg, #08213b 0%, #0c1829 45%, #070c14 100%); margin-bottom: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  .bienvenida small { color: #7dd3fc; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; }
  .bienvenida h2 { font-size: clamp(24px, 4vw, 34px); font-weight: 900; letter-spacing: -1px; margin: 6px 0 8px; color: #ffffff; }
  .bienvenida p { color: #cbd5e1; max-width: 520px; line-height: 1.6; font-size: 15px; }
  .acciones { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px; position: relative; z-index: 1; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; border: none; border-radius: 16px; font-weight: 800; cursor: pointer; transition: background .15s, border-color .15s, transform .15s; font-size: 15px; padding: 14px 22px; }
  .btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .btn-rojo { background: var(--cian); color: #fff; box-shadow: 0 10px 30px rgba(14,165,233,0.35); }
  .btn-rojo:hover { background: var(--cian-hover); transform: translateY(-1px); }
  .btn-claro { background: rgba(255,255,255,0.06); color: #fff; border: 1px solid rgba(255,255,255,0.14); }
  .btn-claro:hover { border-color: var(--cian-borde); background: rgba(14,165,233,0.12); }
  .chips { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
  .chip { display: inline-flex; align-items: center; gap: 8px; background: var(--capa); border: 1px solid var(--borde); padding: 10px 16px; border-radius: 999px; font-size: 14px; color: var(--suave); cursor: pointer; transition: border-color .15s; }
  .chip:hover { border-color: var(--cian-borde); }
  .chip b { color: #fff; }
  .chip i { width: 8px; height: 8px; border-radius: 50%; background: var(--cian); display: inline-block; box-shadow: 0 0 10px #38bdf8; }
  .tarjeta { background: rgba(17,26,46,0.92); border: 1px solid var(--borde); border-radius: 22px; padding: 22px; margin-bottom: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
  .tarjeta h3 { font-size: 16px; font-weight: 800; margin-bottom: 6px; color: #f8fafc; }
  .tarjeta > p { color: var(--suave); font-size: 14px; line-height: 1.6; }
  .rejilla2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .rejilla2 .tarjeta { margin-bottom: 0; }
  .mini { display: flex; gap: 14px; align-items: flex-start; }
  .mini p { color: var(--suave); font-size: 14px; line-height: 1.55; margin: 4px 0 12px; }
  .enlace { color: #38bdf8; font-weight: 700; font-size: 14px; cursor: pointer; background: none; border: none; padding: 0; }
  .enlace:hover { color: #7dd3fc; text-decoration: underline; }
  .aviso { display: flex; gap: 12px; align-items: flex-start; background: rgba(14,165,233,0.08); border: 1px solid rgba(14,165,233,0.3); color: #bae6fd; border-radius: 18px; padding: 16px 18px; font-size: 14px; line-height: 1.6; margin-bottom: 18px; }
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
  .opcion .marca-op { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #334155; display: flex; align-items: center; justify-content: center; transition: all .15s; flex-shrink: 0; }
  .opcion .marca-op svg { width: 12px; height: 12px; stroke: #fff; fill: none; stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; opacity: 0; }
  .opcion small { color: var(--tenue); font-weight: 500; font-size: 12px; }
  .opcion:hover { border-color: #475569; color: #fff; }
  .opcion.on { border-color: var(--cian-borde); background: var(--cian-suave); color: #fff; }
  .opcion.on .marca-op { background: var(--cian); border-color: var(--cian); }
  .opcion.on .marca-op svg { opacity: 1; }
  .opcion.grande { border-radius: 18px; padding: 14px 18px 14px 14px; flex: 1 1 200px; }
  .opcion.grande div b { display: block; color: inherit; }
  .caja-url { display: flex; gap: 10px; align-items: center; background: #070c14; border: 1px solid var(--borde); border-radius: 16px; padding: 8px 8px 8px 16px; margin-top: 14px; }
  .caja-url code { flex: 1; color: #7dd3fc; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .caja-url .btn { padding: 10px 16px; font-size: 14px; border-radius: 12px; }
  .pasos { counter-reset: paso; list-style: none; margin-top: 14px; }
  .pasos li { counter-increment: paso; position: relative; padding: 0 0 14px 42px; color: var(--suave); font-size: 14px; line-height: 1.55; }
  .pasos li::before { content: counter(paso); position: absolute; left: 0; top: -2px; width: 28px; height: 28px; border-radius: 50%; background: var(--cian-suave); color: #38bdf8; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 13px; }
  .pasos b { color: #fff; }
  .toast { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%) translateY(120px); background: #0d1424; border: 1px solid var(--cian-borde); color: #f8fafc; padding: 12px 24px; border-radius: 999px; font-size: 14px; font-weight: 600; transition: transform .25s, opacity .25s; z-index: 200; opacity: 0; pointer-events: none; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
  .toast.ver { transform: translateX(-50%) translateY(0); opacity: 1; }

  /* MODAL DE PERFIL / LOGIN */
  .modal-overlay { position: fixed; inset: 0; background: rgba(4,7,13,0.88); backdrop-filter: blur(8px); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .modal-overlay.oculto { display: none; }
  .modal-card { max-width: 420px; width: 100%; background: #0d1424; border: 1.5px solid var(--cian-borde); border-radius: 24px; padding: 32px 24px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
  .modal-card h2 { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 6px; }
  .modal-card p { font-size: 14px; color: var(--suave); margin-bottom: 22px; line-height: 1.5; }
  .campo { text-align: left; margin-bottom: 16px; }
  .campo label { display: block; font-size: 13px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; }
  .campo input { width: 100%; background: #06090f; border: 1.5px solid var(--borde); border-radius: 12px; padding: 12px 14px; color: #fff; font-size: 14px; font-family: inherit; transition: border-color .15s; }
  .campo input:focus { outline: none; border-color: var(--cian); }
  .btn-submit { width: 100%; margin-top: 10px; }

  .cortina { display: none; }
  @media (max-width: 900px) {
    .app { grid-template-columns: 1fr; padding: 12px; }
    aside { position: fixed; left: 10px; top: 10px; bottom: 10px; height: auto; width: 278px; padding-bottom: 18px; background: #0d1424; z-index: 60; transform: translateX(-120%); transition: transform .25s; }
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

<!-- MODAL DE ACCESO A PERFIL (USUARIO + PIN) -->
<div class="modal-overlay" id="modal-login">
  <div class="modal-card">
    <div class="marca" style="border:none;margin-bottom:0;padding-bottom:10px;"><img src="/logo.png" alt="TACIT STR"><b>TACIT STR</b></div>
    <h2>Perfil Personal</h2>
    <p>Ingresa tu nombre y PIN para que lo que tú muevas se guarde solo en tu Stremio sin afectar a los demás.</p>
    <form id="form-login" onsubmit="return false;">
      <div class="campo">
        <label>Nombre de usuario o dispositivo:</label>
        <input type="text" id="inp-user" placeholder="Ej: Elihu, Sala, Papa" autocomplete="username" required>
      </div>
      <div class="campo">
        <label>PIN o Contraseña secreta:</label>
        <input type="password" id="inp-pin" placeholder="PIN secreto (ej: 1234)" autocomplete="current-password" required>
      </div>
      <button type="submit" class="btn btn-rojo btn-submit" id="btn-entrar">Acceder a mi panel</button>
      <div id="login-error" style="color:#fca5a5;font-size:13px;margin-top:12px;display:none;"></div>
    </form>
  </div>
</div>

<div class="app" id="app">
  <div class="cortina" id="cortina"></div>
  <aside id="menu">
    <div class="marca"><img src="/logo.png" alt="TACIT STR"><b>TACIT STR</b></div>
    <button class="item activo" data-vista="inicio"><span class="ico"><svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7"></path><path d="M5 10v10h14V10"></path></svg></span>Inicio</button>
    <button class="item" data-vista="fuentes"><span class="ico"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg></span>Sitios<span class="num" id="num-fuentes">53/53</span></button>
    <button class="item" data-vista="calidad"><span class="ico"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 15V9l3 3 3-3v6M17 9v6"></path></svg></span>Calidad<span class="num" id="num-calidad">4</span></button>
    <div class="seccion-menu">Herramientas</div>
    <button class="item" data-vista="nuvio"><span class="ico"><svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="3"></rect><path d="M11 18h2"></path></svg></span>Plugin de Nuvio</button>
    <a class="item" href="/status" target="_blank"><span class="ico"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></span>Diagnóstico</a>

    <div class="pie-menu">
      <div class="yo">
        <div class="avatar" id="avatar-user">T</div>
        <div>
          <b id="perfil-nombre">TACIT STR</b>
          <small id="perfil-token">Servidor Personal</small>
          <button type="button" class="enlace" id="btn-cambiar-perfil" style="font-size:11px;margin-top:2px;">Cambiar perfil</button>
        </div>
      </div>
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
          <small>Tu addon personal está listo</small>
          <h2>Hola, <span id="saludo-nombre">Usuario</span></h2>
          <p>Instálalo una vez en tu Stremio. Si cambias tus sitios o calidades aquí, se actualiza solo en tu televisión sin reinstalar.</p>
          <div class="acciones">
            <a class="btn btn-rojo" id="instalar" href="#"><svg viewBox="0 0 24 24"><path d="m6 4 14 8-14 8z"></path></svg>Instalar en Stremio</a>
            <button class="btn btn-claro" id="copiar"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15V5a2 2 0 0 1 2-2h10"></path></svg>Copiar URL del addon</button>
            <a class="btn btn-claro" id="instalar-web" target="_blank" rel="noopener" href="#">Stremio Web</a>
          </div>
        </div>
        <div class="chips">
          <span class="chip" data-ir="fuentes"><i></i><b id="chip-sitios">53 de 53</b> sitios activos</span>
          <span class="chip" data-ir="calidad"><i></i><b id="chip-calidades">4K · 1080p · 720p</b></span>
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
        <div class="encabezado"><h1>Sitios</h1><p>Elige en qué páginas busca tu addon. Entre más sitios activos, más enlaces tendrás disponibles.</p></div>
        <div class="aviso"><span>ⓘ</span><div>Todos los raspadores entregan enlaces limpios bajo el nombre <b>TACIT STR · WEB</b>, con audio Latino preferente y sin bloqueos de IP.</div></div>
        <div id="lista-fuentes"></div>
      </section>

      <!-- VISTA CALIDAD -->
      <section class="vista" id="v-calidad">
        <div class="encabezado"><h1>Calidad</h1><p>Solo te saldrán las calidades que tengas marcadas aquí.</p></div>
        <div class="tarjeta"><div class="opciones" id="lista-calidades"></div></div>
        <div class="tarjeta">
          <h3>🧲 Enlaces Torrents (P2P 4K / 1080p)</h3>
          <p style="margin-bottom:14px">Permite buscar y reproducir enlaces torrent para máxima fidelidad 4K/1080p.</p>
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
              <div><b>Ocultar links muertos y servidores con bloqueo de IP</b><small>Recomendado (Vimeos y VOE)</small></div>
            </div>
          </div>
        </div>
      </section>

      <!-- VISTA NUVIO -->
      <section class="vista" id="v-nuvio">
        <div class="encabezado"><h1>Plugin de Nuvio</h1><p>Para la aplicación Nuvio en celular Android y Nuvio TV.</p></div>
        <div class="tarjeta">
          <h3>Instálalo en Nuvio</h3>
          <p>Usa este enlace para agregar el plugin oficial de TACIT STR en Nuvio:</p>
          <div class="caja-url"><code id="url-plugin">https://raw.githubusercontent.com/tacitsp1113/raava-str/main/pluggin-latino-main/manifest.json</code><button class="btn btn-rojo" id="copiar-plugin">Copiar</button></div>
          <ol class="pasos" style="margin-top:20px">
            <li>Abre <b>Nuvio</b> y entra a <b>Ajustes</b>.</li>
            <li>Busca la sección de <b>Plugins</b> y presiona <b>Agregar repositorio</b>.</li>
            <li>Pega el enlace que copiaste y pulsa <b>Guardar</b>.</li>
            <li>Activa los sitios que desees y disfruta del contenido en Latino.</li>
          </ol>
        </div>
      </section>
    </div>
  </main>
</div>

<div class="toast" id="toast"></div>

<script>
const BASE_URL = ${JSON.stringify(baseUrl)} || window.location.origin;

const GRUPOS = {
  general: ['Películas y series', 'Los principales'],
  anime: ['Anime', 'Latino y subtitulado'],
  donghua: ['Donghua', 'Animación china'],
  dorama: ['Doramas', 'Series asiáticas'],
  caricaturas: ['Caricaturas', 'Clásicas y nuevas'],
  especiales: ['Multi / 4K / Internacional', 'Fuentes especiales']
};

const PROVEEDORES_LISTA = [
  // Películas y Series
  { id: 'pelispanda', nombre: 'PelisPanda', grupo: 'general' },
  { id: 'cinecalidad', nombre: 'CineCalidad', grupo: 'general' },
  { id: 'allcalidad', nombre: 'AllCalidad', grupo: 'general' },
  { id: 'cuevana', nombre: 'Cuevana', grupo: 'general' },
  { id: 'pelispedia', nombre: 'PelisPedia', grupo: 'general' },
  { id: 'pelisplus', nombre: 'PelisPlus', grupo: 'general' },
  { id: 'seriesflix', nombre: 'SeriesFlix', grupo: 'general' },
  { id: 'lamovie', nombre: 'LaMovie', grupo: 'general' },
  { id: 'hackstore', nombre: 'HackStore', grupo: 'general' },
  { id: 'peliserieshoy', nombre: 'PelisSeriesHoy', grupo: 'general' },
  { id: 'seriesmetro', nombre: 'SeriesMetro', grupo: 'general' },
  { id: 'pelisgo', nombre: 'PelisGo', grupo: 'general' },
  { id: 'sololatino', nombre: 'SoloLatino', grupo: 'general' },
  { id: 'tioplus', nombre: 'TioPlus', grupo: 'general' },
  { id: 'videasy', nombre: 'VidEasy', grupo: 'general' },
  { id: 'entrepeliculasyseries', nombre: 'EntrePeliculasYSeries', grupo: 'general' },
  { id: 'peliculasflix', nombre: 'PeliculasFlix', grupo: 'general' },
  { id: 'vitaminagg', nombre: 'VitaminaGG', grupo: 'general' },
  { id: 'vimeus', nombre: 'Vimeus', grupo: 'general' },
  { id: 'homecine', nombre: 'HomeCine', grupo: 'general' },
  { id: 'allpeliculasse', nombre: 'AllpeliculasSE', grupo: 'general' },
  { id: 'plutotv', nombre: 'Pluto TV', grupo: 'general' },
  { id: 'gnula', nombre: 'Gnula', grupo: 'general' },
  { id: 'pelishax', nombre: 'PelisHax', grupo: 'general' },
  { id: 'unlimplay', nombre: 'UnlimPlay', grupo: 'general' },
  { id: 'cinehdplus', nombre: 'CineHdPlus', grupo: 'general' },

  // Anime
  { id: 'jkanime', nombre: 'JKAnime', grupo: 'anime' },
  { id: 'tioanime', nombre: 'TioAnime', grupo: 'anime' },
  { id: 'animeav1', nombre: 'AnimeAV1', grupo: 'anime' },
  { id: 'animejl', nombre: 'AnimeJL', grupo: 'anime' },
  { id: 'latanime', nombre: 'LatAnime', grupo: 'anime' },
  { id: 'monoschinos', nombre: 'Monoschinos', grupo: 'anime' },
  { id: 'katanime', nombre: 'KatAnime', grupo: 'anime' },
  { id: 'henaojara', nombre: 'Henaojara', grupo: 'anime' },

  // Donghua
  { id: 'mundodonghua', nombre: 'MundoDonghua', grupo: 'donghua' },
  { id: 'donghualife', nombre: 'DonghuaLife', grupo: 'donghua' },
  { id: 'reydonghua', nombre: 'ReyDonghua', grupo: 'donghua' },

  // Doramas
  { id: 'doramasflix', nombre: 'DoramasFlix', grupo: 'dorama' },
  { id: 'doramasyt', nombre: 'DoramasYT', grupo: 'dorama' },

  // Caricaturas
  { id: 'lacartoons', nombre: 'LACartoons', grupo: 'caricaturas' },
  { id: 'danimados', nombre: 'Danimados', grupo: 'caricaturas' },

  // Fuentes especiales / 4K / Multi
  { id: 'embed69', nombre: 'Embed69', grupo: 'especiales' },
  { id: '4khdhub', nombre: '4KHDHub', grupo: 'especiales' },
  { id: 'hdhub4u', nombre: 'HDHub4u', grupo: 'especiales' },
  { id: 'uhdmovies', nombre: 'UHDMovies', grupo: 'especiales' },
  { id: 'showbox', nombre: 'ShowBox', grupo: 'especiales' },
  { id: 'moviebox', nombre: 'MovieBox', grupo: 'especiales' },
  { id: 'vidfast', nombre: 'VidFast', grupo: 'especiales' },
  { id: 'vidlink', nombre: 'VidLink', grupo: 'especiales' },
  { id: 'areadocumental', nombre: 'Area Documental', grupo: 'especiales' },
  { id: 'documaniatv', nombre: 'DocumaniaTV', grupo: 'especiales' },
  { id: 'rcn', nombre: 'RCN', grupo: 'especiales' }
];

const CALIDADES = [
  ['4K', '2160p Ultra HD'],
  ['1080p', 'Full HD Recomendado'],
  ['720p', 'HD Estándar'],
  ['SD', '480p y menos'],
  ['Desconocida', 'Sin calidad indicada']
];

const CHECK = '<span class="marca-op"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg></span>';

// Estado de usuario y configuración
let currentUser = null;
let config = {
  proveedores: null,
  calidades: ['4k', '1080p', '720p'],
  disableTorrents: false,
  filtrarMuertos: true
};

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(t) {
  const el = $('toast');
  el.textContent = t;
  el.classList.add('ver');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('ver'), 2000);
}

const activos = () => (config.proveedores === null ? PROVEEDORES_LISTA.map(p => p.id) : config.proveedores);

function generarUrlManifest() {
  if (currentUser && currentUser.token) {
    return BASE_URL + '/' + encodeURIComponent(currentUser.token) + '/manifest.json';
  }
  return BASE_URL + '/manifest.json';
}

function pintarResumen() {
  const n = activos().length;
  $('num-fuentes').textContent = n + '/' + PROVEEDORES_LISTA.length;
  $('num-calidad').textContent = config.calidades.length;
  $('chip-sitios').textContent = n + ' de ' + PROVEEDORES_LISTA.length;
  $('chip-calidades').textContent = config.calidades.join(' · ') || 'Sin calidades';
  $('chip-muertos').textContent = config.filtrarMuertos ? 'Links muertos ocultos' : 'Links muertos visibles';
  $('chip-torrents').textContent = config.disableTorrents ? '🚫 Solo Streaming Directo' : '🧲 Torrents Activos';

  if (currentUser) {
    $('saludo-nombre').textContent = currentUser.username;
    $('perfil-nombre').textContent = currentUser.username;
    $('perfil-token').textContent = currentUser.token;
    $('avatar-user').textContent = (currentUser.username[0] || 'T').toUpperCase();
  }

  const manifestUrl = generarUrlManifest();
  $('instalar').href = manifestUrl.replace(/^https?:\\/\\//, 'stremio://');
  $('instalar-web').href = 'https://web.stremio.com/#/addons?addon=' + encodeURIComponent(manifestUrl);
}

let saveTimer;
function guardar() {
  pintarResumen();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!currentUser || !currentUser.token) return;
    try {
      await fetch('/api/user/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: currentUser.token, config })
      });
      toast('Sincronizado con tu perfil ✓');
    } catch(_) {
      toast('Cambios guardados localmente');
    }
  }, 350);
}

function pintarFuentes() {
  const act = new Set(activos());
  $('lista-fuentes').innerHTML = Object.entries(GRUPOS).map(([g, [nombre, desc]]) => {
    const lista = PROVEEDORES_LISTA.filter(p => p.grupo === g);
    if (!lista.length) return '';
    const on = lista.filter(p => act.has(p.id)).length;
    return '<div class="tarjeta grupo-prov">' +
      '<header><h3>' + nombre + '<small>' + desc + ' · ' + on + ' de ' + lista.length + '</small></h3>' +
      '<div class="botones-grupo"><button class="pastilla" data-todos="' + g + '">Todos</button><button class="pastilla" data-ninguno="' + g + '">Ninguno</button></div></header>' +
      '<div class="opciones">' +
      lista.map(p => '<div class="opcion ' + (act.has(p.id) ? 'on' : '') + '" data-prov="' + esc(p.id) + '">' + CHECK + esc(p.nombre) + '</div>').join('') +
      '</div></div>';
  }).join('');
}

function cambiarProveedores(ids, encender) {
  const act = new Set(activos());
  ids.forEach(id => encender ? act.add(id) : act.delete(id));
  config.proveedores = act.size === PROVEEDORES_LISTA.length ? null : [...act];
  pintarFuentes();
  guardar();
}

$('lista-fuentes').addEventListener('click', (e) => {
  const op = e.target.closest('[data-prov]');
  if (op) {
    return cambiarProveedores([op.dataset.prov], !op.classList.contains('on'));
  }
  const todos = e.target.dataset.todos;
  const ninguno = e.target.dataset.ninguno;
  if (todos) {
    cambiarProveedores(PROVEEDORES_LISTA.filter(p => p.grupo === todos).map(p => p.id), true);
  } else if (ninguno) {
    cambiarProveedores(PROVEEDORES_LISTA.filter(p => p.grupo === ninguno).map(p => p.id), false);
  }
});

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
    $('txt-torrents-title').textContent = torrentsActivos ? 'Torrents Habilitados 🧲' : 'Torrents Desactivados 🚫';
    $('txt-torrents-desc').textContent = torrentsActivos ? 'Incluye torrents 4K/1080p con seeders + streaming directo' : 'Solo streaming directo HTTPS (sin descargas P2P)';
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

$('copiar').addEventListener('click', () => copiar(generarUrlManifest(), 'URL personal de TACIT STR copiada ✓'));
$('copiar-plugin').addEventListener('click', () => copiar($('url-plugin').textContent, 'Enlace de Nuvio copiado ✓'));

// --- GESTIÓN DE PERFIL (LOGIN / CAMBIAR PERFIL) ---
function abrirModalLogin() {
  $('modal-login').classList.remove('oculto');
  $('inp-user').focus();
}

function cerrarModalLogin() {
  $('modal-login').classList.add('oculto');
}

$('btn-cambiar-perfil').addEventListener('click', () => {
  abrirModalLogin();
});

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('inp-user').value.trim();
  const pin = $('inp-pin').value.trim();
  const errBox = $('login-error');

  errBox.style.display = 'none';

  if (!username || !pin) {
    errBox.textContent = 'Por favor completa ambos campos.';
    errBox.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, pin })
    });
    const data = await res.json();
    if (!data.ok) {
      errBox.textContent = data.error || 'Error al autenticar.';
      errBox.style.display = 'block';
      return;
    }

    currentUser = data.user;
    if (data.user.config) {
      config = { ...config, ...data.user.config };
    }
    localStorage.setItem('tacit_active_user', JSON.stringify({ username, pin, token: currentUser.token }));

    cerrarModalLogin();
    pintarFuentes();
    pintarCalidades();
    pintarResumen();
    toast(data.created ? '¡Perfil creado con éxito! ✓' : '¡Bienvenido de vuelta! ✓');
  } catch(err) {
    errBox.textContent = 'Error de conexión con el servidor.';
    errBox.style.display = 'block';
  }
});

// Inicialización de la sesión del usuario
async function initSession() {
  try {
    const saved = localStorage.getItem('tacit_active_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.username && parsed.pin) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: parsed.username, pin: parsed.pin })
        });
        const data = await res.json();
        if (data.ok) {
          currentUser = data.user;
          if (data.user.config) {
            config = { ...config, ...data.user.config };
          }
          cerrarModalLogin();
          pintarFuentes();
          pintarCalidades();
          pintarResumen();
          mostrarVista(location.hash.slice(1) || 'inicio');
          return;
        }
      }
    }
  } catch(_) {}

  // Si no hay sesión previa, abrir modal de perfil
  pintarFuentes();
  pintarCalidades();
  pintarResumen();
  abrirModalLogin();
}

initSession();
</script>
</body>
</html>`;
}

module.exports = {
  renderConfigPage
};
