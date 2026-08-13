# Candidatos de comandos — Ginko-MD Lab
Fecha: 2026-08-13
Estado: Solo lista, nada implementado todavía. Token de Google AI Studio recibido y verificado funcional.

---

## 🐛 Misterio del comando `.ai` — ya resuelto

El bot NO tiene registrado el comando `.ai`. El único comando de IA es **`.ia`** (i-a) y su alias **`.chatgpt`** (archivo `cmds/utils/chatgpt.js`).
- En `core/system/commands.js` (el texto del menú), línea 260 aparece: `$prefixia » $prefixchatgpt`
- NO existe `$prefixai` en ningún lado.
- **Causa del "comando inexistente"**: al escribir `.ai` en vez de `.ia`, el handler en `main.js` no lo encuentra y responde que no existe.
- **Además**: `.ia` / `.chatgpt` casi siempre fallan porque las 3 APIs que usaba (siputzx, lempi gptprompt, delirius) están caídas/bloqueadas. La API que sí funciona es **Google Gemini** con el token que me pasaste (probada: `gemini-flash-latest` → modelo `gemini-3.6-flash`, respondió "Hola desde Ginko-MD" correctamente con HTTP 200).

### Nota sobre el token
- Empieza con `AQ.` (formato nuevo de Google AI Studio), NO con el clásico `AIzaSy`.
- Probado contra `generativelanguage.googleapis.com` → HTTP 200, lista de modelos completa.
- `generateContent` con `gemini-2.5-flash` → 404 (modelo retirado), con `gemini-flash-latest` → 200 OK.
- Modelos disponibles incluyen: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3-flash-preview`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite`, `gemini-2.5-flash-preview-tts` (¡TTS nativo!), `gemma-4-26b/31b`, `gemini-3-pro-image`.

---

## ✅ Candidatos "asegurados" (APIs probadas vivas hoy 2026-08-13 con curl HTTP 200)

### 🔧 Arreglos al código existente
| Comando | Problema actual | Solución | Alias a agregar |
|---|---|---|---|
| `.ia` / `.chatgpt` | APIs muertas, siempre responde error | Reescribir para usar Gemini `gemini-flash-latest` con el token del usuario | Agregar alias `.ai` (así el comando que el usuario escribe intuitivamente SÍ existe) |

### 🆕 Comandos nuevos sin dependencias externas (funcionan 100% offline)
| Comando | Descripción | Implementación |
|---|---|---|
| `.calc <expresión>` | Calculadora (soporta +, -, *, /, paréntesis, %, raíces) | `math.evaluate` con `mathjs` (ya instalado por otras dependencias) O evaluación segura con Function+whitelist |
| `.passwd [longitud]` | Genera contraseñas seguras | local (crypto) |
| `.uuid` | Genera UUID v4 | local (crypto.randomUUID) |
| `.coinflip` / `.dado` | Lanzar moneda/dado | local (Math.random) |
| `.morse <texto>` / `.demorse <código>` | Codificar/decodificar morse | local (mapa fijo) |
| `.binary <texto>` / `.debinary <binario>` | Convertir a/desde binario | local |
| `.encuesta <texto\|opt1\|opt2...>` | Crear encuesta con botones/reacciones | local (envía mensaje de reacción) |
| `.ship <@user1 @user2>` | Calculadora de amor/ship random | local (random + nombres) |
| `.8ball <pregunta>` | Bola 8 mágica | local (lista de respuestas) |

### 🌐 Comandos nuevos con APIs VIVAS confirmadas
| Comando | Descripción | API | Estado prueba |
|---|---|---|---|
| `.clima [ciudad]` | Ver clima actual en español (temperatura, viento, lluvia) | `wttr.in/<ciudad>?format=j1&lang=es` | ✅ 200, probado con Mexico_City |
| `.trad <idioma> <texto>` *([.trad](.trad) ya existe pero usa API rota)* | Traducir texto (ya existe pero falla; reemplazar) | `translate.googleapis.com/translate_a/single?client=gtx` | ✅ 200, probado "hello world" → "Hola Mundo" |
| `.tts <texto>` | Enviar nota de voz en español con el texto leído | `translate.google.com/translate_tts?tl=es&client=tw-ob` | ✅ 200, archivo MP3 válido (MPEG ADTS layer III) |
| `.qr <texto/url>` | Generar código QR | `api.qrserver.com/v1/create-qr-code/` | ✅ 200, PNG válido 300x300 |
| `.img <prompt>` / `.imagen` *(.imagen ya existe, roto con Google* ) | Generar imágenes con IA (reemplaza el .imagen roto) | `image.pollinations.ai/prompt/<prompt>` | ✅ 200, JPEG válido 512x512 |
| `.chiste` | Chiste en español | `v2.jokeapi.dev/joke/Any?lang=es&type=single` | ✅ 200, devuelve joke en español |
| `.ip <ip>` | Información de IP (país, ciudad, ISP) | `ip-api.com/json/<ip>` | ✅ 200 (no requiere key) |
| `.acortar <url>` | Acortar URL | `tinyurl.com/api-create.php` | ✅ 200 (is.gd estaba caído; tinyurl vivo) |
| `.letra <artista>/<canción>` | Letra de una canción | `api.lyrics.ovh/v1/<artist>/<title>` | ✅ 200, probado "Bad Bunny/Diles" |
| `.horoscopo <signo>` | Horóscopo diario | `horoscope-app-api.vercel.app` (seguir redirect 308) | ✅ 200, devuelve texto inglés (se puede traducir) |
| `.btc` / `.crypto <moneda>` | Precio de criptomonedas en USD/MXN | `api.coingecko.com/api/v3/simple/price` | ✅ 200, BTC=$63,861 USD / $1,090,002 MXN |
| `.bin <numero>` | Info de BIN/IIN de tarjetas (primeros 6-8 dígitos) | `lookup.binlist.net/<bin>` | ✅ 200 probado con 45717360 |
| `.wiki <término>` | Resumen corto de Wikipedia en español | `es.wikipedia.org/api/rest_v1/page/summary/...` | ⚠️ Necesita URL-encode bueno, pero es estable |
| `.pokedex <nombre>` | Info de Pokémon | `pokeapi.co/api/v2/pokemon/<name>` | ⚠️ Respuesta vacía desde este sandbox (posible Cloudflare), puede funcionar desde Termux |
| `.randomuser` | Genera una identidad falsa (nombre, correo, foto, dirección) | `randomuser.me/api/?nat=es` | ⚠️ Requiere User-Agent; se probará desde Termux |
| `.stickertext` (reemplazo a `.brat`/`.qc` rotos? ) | Stickers de texto con estilos (el .brat actual usa `skyzxu-brat.hf.space` y `.qc` usaba bot.lyo.su con SSL roto) | `skyzxu-brat.hf.space` (ya existe), alternativa nueva si falla | ✏️ Revisar si brat funciona en Termux real antes de reemplazar |

### 🤖 Comando IA nuevo (con token Gemini)
| Comando | Descripción | Estado |
|---|---|---|
| `.ai` / `.ia` / `.chatgpt` / `.gemini` | Chat con Gemini 3.6 Flash, soporta responder a imágenes (foto citada) | ✅ Token vivo; modelo `gemini-flash-latest` (redirige a gemini-3.6-flash) |
| `.ttsai <texto>` (futuro) | TTS con voz de Gemini nativa (`gemini-2.5-flash-preview-tts`) | ⏳ Por explorar — Gemini tiene endpoint TTS que suena mejor que Google Translate |
| `.imgai <prompt>` (futuro) | Imagen con `gemini-3-pro-image` | ⏳ Por probar |

---

## ❌ APIs MUERTAS o no confiables (descartadas)
- `ai.siputzx.my.id` → Cloudflare / caído
- `delirius-api` → vacío
- `hercai`, `nyx`, `kawaii.red`, `ryzendesu`, `fgmods`, `sandipbaruwal`, `neoxr`, `maelyn`, `nahusen`, `itzpire`, `otakudesu`, `blackbox`, `widipe`, `wibu-api`, `nwns.wtf` → todas muertas o requieren key
- `is.gd` (acortador) → "database insert failed"
- `lyrist.vercel.app` → Vercel Security Checkpoint (bloqueado)
- `api.cafirexos.com` (spotify) → timeout
- `source.unsplash.com` → 503 (deprecated)
- `thispersondoesnotexist.com` → devuelve HTML, no imagen
- `jikan.moe` (anime list) → timeout desde sandbox; tal vez viva desde Termux pero con rate limit
- `yesno.wtf` → timeout
- `open.er-api.com` (monedas) → respuesta vacía (posible rate limit)

---

## 🗂️ Candidatos que quieren revisión de dependencias
- `.remi`/`.hd` (mejorar imagen con vectorink): existe pero hay que ver si `vectorinkEnhanceFromBuffer` funciona con la configuración actual
- `.brat` / `.bratv` / `.qc`: actualmente .qc usa API caída (bot.lyo.su). Se puede reescribir .qc para usar la misma API de brat (skyzxu-brat.hf.space) o implementar generación local con sharp + Jimp + ffmpeg (PERO: ffmpeg-static NO funciona en Termux; usar `ffmpeg` del sistema si el usuario lo instaló con `pkg install ffmpeg`)

---

## 🚫 Cosas que NO haremos por ahora
- Descargadores de Instagram/Facebook/Twitter/GoogleDrive/MediaFire: todas las APIs gratuitas están muertas; solo quedan APIs de pago o scrapers que mueren cada semana. Se deja un mensaje informativo como con .pinterest.
- NSFW (xnxx, xvideos): el menú los lista pero los scripts probablemente están rotos; ya hay comando `.nsfw on/off` — no se tocan salvo que el usuario lo pida.
- `.imagen` de Google: se reemplazará por pollinations.ai (generación AI) o se agrega como `.imgai` con Gemini Image.
- `.pinterest`: ya está en Lab con mensaje "servicio caído" (listo para fusionar cuando el usuario autorice).

---

## 📋 Orden recomendado para implementar (cuando el usuario autorice)
1. **Arreglo urgente**: `.ia`/`.chatgpt` → reescribir con Gemini API + agregar alias `.ai` para que el comando que el usuario escribe funcione (este es el motivo por el que el usuario se quejó).
2. **Utilidades offline sin riesgo**: `.calc`, `.passwd`, `.uuid`, `.coinflip`, `.8ball`, `.ship`, `.morse`, `.binary`.
3. **Utilidades con API estable**: `.clima`, `.trad` (arreglar el existente), `.qr`, `.tts`, `.acortar`, `.chiste`, `.ip`, `.letra`, `.btc`, `.bin`, `.horoscopo`, `.wiki`.
4. **Imagen AI**: `.img` (pollinations) → reemplazo del `.imagen` roto.
5. **Fixes a rotos conocidos**: `.qc` (reemplazar API rota), arreglar mensaje en facebook/instagram/twitter/gdrive/mediafire como se hizo con pinterest.

Checkpoint guardado en tag: `v1.7-pre-candidatos` en Ginko-MD-Lab.

---

# 🎁 Cosecha del repositorio privado Ginko-V7 (riokuroxi-svg/Ginko-V7)
Fecha: 2026-08-13
Estado: V7 está en Baileys v7 (@whiskeysockets/baileys ^7.0.0-rc14) con estructura plugins/, no es portable 1:1 al Ginko-MD que usa this-xys/WaSocket con cmds/. Hay que **migrar/adaptar** los que valen la pena.

## 🏆 Joyas creadas por ti que SÍ valen la pena migrar

### 📚 `.manga` (TÚ lo hiciste, el más destacado)
- **Ubicación**: `plugins/download/manga.js` + `system/lib/mangaSources.js`
- **Qué hace**: busca mangas, lista capítulos, descarga en rangos de 10 y genera **PDF comprimido con sharp** (JPEG 50% calidad + resize 1000px), con cooldown, límite de peso 70MB, precio integrado a la economía, fallback entre MangaDex e InManga, portada + información + autor, reintentos con backoff.
- **APIs vivas confirmadas hoy**: ✅ MangaDex (HTTP 200, One Piece encontrado correctamente).
- **Dependencias que requiere**: `pdfkit` y `sharp` (sharp ya está en algunas partes del Ginko-MD? revisar; pdfkit NO está pero es liviano, ~500KB).
- **Problemas de adaptación**: el código usa `m.reply`, `sock.sendMessage`, `global.db` en formato V7; hay que adaptarlo al formato de Ginko-MD `run: async ({msg, sock, args, ...})`. No es difícil.
- **Decisión**: **prioridad alta**, es tu creación y te gustó.

### 🤖 Sistema de IA completo (gemini.js + openai.js + geminiAI.js)
- **Ubicación**: `plugins/tools/gemini.js`, `plugins/tools/openai.js`, `storage/script/geminiAI.js`
- **Qué hace**:
  - Helper `geminiChat(prompt, systemPrompt, historial)` listo para usar con tu token (usa `gemini-flash-latest` = Gemini 3.6 Flash, safetySettings, timeout 40s, maxOutputTokens 800).
  - `.gemini` / `.geminiia` / `.googleai` → chat directo sin memoria.
  - `.openai` / `.ai` / `.ia` / `.chat` → chat **con memoria de conversación por chat** (10 mensajes de historial), incluye comando `.ai reset` para limpiar memoria.
- **Estado**: el helper está limpio, la key la toma de `global.api.gemini` o `process.env.GEMINI_API_KEY`. Fácil de portar y soluciona directamente el bug de que `.ai` no existe.
- **Decisión**: **prioridad MÁXIMA**, resuelve el problema que te aqueja.

### 🎭 Rolplay / memoria de IA
El V7 ya tiene el concepto de **memoria por chat** (objeto `memoria[chatId]` con array de mensajes). Esto es exactamente lo que necesitas para el "rol play con IA" que mencionaste. Se puede extender con:
- System prompt configurable por grupo/usuario (el bot puede ser "tu novia", "un pirata", etc.)
- Memoria persistida en JSON para que no se pierda al reiniciar.
- Comando `.rol <personaje>` para cambiar personalidad.

## ✅ Comandos del V7 que valen la pena (APIs confirmadas vivas)

| Comando | Qué hace | Estado API | Notas de adaptación |
|---|---|---|---|
| `.clima` | Clima | ✅ ya lo teníamos como candidato | (idéntico, V7 también lo tiene) |
| `.tts` | Texto a voz | ✅ Google Translate TTS vivo | igual que nuestro candidato |
| `.qrcode` / `.qr` | QR | ✅ qrserver vivo | igual que nuestro candidato |
| `.shorturl` | Acortador | ✅ tinyurl vivo | igual que nuestro candidato |
| `.morse` / `.demorse` | Código morse | ✅ local | ya lo teníamos como candidato, el de V7 está bien hecho |
| `.encuesta` / `.poll` | Encuesta nativa de WhatsApp con `sock.sendPoll` | ✅ usa función nativa | Mejor que nuestro candidato de reacciones, usa el poll nativo de WhatsApp |
| `.recordar` / `.recordatorio` / `.alarma` | Recordatorios programados con setTimeout | ✅ local en memoria | Elegante, ya lo querías |
| `.resumen` / `.summary` | Resumir la conversación del grupo con IA | ✅ usa Gemini + store de Baileys | Muy útil en grupos |
| `.aimusic` | Genera letras de canciones por IA | ✅ aimusic.one (HTTP 200, probado hoy) | Divertido |
| `.ssweb` | Screenshot de páginas web | ⚠️ usa screenshotmachine.com (con key hardcodeada f74eca) + fallback thum.io | Adaptar para usar thum.io que no requiere key |
| `.carbon` | Imagen bonita de código (estilo carbon.now.sh) | ✅ carbonara.solopov.dev (HTTP 200, PNG 524x410 confirmado) | Ideal para compartir código |
| `.anime` / `.animeinfo` | Info de anime por AniList GraphQL | ✅ graphql.anilist.co (HTTP 200, Naruto encontrado, 220 ep, score 80) | Mejor que el jikan que probamos antes |
| `.whatanime` / `.wanime` | Buscar anime por imagen (screenshot) | ⚠️ trace.moe (HTTP 200, sí funciona pero requiere subir imagen a hosting primero) | Usa uploader, hay que adaptar con nuestro uploader a litterbox |
| `.shazam` / `.find` | Identificar música | ⚠️ usa paquete `acrcloud` con keys hardcodeadas (access_key/access_secret) | Las keys pueden expirar. El paquete acrcloud ya está en dependencias del V7; en el Ginko-MD hay que agregarlo. |
| `.removebg` | Quitar fondo de fotos | ⚠️ usa iloveimg.com (scraping con JWT en HTML) | Frágil, puede romperse si la página cambia, pero probado que el HTML se puede parsear y el JWT existe hoy. |
| `.waifu` (v2 en V7) | Waifu por waifu.pics | ✅ waifu.pics/sfw/waifu vivo | El del Ginko-MD usa nekos.life, se puede agregar waifu.pics como fallback o comando aparte |
| `.rvo` | Ver mensajes "ver una vez" (ver una sola vez) | ✅ usa `downloadContentFromMessage` de Baileys | El Ginko-MD ya tiene `.read`/`.readviewonce`, revisar si hace lo mismo |
| `.deezer` | Buscar música en Deezer y previews | ✅ api.deezer.com (HTTP 200, Bad Bunny/Diles encontrado) | El preview es de ~30 seg (lo que da Deezer gratis), no canción completa |
| `.spotify` | Descarga de Spotify | ⚠️ usa `sanzy-spotifydl` + `fluid-spotify.js` con keys hardcodeadas clientID/clientSecret | Sanzy-spotifydl suele romperse con actualizaciones de Spotify. Probar en Termux antes de prometerlo. |
| `.trailer` | Buscar tráiler por YouTube | ✅ usa yt-search (no requiere API) | Ya usamos yts en .play, es 0 riesgo |
| `.menfess` / `.confess` | Enviar mensaje anónimo a un número | ✅ 100% local | Divertido, requiere advertencias anti-spam |
| `.anon` / `.anonimo` / `.chatanon` | Chat anónimo conectando dos usuarios random | ✅ 100% local en memoria | Necesita que el bot tenga usuarios activos, no funciona con pocos usuarios |
| `.fx` / `.audiofx` | Efectos de audio (grave, lento, rapido, chipmunk, eco, robot, vibrato) | ✅ local con ffmpeg | **IMPORTANTE**: el usuario dijo que ffmpeg-static NO funciona en Termux, pero ffmpeg NATIVO (`pkg install ffmpeg`) sí. Hay que usar `child_process.execFile('ffmpeg', ...)` con el ffmpeg del sistema, NO el binario de `fluent-ffmpeg` con ffmpeg-static. |
| `.toanime` | Convertir foto a estilo anime | ❌ photoleap/photo-anime.vercel.app muertas hoy (HTTP 000 / timeout) | DESCARTADO |
| `.imaginate` / `.photoleap` | Generar imágenes con photoleap | ❌ tti.photoleapapp.com muerto hoy (timeout) | DESCARTADO (usamos pollinations.ai en su lugar) |
| `.tiktokDl` (con fallback) | TikTok más robusto con 2 fuentes (tikwm + tiklydown) | ✅ tikwm ya lo usamos (vivo), tiklydown por probar | Se puede agregar fallback de tiklydown al .tiktok actual que solo usa tikwm |
| `.pinterestScraper` | Scraper directo a pinterest.com | ❌ Pinterest ha bloqueado scraping sin auth. No lo vi funcionar en pruebas anteriores | DESCARTADO (se queda el mensaje informativo) |
| `.sticker.js` (system/lib) | Generador de stickers con webpmux (exif metadata) | ⚠️ requiere node-webpmux + ffmpeg NATIVO (no static) | Se puede mejorar el `.sticker` actual para agregar EXIF con autor/pack |
| `.stalkchannel` | Info de canales de WhatsApp | ❌ usa itzpire.com (muerto, vacío en pruebas anteriores) | DESCARTADO (usamos nativos de Baileys si se puede) |
| `.tiktokstalk` | Info de perfiles de TikTok | ❌ usa deliriussapi-oficial.vercel.app (muerto en auditoría previa) | DESCARTADO |
| `.gmailcheck` / `.gmailpf` | Info de perfiles de Gmail | ⚠️ usa scraper a Gmail, puede fallar con cuentas privadas | Baja prioridad |
| `.cloneweb` | Clonar sitio web como ZIP | ⚠️ saveweb2zip.com, 10 intentos de 60s = MUY lento | Riesgo de timeout en Termux (datos móviles). Baja prioridad. |
| `.sswebpdf` | Captura web a PDF | ❌ deliriussapi muerto | DESCARTADO |
| `.detectface`, `.similarface` | Reconocimiento facial | ❌ apis-starlights-team.koyeb.app (koyeb muere cada mes, no es confiable) + key imgbb hardcodeada | DESCARTADO |
| `.loli` | Imágenes loli | ⚠️ riesgo legal (contenido cuestionable), usa un JSON de GitHub | NO RECOMENDADO |
| `.gimage` / `.googleimage` | Scraper a Google Imágenes | ⚠️ scraping HTML con regex, muy frágil | Mejor usar pollinations.ai y/o buscar alternativa seria |
| `.waifu.pics` | Waifu por waifu.pics | ✅ vivo | Se puede agregar como extra |
| `.chiste`, `.dato`, `.consejo`, `.piropo`, `.personalidad`, `.love`, `.gay`, `.iqtest`, `.zodiac` | Comandos divertidos offline | ✅ 100% local (arrays con respuestas) | Rápidos de portar, 0 riesgo, hacen el bot más divertido. |
| `.stalkwa` / `.wastalk` | Info de un número de WhatsApp (foto, bio, país) | ✅ usa funciones NATIVAS de Baileys (`onWhatsApp`, `profilePictureUrl`, `fetchStatus`, `getBusinessProfile`) | MUY BUENO, 0 dependencias externas, 0 APIs. Funciona con el WaSocket también. |
| `.githubstalk` | Info de usuario GitHub | ✅ usa api.github.com pública | Fácil de portar. |
| `.duelo` / `.aceptar` / `.rechazar` | Duelos PvP apostando dinero del RPG | ✅ 100% local | El Ginko-MD ya tiene sistema de economía (coins), se puede integrar. |
| `.futbol` / `.footballer` | Info de jugador por Transfermarkt | ⚠️ scraping con cheerio, Transfermarkt cambia HTML seguido | Riesgo de romperse, pero cuando funciona está muy bien. |
| `.captcha` (grupo) | Captcha matemático al entrar al grupo, expulsa si no resuelve | ✅ local | Bueno anti-spam de grupos, pero requiere engancharse al evento `group-participants.update`. |

## 🔧 Mejoras estructurales que se pueden robar del V7

1. **Helper de Gemini modular** (`storage/script/geminiAI.js`) → úsalo para todos los comandos de IA (.ai, .resumen, .aimusic en el futuro puede usar la voz de Gemini TTS).
2. **Sistema de reintentos con backoff** (en manga.js) → aplicable a todos los comandos que llaman APIs externas.
3. **Cooldown por usuario** → ya hay un patrón en varios comandos del V7 (`if (cooldowns[sender] && ahora - cooldowns[sender] < COOLDOWN_MS)`), se puede implementar un helper global.
4. **system/lib/tiktokDl.js** con fallback entre tikwm y tiklydown → robuste más el .tiktok que ya está bueno.
5. **system/lib/sticker.js con EXIF** (node-webpmux) → agregar metadata de autor/pack a los stickers que genera el bot.

## ❌ Dependencias que NO hay que instalar por ahora
- `mongodb` (V7 lo usa pero no tenemos Atlas)
- `pdfkit` → se instala solo si migramos .manga
- `acrcloud` → solo si migramos .shazam y quieres el feature
- `sanzy-spotifydl`, `fluid-spotify.js` → frágiles, dejar para después
- `canvacord` → (V7 lo instala pero no vi comandos que lo usen en los que revisé)
- `ruhend-scraper` → innecesario para el Ginko-MD
- `javascript-obfuscator` → no ofuscaremos código en nuestro bot

## ✅ Dependencias que ya existen en el Ginko-MD y reutilizamos
- axios, node-fetch, form-data, cheerio, sharp (revisar si está instalado), jimp, file-type, qrcode (módulo npm para generar QR local), moment-timezone, yt-search, ytdl-core, node-webpmux

