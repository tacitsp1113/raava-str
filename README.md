# 🗡️ TACIT STR (Stremio Addon Latino)

Addon híbrido de alto rendimiento para **Stremio** enfocado en películas, series y anime en **Español Latino**. Combina streaming HTTP directo (reproducción instantánea m3u8) y Torrents P2P de alta fidelidad (4K HDR / 1080p).

---

## ⚡ Características Implementadas

* **Estructura Visual Profesional (Estilo Nuve+ / LAT-ADD):**
  * Etiqueta limpia con el nombre del addon (`TACIT`).
  * Título y metadatos detallados: Título de la obra, año, temporada/episodio, resolución (`1080p | WEB-DL`), bandera de doblaje (`Latino 🇲🇽`) y peso estimado.
  * Jerarquía clara de servidores: Servidores principales de alta velocidad al inicio (`VOE`, `Vimeos`) y servidores secundarios etiquetados como `⚡ Ruta alterna: úsala si el directo se traba` (`VidHide`).

* **Enrutamiento Inteligente de Contenido:**
  * **Películas:** Consulta especializada a *Hackstore* (Torrents 4K/1080p + Vimeos), *CineCalidad* (VOE y Vimeos) y *PelisPlus*.
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
   * Decodificador matemático multicapa: Desplazamiento rotacional César, stripping de basura en string, Base64 paso 1, shift numérico de bytes `-3`, reverso y Base64 paso 2 para extraer el stream HLS directo.
2. **Embed69 (`services/extractors/embed69.js`):**
   * Resolutor criptográfico para PelisPlus: cálculo de *Proof-of-Work* (PoW SHA-256) en milisegundos y desencriptación AES-256-CBC con clave derivada para extraer servidores directos en audio Latino y Subtitulado.
3. **Vimeos (`services/extractors/vimeos.js`):**
   * Desempaquetador Dean Edwards (`eval(function(p,a,c,k,e,d)...)`). Extrae el stream m3u8 directo y subtítulos en formato VTT.
4. **VidHide / FileLions (`services/extractors/vidhide.js`):**
   * Desempaquetador Dean Edwards adaptado a CDNs de VidHide, FileLions y hosts espejo para series de TV.
5. **Validador de Disponibilidad (`services/extractors/validator.js`):**
   * Peticiones `HEAD` de baja latencia (1.5s) que descartan enlaces caídos (404/410) antes de entregarlos al reproductor.

---

## 📡 Proveedores Activos

| Proveedor | Enfoque | Dominio Oficial | Formatos |
| :--- | :--- | :--- | :--- |
| **Hackstore** | Películas 4K/1080p y Torrents | `hackstore2.com` | Magnet + Vimeos |
| **Cinecalidad** | Películas y estrenos | `cinecalidad.am` | VOE + Vimeos |
| **Cuevana** | Películas y Series | `cuevana3.sc` | VOE + VidHide + Vimeos |
| **PelisPlus** | Películas y Series Latino | `pelisplushd.bz` | Embed69 + VOE + Streamwish |
| **TioAnime** | Animación Japonesa | `tioanime.com` | Vimeos + Mega + Mp4Upload |

---

## 🚀 Despliegue y Ejecución

### 1. Ejecución Local
```bash
npm install
npm start
```
Abre tu navegador en: `http://localhost:10000/configure`

### 2. Despliegue en Render
El proyecto incluye `render.yaml` preconfigurado para Node.js con detección de puerto automática (`process.env.PORT`).

---

## 🔮 Pendientes y Hoja de Ruta (Roadmap)

- [ ] **Filtro de Idioma en Configuración:** Añadir casilla en `/configure` para filtrar estrictamente solo audio Latino o incluir Castellano.
- [ ] **Resolución de Altcha en Render:** Bypass del captcha Altcha cuando VOE detecta IPs de centros de datos (datacenter cloud IP).
- [ ] **Portar proveedores adicionales:** Explorar la integración de *LaMovie* o *SeriesFlix* desde la base comunitaria de plugins latinos.

---

## 📜 Licencia
MIT © TACIT STR
