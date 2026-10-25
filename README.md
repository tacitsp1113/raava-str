# 🗡️ TACIT STR (Stremio Addon Latino)

Addon híbrido de alto rendimiento para **Stremio** enfocado en películas, series y anime en **Español Latino**. Combina streaming HTTP directo (reproducción instantánea m3u8) y Torrents P2P de alta fidelidad (4K HDR / 1080p).

---

## ⚡ Características Principales

* **Estructura Visual Profesional (Estilo Nuve+ / LAT-ADD):**
  * Etiqueta limpia con el nombre del addon (`TACIT`).
  * Título y metadatos detallados: Título de la obra, año, temporada/episodio, resolución (`1080p | WEB-DL`), bandera de doblaje (`Latino 🇲🇽`) y peso estimado.
  * Jerarquía clara de servidores: Servidores principales de alta tasa de transferencia y servidores secundarios etiquetados como `⚡ Ruta alterna: úsala si el directo se traba`.

* **Enrutamiento Inteligente de Contenido:**
  * **Películas:** Consulta especializada a *Hackstore* (Torrents 4K/1080p + Vimeos) y *CineCalidad* (VOE y Vimeos).
  * **Series:** Consulta especializada a *Cuevana* y *PelisPlus* (con soporte de capítulos completos en VidHide, Vimeos y VOE).
  * **Anime:** Consulta exclusiva a *TioAnime* para animación japonesa en audio latino y subtitulada.
  * Reduce la latencia de scraping a la mitad evitando llamadas a proveedores que no alojan ese formato.

* **Límite Balanceado por Proveedor:**
  * En lugar de un límite global que favorezca a un solo scraper, el usuario configura **"Enlaces por proveedor"** (1 a 5 enlaces por fuente, por defecto **2**).
  * Garantiza variedad y redundancia de servidores en pantalla.

* **Caché en Memoria RAM (TTL de 30 minutos):**
  * Las consultas repetidas se resuelven en **0.01 segundos (10 ms)** directamente desde la RAM del servidor.

* **Panel de Configuración Interactivo (`/configure`):**
  * Selección por categorías (Películas, Series, Anime).
  * Selección de calidades permitidas (4K, 1080p, 720p, 480p).
  * Prioridad de reproducción (Directo primero vs. Torrents primero).
  * Soporte nativo para el botón de engranaje de Stremio (`/:configuration/configure`).

---

## 🛠️ Extractores y Descodificadores Integrados

1. **VOE (`services/extractors/voe.js`):**
   * Decodificador matemático multicapa: Desplazamiento rotacional César, stripping de basura en string, Base64 paso 1, shift de bytes `-3`, reverso y Base64 paso 2 para extraer el HLS `master.m3u8`.
2. **Vimeos (`services/extractors/vimeos.js`):**
   * Desempaquetador Dean Edwards (`eval(function(p,a,c,k,e,d)...)`). Extrae el stream m3u8 directo y subtítulos en formato VTT.
3. **VidHide / FileLions (`services/extractors/vidhide.js`):**
   * Desempaquetador Dean Edwards adaptado a CDNs de VidHide, FileLions y hosts espejo para series de TV.
4. **Validador de Disponibilidad (`services/extractors/validator.js`):**
   * Peticiones `HEAD` de baja latencia (1.5s) que descartan enlaces caídos (404/410) antes de entregarlos al reproductor.

---

## 📡 Endpoints del Servidor

| Ruta | Descripción |
| :--- | :--- |
| `GET /configure` | Página web de configuración e instalación interactiva. |
| `GET /:configuration/configure` | Redirección desde el engranaje de configuración en Stremio. |
| `GET /manifest.json` | Manifiesto estándar con configuración por defecto. |
| `GET /:configuration/manifest.json` | Manifiesto parametrizado según la configuración del usuario en Base64. |
| `GET /:configuration/stream/:type/:id.json` | Endpoint de resolución de streams para películas y series. |
| `GET /logo.png` | Icono oficial de Tacit Ronin en alta resolución. |

---

## 🚀 Despliegue y Ejecución

### 1. Ejecución Local
```bash
npm install
npm start
```
Abre tu navegador en: `http://localhost:7000/configure`

### 2. Despliegue en Render
El proyecto incluye [render.yaml](render.yaml) preconfigurado para Node.js con detección de puerto automática (`process.env.PORT`).

---

## 📜 Licencia
MIT © TACIT STR
